"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useWallet } from "@/contexts/WalletContext";
import AuthGuard from "@/components/auth/AuthGuard";
import Navbar from "@/components/layout/Navbar";
import FinancialOverview from "@/components/dashboard/FinancialOverview";
import QuickActions from "@/components/dashboard/QuickActions";
import GoalsList from "@/components/dashboard/GoalsList";
import RecentActivity from "@/components/dashboard/RecentActivity";
import { getGoalsFirestore } from "@/lib/local-store";
import { getAllNormalGoalsFirestore, getSavingsPrediction } from "@/lib/normal-goal-store";
import { getGoalOnChainState } from "@/lib/blockchain";
import type { Goal, GoalWithOnChainData, NormalGoal } from "@/lib/types";
import { fetchAlgoInrRate } from "@/lib/algo-inr";
import { useAuth } from "@/contexts/AuthContext";
import { getSavedSmsTransactions } from "@/lib/local-store";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type UserProfile = {
  phoneNumber?: string;
  dailySavingsSmsSentOn?: string;
  overspendSmsSentOn?: string;
  cashReminderSmsSentOn?: string;
};

type DashboardActivity = {
  id: string;
  kind: "on-chain" | "off-chain";
  action: "deposit" | "withdrawal";
  amount: number;
  timestamp: string;
  goalName: string;
  currency: "ALGO" | "INR";
};

function parseMerchantCategory(label: string): string {
  const m = label.match(/^(.*?)\s*\((.*?)\)\s*$/);
  if (!m) return "Others";
  return m[2] || "Others";
}

async function sendSms(recipient: string, message: string) {
  try {
    await fetch("/api/send-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient, message }),
    });
  } catch (error) {
    console.error("Failed to send scheduled SMS:", error);
  }
}

