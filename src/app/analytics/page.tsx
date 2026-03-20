'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Target, GitCommit, Wallet, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getGoalsAndDeposits, getSavedSmsTransactions } from '@/lib/local-store';
import { getGoalOnChainState } from '@/lib/blockchain';
import { microAlgosToAlgos, formatCurrency } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import AuthGuard from '@/components/auth/AuthGuard';
import Navbar from '@/components/layout/Navbar';
import { toDate } from '@/lib/utils';
import type { SavedSmsTransaction } from '@/lib/types';

type DepositRecord = {
  amount: number;
  txId: string;
  timestamp: string | number | Date;
};

type LocalGoal = {
  id: string;
  name: string;
  appId: number;
  deposits?: DepositRecord[];
};

type GoalAnalytics = {
  id: string;
  name: string;
  appId: number;
  targetAlgo: number;
  savedAlgo: number;
  progressPct: number;
  deposits: DepositRecord[];
  onChainOk: boolean;
};

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6'];

function buildMonthlySavings(goals: GoalAnalytics[]) {
  const bucket = new Map<string, number>();

  goals.forEach((goal) => {
    goal.deposits.forEach((d) => {
      const date = toDate(d.timestamp);
      if (isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      bucket.set(key, (bucket.get(key) || 0) + d.amount);
    });
  });

  return Array.from(bucket.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, amount]) => ({ month, amount }));
}

function buildGoalDepositBars(goal: GoalAnalytics | undefined) {
  if (!goal) return [];

  return [...goal.deposits]
    .sort((a, b) => toDate(a.timestamp).getTime() - toDate(b.timestamp).getTime())
    .map((d) => ({
      date: toDate(d.timestamp).toLocaleDateString(),
      amount: d.amount,
    }));
}

function parseMerchantLabel(label: string): { brand: string; category: string } {
  const m = label.match(/^(.*?)\s*\((.*?)\)\s*$/);
  if (!m) return { brand: label, category: 'Others' };
  return { brand: m[1], category: m[2] };
}

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function normalizeLegacyMerchantLabel(label: string): string {
  const current = parseMerchantLabel(label);
  if (current.category !== 'Others' || /\(.+\)/.test(label)) return label;

  const lower = label.toLowerCase();
  if (/kfc|kfcsapphire/.test(lower)) return 'KFC (Food)';
  if (/swiggy/.test(lower)) return 'Swiggy (Food)';
  if (/zomato/.test(lower)) return 'Zomato (Food)';
  if (/myntra/.test(lower)) return 'Myntra (Groceries)';
  if (/meesho/.test(lower)) return 'Meesho (Groceries)';
  if (/blinkit/.test(lower)) return 'Blinkit (Groceries)';
  if (/zepto/.test(lower)) return 'Zepto (Groceries)';

  return label;
}

