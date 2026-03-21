// Local storage-based store for normal (non-blockchain) goals.
// Users can deposit/withdraw anytime. All amounts are in INR.

import type { NormalGoal, NormalGoalTransaction } from "./types";
import { db } from "./firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";

const NORMAL_GOALS_KEY = "dhansathi_normal_goals_v2";

// ── helpers ──────────────────────────────────────────────────────────────────

function readAllGoals(): NormalGoal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(NORMAL_GOALS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAllGoals(goals: NormalGoal[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NORMAL_GOALS_KEY, JSON.stringify(goals));
}

function recalcBalance(goal: NormalGoal): number {
  return goal.transactions.reduce((sum, tx) => {
    return tx.type === "deposit" ? sum + tx.amount : sum - tx.amount;
  }, 0);
}

function normalGoalsCollection(userId: string) {
  return collection(db, "users", userId, "normalGoals");
}

function normalGoalDoc(userId: string, goalId: string) {
  return doc(db, "users", userId, "normalGoals", goalId);
}

// ── public API ───────────────────────────────────────────────────────────────

export function getAllNormalGoals(userId: string): NormalGoal[] {
  return readAllGoals().filter(g => g.userId === userId);
}

export async function getAllNormalGoalsFirestore(userId: string): Promise<NormalGoal[]> {
  try {
    const snap = await getDocs(normalGoalsCollection(userId));
    const goals = snap.docs.map((d) => d.data() as NormalGoal);
    const localGoals = getAllNormalGoals(userId);
    const merged = new Map<string, NormalGoal>(goals.map((g) => [g.id, g]));

    for (const localGoal of localGoals) {
      if (!merged.has(localGoal.id)) {
        merged.set(localGoal.id, localGoal);
        try {
          await setDoc(normalGoalDoc(userId, localGoal.id), localGoal);
        } catch {
          // Ignore backfill errors and keep local cache data.
        }
      }
    }

    const mergedGoals = Array.from(merged.values());
    const others = readAllGoals().filter((g) => g.userId !== userId);
    writeAllGoals([...others, ...mergedGoals]);
    return mergedGoals;
  } catch {
    return getAllNormalGoals(userId);
  }
}

export function getNormalGoalById(userId: string, id: string): NormalGoal | null {
  return readAllGoals().find((g) => g.id === id && g.userId === userId) ?? null;
}

export async function getNormalGoalByIdFirestore(userId: string, id: string): Promise<NormalGoal | null> {
  try {
    const snap = await getDoc(normalGoalDoc(userId, id));
    if (!snap.exists()) return getNormalGoalById(userId, id);
    const goal = snap.data() as NormalGoal;
    const all = readAllGoals().filter((g) => !(g.userId === userId && g.id === id));
    writeAllGoals([...all, goal]);
    return goal;
  } catch {
    return getNormalGoalById(userId, id);
  }
}

export function createNormalGoal(userId: string, data: {
  name: string;
  targetAmount: number;
  deadline: string;
  monthlyIncome?: number;
  monthlySpending?: number;
}): NormalGoal {
  const allGoals = readAllGoals();
  const newGoal: NormalGoal = {
    id: `normal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    name: data.name,
    targetAmount: data.targetAmount,
    currentBalance: 0,
    deadline: data.deadline,
    createdAt: new Date().toISOString(),
    monthlyIncome: data.monthlyIncome,
    monthlySpending: data.monthlySpending,
    transactions: [],
    goalCompleted: false,
  };
  allGoals.push(newGoal);
  writeAllGoals(allGoals);
  return newGoal;
}

export async function createNormalGoalFirestore(userId: string, data: {
  name: string;
  targetAmount: number;
  deadline: string;
  monthlyIncome?: number;
  monthlySpending?: number;
}): Promise<NormalGoal> {
  const newGoal: NormalGoal = {
    id: `normal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    name: data.name,
    targetAmount: data.targetAmount,
    currentBalance: 0,
    deadline: data.deadline,
    createdAt: new Date().toISOString(),
    monthlyIncome: data.monthlyIncome,
    monthlySpending: data.monthlySpending,
    transactions: [],
    goalCompleted: false,
  };

  try {
    await setDoc(normalGoalDoc(userId, newGoal.id), newGoal);
  } catch {
    // Fall back to local cache write below.
  }

  const all = readAllGoals().filter((g) => !(g.userId === userId && g.id === newGoal.id));
  writeAllGoals([...all, newGoal]);
  return newGoal;
}

export function depositToNormalGoal(
  userId: string,
  goalId: string,
  amount: number,
  note?: string
): NormalGoal | null {
  const allGoals = readAllGoals();
  const idx = allGoals.findIndex((g) => g.id === goalId && g.userId === userId);
  if (idx === -1) return null;

  const tx: NormalGoalTransaction = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: "deposit",
    amount,
    timestamp: new Date().toISOString(),
    note,
  };

  allGoals[idx].transactions.push(tx);
  allGoals[idx].currentBalance = recalcBalance(allGoals[idx]);

  if (allGoals[idx].currentBalance >= allGoals[idx].targetAmount) {
    allGoals[idx].goalCompleted = true;
  }

  writeAllGoals(allGoals);
  return allGoals[idx];
}

