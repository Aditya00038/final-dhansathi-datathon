// Local storage-based store — replaces Firebase when it is unreachable.
// Runs entirely in the browser; the data structure mirrors the Firestore schema.

import type { Goal, Deposit, AchievementNFT, Transaction, AIParsedTransaction, SavedSmsTransaction } from "./types";

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

export function getGoalById(userId: string, id: string): Goal | undefined {
  return readGoals(userId).find(g => g.id === id);
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
  return normalized;
}