function AnalyticsPage() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<GoalAnalytics[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [selectedSmsCategory, setSelectedSmsCategory] = useState<string>('all');
  const [selectedSmsDateRange, setSelectedSmsDateRange] = useState<string>('all');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!user?.uid) {
        if (mounted) {
          setGoals([]);
          setSelectedGoalId('');
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      const { goals: rawGoals } = getGoalsAndDeposits(user.uid);
      const typedGoals = (rawGoals || []) as LocalGoal[];

      const resolved = await Promise.all(
        typedGoals.map(async (goal) => {
          const deposits = Array.isArray(goal.deposits) ? goal.deposits : [];
          const localSaved = deposits.reduce((sum, d) => sum + (d.amount || 0), 0);

          try {
            const onChain = await getGoalOnChainState(goal.appId);
            const targetAlgo = microAlgosToAlgos(onChain.targetAmount || 0);
            const savedAlgo = microAlgosToAlgos(onChain.totalSaved || 0);
            const progressPct = targetAlgo > 0 ? Math.min(100, (savedAlgo / targetAlgo) * 100) : 0;

            return {
              id: goal.id,
              name: goal.name,
              appId: goal.appId,
              targetAlgo,
              savedAlgo,
              progressPct,
              deposits,
              onChainOk: true,
            } as GoalAnalytics;
          } catch {
            return {
              id: goal.id,
              name: goal.name,
              appId: goal.appId,
              targetAlgo: 0,
              savedAlgo: localSaved,
              progressPct: 0,
              deposits,
              onChainOk: false,
            } as GoalAnalytics;
          }
        })
      );

      if (!mounted) return;

      setGoals(resolved);
      setSelectedGoalId((prev) => prev || resolved[0]?.id || '');
      setLoading(false);
    };

    load();

    return () => {
      mounted = false;
    };
  }, [user?.uid]);

  const selectedGoal = useMemo(
    () => goals.find((g) => g.id === selectedGoalId),
    [goals, selectedGoalId]
  );

  const totalSaved = useMemo(() => goals.reduce((sum, g) => sum + g.savedAlgo, 0), [goals]);
  const totalTarget = useMemo(() => goals.reduce((sum, g) => sum + g.targetAlgo, 0), [goals]);
  const totalDepositCount = useMemo(
    () => goals.reduce((sum, g) => sum + g.deposits.length, 0),
    [goals]
  );
  const avgProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  const pieChartData = useMemo(
    () => goals.map((g) => ({ name: g.name, value: g.savedAlgo })).filter((x) => x.value > 0),
    [goals]
  );

  const monthlySavingsData = useMemo(() => buildMonthlySavings(goals), [goals]);
  const goalDepositBars = useMemo(() => buildGoalDepositBars(selectedGoal), [selectedGoal]);
  const pieOuterRadius = isMobile ? 78 : 110;
  const smsTransactions: SavedSmsTransaction[] = useMemo(
    () => (user?.uid ? getSavedSmsTransactions(user.uid) : []),
    [user?.uid]
  );

  const debitSmsTransactions = useMemo(
    () => smsTransactions
      .filter((tx) => tx.type === 'debit' && tx.amount > 0)
      .map((tx) => ({
        ...tx,
        merchant: normalizeLegacyMerchantLabel(tx.merchant),
      })),
    [smsTransactions]
  );

  const smsCategories = useMemo(() => {
    const categories = new Set<string>();
    debitSmsTransactions.forEach((tx) => {
      categories.add(parseMerchantLabel(tx.merchant).category);
    });
    return ['all', ...Array.from(categories).sort((a, b) => a.localeCompare(b))];
  }, [debitSmsTransactions]);

  const dateRangeFilteredSmsTransactions = useMemo(() => {
    if (selectedSmsDateRange === 'all') return debitSmsTransactions;

    const now = new Date();
    const days = Number(selectedSmsDateRange);
    if (!Number.isFinite(days) || days <= 0) return debitSmsTransactions;

    const minDate = new Date(now);
    minDate.setDate(now.getDate() - days);

    return debitSmsTransactions.filter((tx) => {
      const d = new Date(tx.date);
      if (Number.isNaN(d.getTime())) return false;
      return d >= minDate;
    });
  }, [debitSmsTransactions, selectedSmsDateRange]);

  const filteredSmsTransactions = useMemo(() => {
    if (selectedSmsCategory === 'all') return dateRangeFilteredSmsTransactions;
    return dateRangeFilteredSmsTransactions.filter(
      (tx) => parseMerchantLabel(tx.merchant).category.toLowerCase() === selectedSmsCategory.toLowerCase()
    );
  }, [dateRangeFilteredSmsTransactions, selectedSmsCategory]);

  const smsSpendingByMerchant = useMemo(() => {
    const map = new Map<string, { amount: number; lastDate: string }>();
    filteredSmsTransactions.forEach((tx) => {
      const prev = map.get(tx.merchant);
      if (!prev) {
        map.set(tx.merchant, { amount: tx.amount, lastDate: tx.date });
      } else {
        map.set(tx.merchant, {
          amount: prev.amount + tx.amount,
          lastDate: new Date(tx.date).getTime() > new Date(prev.lastDate).getTime() ? tx.date : prev.lastDate,
        });
      }
    });

    return Array.from(map.entries())
      .map(([merchant, value]) => ({ merchant, amount: value.amount, lastDate: value.lastDate }))
      .sort((a, b) => b.amount - a.amount || new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime())
      .slice(0, 8);
  }, [filteredSmsTransactions]);

  const smsSpendingByCategory = useMemo(() => {
    const map = new Map<string, number>();
    debitSmsTransactions.forEach((tx) => {
      const { category } = parseMerchantLabel(tx.merchant);
      map.set(category, (map.get(category) || 0) + tx.amount);
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [debitSmsTransactions]);

  const smsTotalSpent = useMemo(
    () => filteredSmsTransactions.reduce((sum, tx) => sum + tx.amount, 0),
    [filteredSmsTransactions]
  );

  const smsMonthlyFiltered = useMemo(() => {
    const map = new Map<string, number>();
    filteredSmsTransactions.forEach((tx) => {
      const month = (tx.date || '').slice(0, 7) || 'Unknown';
      map.set(month, (map.get(month) || 0) + tx.amount);
    });

    return Array.from(map.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredSmsTransactions]);

  const smsPaymentHistory = useMemo(
    () => [...filteredSmsTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 25),
    [filteredSmsTransactions]
  );

  return (
    <AuthGuard>
      <div className="min-h-screen w-full bg-background">
        <Navbar />
        <main className="px-3 py-4 md:p-8 pt-16 md:pt-20 space-y-4 md:space-y-6">
          <header>
            <h1 className="text-2xl md:text-4xl font-bold leading-tight">Financial Analytics</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Track your on-chain saving momentum with clean, actionable insights.</p>
          </header>

          {loading ? (
            <Card>
              <CardContent className="py-12 flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading analytics...
              </CardContent>
            </Card>
          ) : goals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-lg font-medium">No goals found yet</p>
                <p className="text-muted-foreground mt-1">Create a goal and make a deposit to unlock analytics.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                <Card>
                  <CardHeader className="pb-1 md:pb-2 px-3 pt-3 md:px-6 md:pt-6">
                    <CardTitle className="text-xs md:text-sm font-medium flex items-center justify-between gap-2">
                      Total Saved
                      <Wallet className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
                    <p className="text-base md:text-xl font-bold truncate">{formatCurrency(totalSaved)}</p>
                    <p className="text-[10px] md:text-xs text-muted-foreground">Across {goals.length} goals</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-1 md:pb-2 px-3 pt-3 md:px-6 md:pt-6">
                    <CardTitle className="text-xs md:text-sm font-medium flex items-center justify-between gap-2">
                      Goal Progress
                      <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
                    <p className="text-base md:text-xl font-bold">{avgProgress.toFixed(1)}%</p>
                    <p className="text-[10px] md:text-xs text-muted-foreground">Average completion</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-1 md:pb-2 px-3 pt-3 md:px-6 md:pt-6">
                    <CardTitle className="text-xs md:text-sm font-medium flex items-center justify-between gap-2">
                      Active Goals
                      <Target className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
                    <p className="text-base md:text-xl font-bold">{goals.length}</p>
                    <p className="text-[10px] md:text-xs text-muted-foreground">On-chain + local tracked</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-1 md:pb-2 px-3 pt-3 md:px-6 md:pt-6">
                    <CardTitle className="text-xs md:text-sm font-medium flex items-center justify-between gap-2">
                      Deposits
                      <GitCommit className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
                    <p className="text-base md:text-xl font-bold">{totalDepositCount}</p>
                    <p className="text-[10px] md:text-xs text-muted-foreground">Total transactions</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                <Card className="xl:col-span-3">
                  <CardHeader>
                    <CardTitle className="text-base md:text-xl">Per-Goal Deposit Timeline</CardTitle>
                    <CardDescription className="text-xs md:text-sm">View each deposit amount for a selected goal.</CardDescription>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2">
                      <Select value={selectedGoalId} onValueChange={setSelectedGoalId}>
                        <SelectTrigger className="w-full sm:w-[260px]">
                          <SelectValue placeholder="Select a goal" />
                        </SelectTrigger>
                        <SelectContent>
                          {goals.map((goal) => (
                            <SelectItem key={goal.id} value={goal.id}>
                              {goal.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedGoal && (
                        <Badge variant={selectedGoal.onChainOk ? 'default' : 'secondary'}>
                          {selectedGoal.onChainOk ? 'On-chain synced' : 'Using local fallback'}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="h-[260px] sm:h-[300px] md:h-[340px] px-2 md:px-6">
                    {goalDepositBars.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={goalDepositBars} margin={{ top: 8, right: 6, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={10} />
                          <YAxis tickLine={false} axisLine={false} fontSize={10} width={36} />
                          <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Deposit']} />
                          <Bar dataKey="amount" fill="#10b981" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        No deposits yet for this goal.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="xl:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base md:text-xl">Savings Distribution</CardTitle>
                    <CardDescription className="text-xs md:text-sm">How your saved amount is spread across goals.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[260px] sm:h-[300px] md:h-[340px] px-2 md:px-6">
                    {pieChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={pieOuterRadius} label={!isMobile}>
                            {pieChartData.map((_, idx) => (
                              <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        No savings data to visualize yet.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base md:text-xl">Monthly Deposit Trend</CardTitle>
                  <CardDescription className="text-xs md:text-sm">Last 6 months based on your recorded deposit dates.</CardDescription>
                </CardHeader>
                <CardContent className="h-[230px] sm:h-[260px] md:h-[280px] px-2 md:px-6">
                  {monthlySavingsData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlySavingsData} margin={{ top: 8, right: 6, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={10} />
                        <YAxis tickLine={false} axisLine={false} fontSize={10} width={36} />
                        <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Saved']} />
                        <Bar dataKey="amount" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      Not enough history to plot monthly trend.
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                <Card className="xl:col-span-3">
                  <CardHeader>
                    <CardTitle className="text-base md:text-xl">SMS Spending Insights</CardTitle>
                    <CardDescription className="text-xs md:text-sm">Company/brand and category from saved SMS transactions.</CardDescription>
                    <div className="pt-2 flex flex-col sm:flex-row gap-2">
                      <Select value={selectedSmsCategory} onValueChange={setSelectedSmsCategory}>
                        <SelectTrigger className="w-full sm:w-[220px]">
                          <SelectValue placeholder="Filter by category" />
                        </SelectTrigger>
                        <SelectContent>
                          {smsCategories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat === 'all' ? 'All Categories' : cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={selectedSmsDateRange} onValueChange={setSelectedSmsDateRange}>
                        <SelectTrigger className="w-full sm:w-[200px]">
                          <SelectValue placeholder="Filter by date" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Time</SelectItem>
                          <SelectItem value="7">Last 7 Days</SelectItem>
                          <SelectItem value="30">Last 30 Days</SelectItem>
                          <SelectItem value="90">Last 90 Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {smsSpendingByMerchant.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between rounded-md border p-3">
                          <span className="text-sm text-muted-foreground">Total SMS Spend ({selectedSmsCategory === 'all' ? 'All' : selectedSmsCategory}, {selectedSmsDateRange === 'all' ? 'All Time' : `Last ${selectedSmsDateRange} Days`})</span>
                          <span className="font-semibold">{formatInr(smsTotalSpent)}</span>
                        </div>
                        {smsSpendingByMerchant.map((item, idx) => {
                          const { brand, category } = parseMerchantLabel(item.merchant);
                          return (
                            <div key={`${item.merchant}-${idx}`} className="flex items-center justify-between rounded-md border p-3">
                              <div className="min-w-0">
                                <p className="font-medium truncate">{brand} ({category})</p>
                                <p className="text-xs text-muted-foreground">Last payment: {formatDisplayDate(item.lastDate)}</p>
                              </div>
                              <p className="font-semibold ml-3">{formatInr(item.amount)}</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-muted-foreground">
                        Save SMS parsed transactions to view spending insights.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="xl:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base md:text-xl">Spending by Category</CardTitle>
                    <CardDescription className="text-xs md:text-sm">Category split from merchant labels.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[260px] sm:h-[300px] md:h-[320px] px-2 md:px-6">
                    {smsSpendingByCategory.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={smsSpendingByCategory}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={pieOuterRadius}
                            label={!isMobile}
                          >
                            {smsSpendingByCategory.map((_, idx) => (
                              <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatInr(Number(value))} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        No SMS spending data yet.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                <Card className="xl:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base md:text-xl">Filtered Spend Graph (INR)</CardTitle>
                    <CardDescription className="text-xs md:text-sm">Monthly spending for selected category.</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[250px] md:h-[290px] px-2 md:px-6">
                    {smsMonthlyFiltered.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={smsMonthlyFiltered} margin={{ top: 8, right: 6, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={10} />
                          <YAxis tickLine={false} axisLine={false} fontSize={10} width={40} />
                          <Tooltip formatter={(value) => [formatInr(Number(value)), 'Spent']} />
                          <Bar dataKey="amount" fill="#ef4444" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        No graph data for selected filter.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="xl:col-span-3">
                  <CardHeader>
                    <CardTitle className="text-base md:text-xl">Payment History</CardTitle>
                    <CardDescription className="text-xs md:text-sm">Latest debit transactions for selected category.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {smsPaymentHistory.length > 0 ? (
                      <div className="space-y-2">
                        {smsPaymentHistory.map((tx) => {
                          const { brand, category } = parseMerchantLabel(tx.merchant);
                          return (
                            <div key={tx.id} className="flex items-center justify-between rounded-md border p-3">
                              <div className="min-w-0">
                                <p className="font-medium truncate">{brand} ({category})</p>
                                <p className="text-xs text-muted-foreground">Done on {formatDisplayDate(tx.date)}</p>
                              </div>
                              <p className="font-semibold ml-3 text-red-500">{formatInr(tx.amount)}</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-muted-foreground">No payment history for selected filter.</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}

export default AnalyticsPage;
