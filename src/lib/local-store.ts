// Local storage-based store — replaces Firebase when it is unreachable.
// Runs entirely in the browser; the data structure mirrors the Firestore schema.

import type { Goal, Deposit, AchievementNFT, Transaction, AIParsedTransaction, SavedSmsTransaction } from "./types";
import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  arrayUnion,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

const GOALS_KEY_PREFIX = "algosave_goals_";
const NFTS_KEY_PREFIX  = "algosave_nfts_";
const BALANCE_KEY_PREFIX = "algosave_balance_";
const SMS_TRANSACTIONS_KEY_PREFIX = "algosave_sms_transactions_";

// ── helpers ──────────────────────────────────────────────────────────────────

function getGoalsKey(userId: string) {
    return `${GOALS_KEY_PREFIX}${userId}`;
}

function getNftsKey(userId: string) {
    return `${NFTS_KEY_PREFIX}${userId}`;
}

function getBalanceKey(userId: string) {
    return `${BALANCE_KEY_PREFIX}${userId}`;
}

function getSmsTransactionsKey(userId: string) {
  return `${SMS_TRANSACTIONS_KEY_PREFIX}${userId}`;
}

function readGoals(userId: string): Goal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getGoalsKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function goalsCollection(userId: string) {
  return collection(db, "users", userId, "goals");
}

function goalDoc(userId: string, goalId: string) {
  return doc(db, "users", userId, "goals", goalId);
}

function writeGoals(userId: string, goals: Goal[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(getGoalsKey(userId), JSON.stringify(goals));
    return true;
  } catch {
    return false;
  }
}

// ── public api ───────────────────────────────────────────────────────────────

export function getGoalsAndDeposits(userId: string): { goals: Goal[], deposits: Deposit[] } {
    const goals = readGoals(userId);
    const deposits = goals.flatMap(goal => goal.deposits || []);
    return { goals, deposits };
}

export function getAllDeposits(userId: string): Deposit[] {
  const goals = readGoals(userId);
  return goals.flatMap(goal => goal.deposits || []);
}

export function saveGoal(userId: string, goal: Omit<Goal, 'id' | 'createdAt' | 'deposits'>): Goal {
  const goals = readGoals(userId);
  const newGoal: Goal = {
    ...goal,
    id: `local_${Date.now()}`,
    createdAt: new Date().toISOString(),
    deposits: [],
  };
  writeGoals(userId, [newGoal, ...goals]);
  return newGoal;
}

export function getGoals(userId: string): Goal[] {
  return readGoals(userId);
}

export async function getGoalsFirestore(userId: string): Promise<Goal[]> {
  try {
    const snap = await getDocs(goalsCollection(userId));
    const remoteGoals = snap.docs.map((d) => d.data() as Goal);
    const localGoals = readGoals(userId);
    const merged = new Map<string, Goal>(remoteGoals.map((g) => [g.id, g]));

    for (const localGoal of localGoals) {
      if (!merged.has(localGoal.id)) {
        merged.set(localGoal.id, localGoal);
        try {
          await setDoc(goalDoc(userId, localGoal.id), localGoal);
        } catch {
          // Ignore backfill errors and keep local cache data.
        }
      }
    }

    const mergedGoals = Array.from(merged.values());
    writeGoals(userId, mergedGoals);
    return mergedGoals;
  } catch {
    return readGoals(userId);
  }
}

export function getGoalById(userId: string, id: string): Goal | undefined {
  return readGoals(userId).find(g => g.id === id);
}

export async function getGoalByIdFirestore(userId: string, id: string): Promise<Goal | undefined> {
  try {
    const snap = await getDoc(goalDoc(userId, id));
    if (snap.exists()) {
      const goal = snap.data() as Goal;
      const cached = readGoals(userId);
      const rest = cached.filter((g) => g.id !== id);
      writeGoals(userId, [goal, ...rest]);
      return goal;
    }
    return getGoalById(userId, id);
  } catch {
    return getGoalById(userId, id);
  }
}

export function addDepositToGoal(userId: string, goalId: string, deposit: Omit<Deposit, 'timestamp'>) {
  const goals = readGoals(userId);
  const goal = goals.find(g => g.id === goalId);
  if (goal) {
    const newDeposit: Deposit = { ...deposit, timestamp: new Date().toISOString() };
    if (!goal.deposits) {
      goal.deposits = [];
    }
    goal.deposits.push(newDeposit);
    writeGoals(userId, goals);
  }
  return goal;
}

export async function saveGoalFirestore(
  userId: string,
  goal: Omit<Goal, "id" | "createdAt" | "deposits">
): Promise<Goal> {
  const newGoal: Goal = {
    ...goal,
    id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    deposits: [],
  };

  try {
    await setDoc(goalDoc(userId, newGoal.id), newGoal);
    const cached = readGoals(userId).filter((g) => g.id !== newGoal.id);
    writeGoals(userId, [newGoal, ...cached]);
    return newGoal;
  } catch {
    writeGoals(userId, [newGoal, ...readGoals(userId)]);
    return newGoal;
  }
}

export async function addDepositToGoalFirestore(
  userId: string,
  goalId: string,
  deposit: Omit<Deposit, "timestamp">
): Promise<Goal | undefined> {
  const newDeposit: Deposit = { ...deposit, timestamp: new Date().toISOString() };

  try {
    await updateDoc(goalDoc(userId, goalId), {
      deposits: arrayUnion(newDeposit),
    });
  } catch {
    // If Firestore update fails, local cache is still updated below.
  }

  const goals = readGoals(userId);
  const goal = goals.find((g) => g.id === goalId);
  if (goal) {
    if (!goal.deposits) goal.deposits = [];
    goal.deposits.push(newDeposit);
    writeGoals(userId, goals);
    return goal;
  }

  return getGoalByIdFirestore(userId, goalId);
}

