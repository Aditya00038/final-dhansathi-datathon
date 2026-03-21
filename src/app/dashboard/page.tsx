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
import { getAllNormalGoalsFirestore } from "@/lib/normal-goal-store";
import { getGoalOnChainState } from "@/lib/blockchain";
import type { Goal, GoalWithOnChainData, NormalGoal, Deposit } from "@/lib/types";
import { fetchAlgoInrRate } from "@/lib/algo-inr";
import { useAuth } from "@/contexts/AuthContext";

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

  const recentDeposits = useMemo(() => {
    const allDeposits: (Deposit & { goalId: string; goalName: string; })[] = [];
    goals.forEach(goal => {
        if (goal.deposits) {
            goal.deposits.forEach(deposit => {
                allDeposits.push({ ...deposit, goalId: goal.id, goalName: goal.name });
            });
        }
    });
    return allDeposits.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);
  }, [goals]);

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
        <RecentActivity deposits={recentDeposits} />
      </main>
      <footer className="border-t border-border/60 py-5 mt-6">
        <p className="text-center text-xs text-muted-foreground">Running on Algorand Testnet &bull; Powered by DhanSathi</p>
      </footer>
    </div>
    </AuthGuard>
  );
}