export async function depositToNormalGoalFirestore(
  userId: string,
  goalId: string,
  amount: number,
  note?: string
): Promise<NormalGoal | null> {
  const goal = await getNormalGoalByIdFirestore(userId, goalId);
  if (!goal) return null;

  const tx: NormalGoalTransaction = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: "deposit",
    amount,
    timestamp: new Date().toISOString(),
    note,
  };

  const updated: NormalGoal = {
    ...goal,
    transactions: [...goal.transactions, tx],
  };
  updated.currentBalance = recalcBalance(updated);
  updated.goalCompleted = updated.currentBalance >= updated.targetAmount;

  try {
    await setDoc(normalGoalDoc(userId, goalId), updated);
  } catch {
    // Keep local copy in sync even if Firestore write fails.
  }

  const all = readAllGoals().filter((g) => !(g.userId === userId && g.id === goalId));
  writeAllGoals([...all, updated]);
  return updated;
}

export function withdrawFromNormalGoal(
  userId: string,
  goalId: string,
  amount: number,
  note?: string
): NormalGoal | null {
  const allGoals = readAllGoals();
  const idx = allGoals.findIndex((g) => g.id === goalId && g.userId === userId);
  if (idx === -1) return null;

  if (amount > allGoals[idx].currentBalance) {
    return null;
  }

  const tx: NormalGoalTransaction = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: "withdrawal",
    amount,
    timestamp: new Date().toISOString(),
    note,
  };

  allGoals[idx].transactions.push(tx);
  allGoals[idx].currentBalance = recalcBalance(allGoals[idx]);

  if (allGoals[idx].currentBalance < allGoals[idx].targetAmount) {
    allGoals[idx].goalCompleted = false;
  }

  writeAllGoals(allGoals);
  return allGoals[idx];
}

export async function withdrawFromNormalGoalFirestore(
  userId: string,
  goalId: string,
  amount: number,
  note?: string
): Promise<NormalGoal | null> {
  const goal = await getNormalGoalByIdFirestore(userId, goalId);
  if (!goal) return null;
  if (amount > goal.currentBalance) return null;

  const tx: NormalGoalTransaction = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: "withdrawal",
    amount,
    timestamp: new Date().toISOString(),
    note,
  };

  const updated: NormalGoal = {
    ...goal,
    transactions: [...goal.transactions, tx],
  };
  updated.currentBalance = recalcBalance(updated);
  updated.goalCompleted = updated.currentBalance >= updated.targetAmount;

  try {
    await setDoc(normalGoalDoc(userId, goalId), updated);
  } catch {
    // Keep local copy in sync even if Firestore write fails.
  }

  const all = readAllGoals().filter((g) => !(g.userId === userId && g.id === goalId));
  writeAllGoals([...all, updated]);
  return updated;
}

export function updateNormalGoalFinancials(
  userId: string,
  goalId: string,
  data: { monthlyIncome?: number; monthlySpending?: number }
): NormalGoal | null {
  const allGoals = readAllGoals();
  const idx = allGoals.findIndex((g) => g.id === goalId && g.userId === userId);
  if (idx === -1) return null;

  if (data.monthlyIncome !== undefined) allGoals[idx].monthlyIncome = data.monthlyIncome;
  if (data.monthlySpending !== undefined) allGoals[idx].monthlySpending = data.monthlySpending;

  writeAllGoals(allGoals);
  return allGoals[idx];
}

export async function updateNormalGoalFinancialsFirestore(
  userId: string,
  goalId: string,
  data: { monthlyIncome?: number; monthlySpending?: number }
): Promise<NormalGoal | null> {
  const goal = await getNormalGoalByIdFirestore(userId, goalId);
  if (!goal) return null;

  const updated: NormalGoal = {
    ...goal,
    monthlyIncome: data.monthlyIncome !== undefined ? data.monthlyIncome : goal.monthlyIncome,
    monthlySpending: data.monthlySpending !== undefined ? data.monthlySpending : goal.monthlySpending,
  };

  try {
    await setDoc(normalGoalDoc(userId, goalId), updated);
  } catch {
    // Keep local copy in sync even if Firestore write fails.
  }

  const all = readAllGoals().filter((g) => !(g.userId === userId && g.id === goalId));
  writeAllGoals([...all, updated]);
  return updated;
}

export function deleteNormalGoal(userId: string, goalId: string) {
  const remainingGoals = readAllGoals().filter((g) => !(g.id === goalId && g.userId === userId));
  writeAllGoals(remainingGoals);
}