export function saveNFT(userId: string, nft: AchievementNFT): void {
  if (typeof window === "undefined") return;
  const key = getNftsKey(userId);
  let nfts = [];
  try {
    const raw = localStorage.getItem(key);
    nfts = raw ? JSON.parse(raw) : [];
  } catch {
    nfts = [];
  }
  nfts.push(nft);
  localStorage.setItem(key, JSON.stringify(nfts));
}

export function getNFTByGoalId(userId: string, goalId: string): AchievementNFT | undefined {
  if (typeof window === "undefined") return undefined;
  const key = getNftsKey(userId);
  try {
    const raw = localStorage.getItem(key);
    const nfts = raw ? JSON.parse(raw) : [];
    return nfts.find((nft: AchievementNFT) => nft.goalId === goalId);
  } catch {
    return undefined;
  }
}

export function getBalance(userId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(getBalanceKey(userId));
    return raw ? parseFloat(raw) : 10000; // Default to 10000 if not set
  } catch {
    return 10000;
  }
}

export function updateBalance(userId: string, transactions: Partial<Transaction>[]): number {
  let currentBalance = getBalance(userId);
  for (const transaction of transactions) {
    if (transaction.type === 'debit' && transaction.amount) {
      currentBalance -= transaction.amount;
    } else if (transaction.type === 'credit' && transaction.amount) {
      currentBalance += transaction.amount;
    }
  }
  if (typeof window !== "undefined") {
    localStorage.setItem(getBalanceKey(userId), currentBalance.toString());
  }
  return currentBalance;
}

export function getSavedSmsTransactions(userId: string): SavedSmsTransaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getSmsTransactionsKey(userId));
    const items = raw ? (JSON.parse(raw) as SavedSmsTransaction[]) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export function saveSmsParsedTransactions(userId: string, transactions: AIParsedTransaction[]): SavedSmsTransaction[] {
  if (typeof window === "undefined") return [];

  const existing = getSavedSmsTransactions(userId);
  const existingKeys = new Set(
    existing.map((tx) => `${tx.amount}|${tx.date}|${tx.merchant.toLowerCase()}|${tx.type}`)
  );

  const normalized: SavedSmsTransaction[] = transactions
    .filter((t): t is Required<Pick<AIParsedTransaction, "amount" | "date" | "merchant" | "type">> => (
      typeof t.amount === "number" && Number.isFinite(t.amount) &&
      typeof t.date === "string" && t.date.trim().length > 0 &&
      typeof t.merchant === "string" && t.merchant.trim().length > 0 &&
      (t.type === "debit" || t.type === "credit")
    ))
    .map((t) => ({
      id: `sms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      amount: t.amount,
      date: t.date,
      merchant: t.merchant.trim(),
      type: t.type,
      source: "sms-paste" as const,
      createdAt: new Date().toISOString(),
    }))
    .filter((tx) => {
      const key = `${tx.amount}|${tx.date}|${tx.merchant.toLowerCase()}|${tx.type}`;
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });

  const merged = [...normalized, ...existing].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  localStorage.setItem(getSmsTransactionsKey(userId), JSON.stringify(merged));

  // Also save to Firestore so analytics charts can use this data
  if (normalized.length > 0) {
    try {
      normalized.forEach((tx) => {
        // Extract category from merchant if it has format "name (category)"
        let category = 'Others';
        const categoryMatch = tx.merchant.match(/\(([^)]+)\)$/);
        if (categoryMatch && categoryMatch[1]) {
          const potential = categoryMatch[1].trim();
          const validCategories = ['Food', 'Shopping', 'Travel', 'Bills', 'Others'];
          if (validCategories.includes(potential)) {
            category = potential;
          }
        }

        addDoc(collection(db, 'transactions'), {
          userId: tx.userId,
          amount: tx.amount,
          merchant: tx.merchant,
          category,
          type: tx.type,
          date: tx.date,
          source: 'SMS',
          createdAt: serverTimestamp(),
        }).catch(() => {
          // Silently fail; data is still saved in localStorage
        });
      });
    } catch {
      // Silently fail; data is still saved in localStorage
    }
  }

  return normalized;
}

export function saveCashSpenderTransaction(
  userId: string,
  payload: {
    amount: number;
    date: string;
    merchant: string;
    category?: string;
    type?: "debit" | "credit";
  }
): SavedSmsTransaction | null {
  if (typeof window === "undefined") return null;

  const amount = Number(payload.amount);
  const date = (payload.date || "").trim();
  const merchant = (payload.merchant || "").trim();
  const type = payload.type === "credit" ? "credit" : "debit";
  const category = (payload.category || "Others").trim() || "Others";

  if (!Number.isFinite(amount) || amount <= 0 || !date || !merchant) {
    return null;
  }

  const entry: SavedSmsTransaction = {
    id: `cash_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    amount,
    date,
    merchant: `${merchant} (${category})`,
    type,
    source: "cash-manual",
    createdAt: new Date().toISOString(),
  };

  const existing = getSavedSmsTransactions(userId);
  const merged = [entry, ...existing].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  localStorage.setItem(getSmsTransactionsKey(userId), JSON.stringify(merged));

  try {
    addDoc(collection(db, "transactions"), {
      userId,
      amount: entry.amount,
      merchant: merchant,
      category,
      type: entry.type,
      date: entry.date,
      source: "CASH",
      createdAt: serverTimestamp(),
    }).catch(() => {
      // Keep local copy even if remote write fails.
    });
  } catch {
    // Keep local copy even if remote write fails.
  }

  return entry;
}