export default function Dashboard() {
  const { activeAddress, isConnecting } = useWallet();
  const { user } = useAuth();
  const [goals, setGoals] = useState<GoalWithOnChainData[]>([]);
  const [normalGoals, setNormalGoals] = useState<NormalGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadGoals = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      await fetchAlgoInrRate();
      
      const storedGoals = await getGoalsFirestore(user.uid);
      const goalsWithOnChain = await Promise.all(
        storedGoals.map(async (goal) => {
          try {
            const onChain = await getGoalOnChainState(goal.appId);
            return { ...goal, onChain } as GoalWithOnChainData;
          } catch {
            return { ...goal, onChain: { goalOwner: "", targetAmount: 0, totalSaved: 0, deadline: 0, goalCompleted: false, balance: 0 } } as GoalWithOnChainData;
          }
        })
      );
      setGoals(goalsWithOnChain);

      const storedNormalGoals = await getAllNormalGoalsFirestore(user.uid);
      setNormalGoals(storedNormalGoals);
    } catch (err) {
      console.error("Error loading goals:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadGoals();
    }
  }, [loadGoals, user]);

  const stats = useMemo(() => {
    const totalSavedAlgo = goals.reduce((sum, g) => sum + (g.onChain?.totalSaved || 0) / 1_000_000, 0);
    const totalTargetAlgo = goals.reduce((sum, g) => sum + (g.onChain?.targetAmount || 0) / 1_000_000, 0);
    const completedGoals = goals.filter(g => g.onChain?.goalCompleted).length + normalGoals.filter(g => g.goalCompleted).length;
    const activeGoals = goals.filter(g => !g.onChain?.goalCompleted).length + normalGoals.filter(g => !g.goalCompleted).length;
    const progressPercent = totalTargetAlgo > 0 ? Math.round((totalSavedAlgo / totalTargetAlgo) * 100) : 0;

    const normalTotalSaved = normalGoals.reduce((sum, g) => sum + g.currentBalance, 0);
    const normalTotalTarget = normalGoals.reduce((sum, g) => sum + g.targetAmount, 0);

    return { totalSaved: totalSavedAlgo, totalTarget: totalTargetAlgo, completedGoals, activeGoals, progressPercent, normalTotalSaved, normalTotalTarget };
  }, [goals, normalGoals]);

  const recentActivities = useMemo<DashboardActivity[]>(() => {
    const activities: DashboardActivity[] = [];

    goals.forEach(goal => {
      if (!goal.deposits) return;
      goal.deposits.forEach((deposit, index) => {
        activities.push({
          id: `onchain-${goal.id}-${index}-${deposit.timestamp}`,
          kind: "on-chain",
          action: "deposit",
          amount: deposit.amount,
          timestamp: deposit.timestamp,
          goalName: goal.name,
          currency: "ALGO",
        });
      });
    });

    normalGoals.forEach((goal) => {
      goal.transactions.forEach((tx) => {
        activities.push({
          id: `offchain-${goal.id}-${tx.id}`,
          kind: "off-chain",
          action: tx.type,
          amount: tx.amount,
          timestamp: tx.timestamp,
          goalName: goal.name,
          currency: "INR",
        });
      });
    });

    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
  }, [goals, normalGoals]);

  useEffect(() => {
    if (!user?.uid) return;

    const runDailySmsChecks = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const userRef = doc(db, "users", user.uid);

      let profile: UserProfile = {};
      try {
        const snap = await getDoc(userRef);
        if (snap.exists()) profile = snap.data() as UserProfile;
      } catch {
        return;
      }

      const phone = (profile.phoneNumber || "").trim();
      if (!phone) return;

      const activeGoals = normalGoals.filter((g) => !g.goalCompleted && g.targetAmount > g.currentBalance);
      if (activeGoals.length > 0 && profile.dailySavingsSmsSentOn !== today) {
        const goalDailyTargets = activeGoals.map((g) => {
          const prediction = getSavingsPrediction(g);
          return {
            name: g.name,
            daily: Math.max(0, Math.ceil(prediction.requiredPerWeek / 7)),
          };
        });

        const totalDaily = goalDailyTargets.reduce((sum, g) => sum + g.daily, 0);
        const focusGoals = goalDailyTargets.slice(0, 2).map((g) => `${g.name}: ₹${g.daily}/day`).join(", ");
        const msg = `DhanSathi reminder: Save ₹${totalDaily.toLocaleString("en-IN")}/day to stay on track. ${focusGoals}`;

        await sendSms(phone, msg);
        await setDoc(userRef, { dailySavingsSmsSentOn: today }, { merge: true });
      }

      if (profile.overspendSmsSentOn !== today) {
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 7);

        const recentDebitSms = getSavedSmsTransactions(user.uid).filter((tx) => {
          if (tx.type !== "debit" || tx.amount <= 0) return false;
          const d = new Date(tx.date);
          return !Number.isNaN(d.getTime()) && d >= last7Days;
        });

        if (recentDebitSms.length > 0) {
          const byCategory = new Map<string, number>();
          recentDebitSms.forEach((tx) => {
            const category = parseMerchantCategory(tx.merchant);
            byCategory.set(category, (byCategory.get(category) || 0) + tx.amount);
          });

          const ranked = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]);
          const top = ranked[0];

          if (top) {
            const [topCategory, topAmount] = top;
            const totalSpent = recentDebitSms.reduce((sum, t) => sum + t.amount, 0);
            const isOverspending = topAmount >= 1000 && topAmount / Math.max(totalSpent, 1) >= 0.45;

            if (isOverspending) {
              const totalDaily = activeGoals.reduce((sum, g) => {
                const prediction = getSavingsPrediction(g);
                return sum + Math.max(0, Math.ceil(prediction.requiredPerWeek / 7));
              }, 0);

              const alertMsg = `DhanSathi alert: You spent ₹${topAmount.toLocaleString("en-IN")} on ${topCategory} in the last 7 days. Please reduce this category. From now, save ₹${totalDaily.toLocaleString("en-IN")}/day to achieve your goal.`;
              await sendSms(phone, alertMsg);
              await setDoc(userRef, { overspendSmsSentOn: today }, { merge: true });
            }
          }
        }
      }

      // 11 PM nightly reminder for capturing cash spends.
      const now = new Date();
      const isAfter11Pm = now.getHours() >= 23;
      if (isAfter11Pm && profile.cashReminderSmsSentOn !== today) {
        const cashMsg = "DhanSathi 11PM check-in: Did you spend any money in cash today? Please add it in Cash Spender so your analytics and goal advice stay accurate.";
        await sendSms(phone, cashMsg);
        await setDoc(userRef, { cashReminderSmsSentOn: today }, { merge: true });
      }
    };

    runDailySmsChecks();
  }, [user?.uid, normalGoals]);

  return (
    <AuthGuard>
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-5 md:px-6 md:py-8 space-y-6 md:space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Welcome back!</h1>
          <p className="text-muted-foreground text-sm mt-1">Here&apos;s your financial overview</p>
        </div>
        <FinancialOverview {...stats} />
        <QuickActions />
        <GoalsList
          goals={goals}
          normalGoals={normalGoals}
          isLoading={isLoading}
          loadGoals={loadGoals}
        />
        <RecentActivity activities={recentActivities} />
      </main>
      <footer className="border-t border-border/60 py-5 mt-6">
        <p className="text-center text-xs text-muted-foreground">Running on Algorand Testnet &bull; Powered by DhanSathi</p>
      </footer>
    </div>
    </AuthGuard>
  );
}