export async function deleteNormalGoalFirestore(userId: string, goalId: string) {
  try {
    await deleteDoc(normalGoalDoc(userId, goalId));
  } catch {
    // Fallback to local delete.
  }
  const remainingGoals = readAllGoals().filter((g) => !(g.id === goalId && g.userId === userId));
  writeAllGoals(remainingGoals);
}

// ... (keep prediction utils the same, they operate on a single goal object)

export function getSavingsPrediction(goal: NormalGoal): {
  requiredPerWeek: number;
  requiredPerMonth: number;
  predictedCompletionDate: Date | null;
  onTrack: boolean;
  weeksLeft: number;
  savingRate: number; // average per week based on history
  message: string;
} {
  const now = new Date();
  const deadline = new Date(goal.deadline);
  const remaining = goal.targetAmount - goal.currentBalance;

  // Calculate weeks left
  const msLeft = deadline.getTime() - now.getTime();
  const weeksLeft = Math.max(1, Math.ceil(msLeft / (7 * 24 * 60 * 60 * 1000)));

  const requiredPerWeek = remaining > 0 ? Math.ceil(remaining / weeksLeft) : 0;
  const requiredPerMonth = requiredPerWeek * 4.33;

  // Calculate current saving rate from transaction history
  const deposits = goal.transactions.filter((t) => t.type === "deposit");
  const totalDeposited = deposits.reduce((s, t) => s + t.amount, 0);

  const createdAt = new Date(goal.createdAt);
  const weeksSinceCreation = Math.max(
    1,
    (now.getTime() - createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );
  const savingRate = totalDeposited / weeksSinceCreation; // per week

  // Predict completion date based on current rate
  let predictedCompletionDate: Date | null = null;
  let onTrack = false;
  let message = "";

  if (goal.goalCompleted) {
    onTrack = true;
    message = "🎉 Congratulations! You have reached your goal!";
    predictedCompletionDate = now;
  } else if (savingRate <= 0) {
    message = "Start saving to see your prediction!";
  } else {
    const weeksNeeded = remaining / savingRate;
    predictedCompletionDate = new Date(
      now.getTime() + weeksNeeded * 7 * 24 * 60 * 60 * 1000
    );
    onTrack = predictedCompletionDate <= deadline;

    if (onTrack) {
      message = `✅ On track! At this rate, you will reach your goal by ${predictedCompletionDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.`;
    } else {
      message = `⚠️ You are saving slower than expected. At this rate, you'll reach your goal by ${predictedCompletionDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} — after your deadline.`;
    }
  }

  return {
    requiredPerWeek,
    requiredPerMonth,
    predictedCompletionDate,
    onTrack,
    weeksLeft,
    savingRate,
    message,
  };
}

export function getAIGoalAdvice(goal: NormalGoal): string {
  const prediction = getSavingsPrediction(goal);
  const remaining = goal.targetAmount - goal.currentBalance;
  const income = goal.monthlyIncome || 0;
  const spending = goal.monthlySpending || 0;
  const monthlySavingsCapacity = income - spending;

  let advice = "";

  if (goal.goalCompleted) {
    return "🎉 Amazing! You've reached your goal! Consider setting a new savings target to keep the momentum going.";
  }

  if (income > 0 && spending > 0) {
    const savingsPercent = ((monthlySavingsCapacity / income) * 100).toFixed(0);
    advice += `Based on your income (₹${income.toLocaleString("en-IN")}) and spending (₹${spending.toLocaleString("en-IN")}), you can save ₹${monthlySavingsCapacity.toLocaleString("en-IN")}/month (${savingsPercent}% of income). `;

    if (monthlySavingsCapacity >= prediction.requiredPerMonth) {
      advice += `You should save ₹${Math.ceil(prediction.requiredPerWeek).toLocaleString("en-IN")}/week to reach your "${goal.name}" goal in ${prediction.weeksLeft} weeks. This is well within your capacity! `;
    } else if (monthlySavingsCapacity > 0) {
      advice += `You need ₹${Math.ceil(prediction.requiredPerMonth).toLocaleString("en-IN")}/month but can only save ₹${monthlySavingsCapacity.toLocaleString("en-IN")}/month. Consider extending your deadline or reducing expenses. `;
    } else {
      advice += `Your spending exceeds your income. Try to reduce expenses by at least ₹${Math.ceil(prediction.requiredPerMonth).toLocaleString("en-IN")}/month to start saving. `;
    }
  } else {
    advice += `You should save ₹${Math.ceil(prediction.requiredPerWeek).toLocaleString("en-IN")}/week to reach your "${goal.name}" goal in ${prediction.weeksLeft} weeks. `;
    advice += `Add your monthly income and spending for personalized advice. `;
  }

  advice += prediction.message;

  return advice;
}
