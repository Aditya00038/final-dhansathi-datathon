'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitCommit, TrendingUp, Target, DollarSign } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { getGoalsAndDeposits } from "@/lib/local-store";
import { getGoalOnChainState } from "@/lib/blockchain";
import type { GoalWithOnChainData, Goal } from "@/lib/types";
import AuthGuard from "@/components/auth/AuthGuard";
import Navbar from "@/components/layout/Navbar";

const PIE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A569BD', '#F5B7B1'];

const microAlgosToAlgos = (microAlgos: number) => microAlgos / 1_000_000;

// Helper to get the saved amount for a goal, whether on-chain or off-chain.
const getSavedAmount = (goal: Goal, onChainState: any) => {
    // For on-chain goals, the source of truth is the blockchain.
    if (goal.goalType === 'on-chain' && onChainState?.total_deposited) {
        return microAlgosToAlgos(onChainState.total_deposited);
    }
    // For off-chain goals, we sum the local deposits.
    return goal.deposits?.reduce((sum, deposit) => sum + deposit.amount, 0) || 0;
}

function AnalyticsPage() {
  const { user } = useWallet();
  const [goals, setGoals] = useState<GoalWithOnChainData[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [totalSaved, setTotalSaved] = useState(0);
  const [totalGoals, setTotalGoals] = useState(0);
  const [totalDepositCount, setTotalDepositCount] = useState(0);
  const [avgProgress, setAvgProgress] = useState(0);

  useEffect(() => {
    if (user?.addr) {
      const { goals: localGoals } = getGoalsAndDeposits(user.addr);

      const fetchData = async () => {
        let totalSavedAmount = 0;
        let totalTargetAmount = 0;
        const goalsWithOnChainData: GoalWithOnChainData[] = [];

        for (const goal of localGoals) {
          const onChainState = await getGoalOnChainState(goal.appId);
          const savedAmount = getSavedAmount(goal, onChainState);
          
          const goalWithData = { ...goal, onChainState, savedAmount };
          goalsWithOnChainData.push(goalWithData);

          totalSavedAmount += savedAmount;
          totalTargetAmount += goal.targetAmount;
        }

        const totalDepositsCount = localGoals.reduce((acc, goal) => acc + (goal.deposits?.length || 0), 0);
        const averageProgress = totalTargetAmount > 0 ? (totalSavedAmount / totalTargetAmount) * 100 : 0;

        setGoals(goalsWithOnChainData);
        setTotalSaved(totalSavedAmount);
        setTotalGoals(localGoals.length);
        setTotalDepositCount(totalDepositsCount);
        setAvgProgress(averageProgress);

        if (goalsWithOnChainData.length > 0 && !selectedGoalId) {
          setSelectedGoalId(goalsWithOnChainData[0].id);
        }
      };

      fetchData();
    }
  }, [user, selectedGoalId]);

  const selectedGoal = goals.find(g => g.id === selectedGoalId);
  const pieChartData = goals.map(g => ({ name: g.name, value: g.savedAmount || 0 })).filter(item => item.value > 0);

  return (
    <AuthGuard>
      <div className="min-h-screen w-full bg-gray-100 dark:bg-gray-900">
        <Navbar />
        <main className="p-4 md:p-8 pt-20">
            <header className="mb-8">
                <h1 className="text-4xl font-bold text-gray-800 dark:text-white">Financial Analytics</h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">Your savings and goals at a glance.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Savings</CardTitle>
                        <DollarSign className="h-4 w-4 text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{totalSaved.toLocaleString()}</div>
                        <p className="text-xs text-gray-500">Across all goals</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Active Goals</CardTitle>
                        <Target className="h-4 w-4 text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalGoals}</div>
                        <p className="text-xs text-gray-500">Currently tracking</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Deposits</CardTitle>
                        <GitCommit className="h-4 w-4 text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalDepositCount}</div>
                        <p className="text-xs text-gray-500">Transactions made</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Average Goal Progress</CardTitle>
                        <TrendingUp className="h-4 w-4 text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{avgProgress.toFixed(1)}%</div>
                        <p className="text-xs text-gray-500">Across all goals</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <Card className="col-span-1 lg:col-span-3">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>Goal Progress Over Time</CardTitle>
                            <Select onValueChange={setSelectedGoalId} value={selectedGoalId || ''}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select a goal" />
                                </SelectTrigger>
                                <SelectContent>
                                    {goals.map(goal => (
                                        <SelectItem key={goal.id} value={goal.id}>{goal.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[400px]">
                        {selectedGoal && selectedGoal.deposits && selectedGoal.deposits.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={selectedGoal.deposits.map(d => ({ name: new Date(d.timestamp).toLocaleDateString(), amount: d.amount }))}>
                                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false}/>
                                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`}/>
                                    <Tooltip cursor={{fill: 'transparent'}} />
                                    <Legend />
                                    <Bar dataKey="amount" fill="#8884d8" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="flex items-center justify-center h-full text-gray-500">No deposit data for this goal.</div>}
                    </CardContent>
                </Card>
                <Card className="col-span-1 lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Savings Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[400px]">
                        {pieChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={pieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                        {pieChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => `₹${Number(value).toLocaleString()}`} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <div className="flex items-center justify-center h-full text-gray-500">No savings to display.</div>}
                    </CardContent>
                </Card>
            </div>
        </main>
      </div>
    </AuthGuard>
  );
}

export default AnalyticsPage;
