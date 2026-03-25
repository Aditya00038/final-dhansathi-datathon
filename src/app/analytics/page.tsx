'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { Loader2, TrendingDown, Wallet, PiggyBank, ReceiptText } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { getAllNormalGoalsFirestore } from '@/lib/normal-goal-store';
import { getSavedSmsTransactions } from '@/lib/local-store';
import AuthGuard from '@/components/auth/AuthGuard';
import Navbar from '@/components/layout/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type TxType = 'debit' | 'credit';

type TransactionDoc = {
  id: string;
  userId: string;
  amount: number;
  merchant: string;
  category?: string;
  date?: unknown;
  source?: string;
  type?: TxType;
  createdAt?: unknown;
};

type NormalGoalLike = {
  id: string;
  name: string;
  targetAmount: number;
  currentBalance: number;
};

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6'];

function formatInr(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === 'string') {
    // Special handling for ISO date strings (YYYY-MM-DD) to preserve local date
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const d = new Date(year, month - 1, day, 0, 0, 0, 0);
        return Number.isNaN(d.getTime()) ? null : d;
      }
    }
    // Handle other date formats as-is
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'object' && value !== null) {
    const maybeTimestamp = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number };

    if (typeof maybeTimestamp.toDate === 'function') {
      const parsed = maybeTimestamp.toDate();
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (typeof maybeTimestamp.seconds === 'number') {
      const parsed = new Date(maybeTimestamp.seconds * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  return null;
}

function getDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekStart(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isExpense(tx: TransactionDoc): boolean {
  if (!Number.isFinite(tx.amount) || tx.amount <= 0) return false;
  return tx.type !== 'credit';
}

function CustomPieTooltip({ active, payload }: any) {
  if (active && payload && payload.length > 0) {
    const { name, value } = payload[0];
    return (
      <div className='bg-black/90 text-white px-3 py-2 rounded-lg border border-white/20'>
        <p className='font-semibold'>{name}</p>
        <p className='text-sm'>{formatInr(value)}</p>
      </div>
    );
  }
  return null;
}

function CustomLineTooltip({ active, payload }: any) {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload; // Full data object
    const { value } = payload[0];
    const fullDate = data.date; // Full date in YYYY-MM-DD or YYYY-MM format
    
    let displayDate = fullDate;
    // Format YYYY-MM-DD to DD-MM-YYYY
    if (fullDate && fullDate.length === 10 && fullDate.includes('-')) {
      const [year, month, day] = fullDate.split('-');
      displayDate = `${day}-${month}-${year}`;
    }
    // Format YYYY-MM to MM-YYYY
    else if (fullDate && fullDate.length === 7 && fullDate.includes('-')) {
      const [year, month] = fullDate.split('-');
      displayDate = `${month}-${year}`;
    }
    
    return (
      <div className='bg-black/90 text-white px-3 py-2 rounded-lg border border-white/20'>
        <p className='text-sm font-medium'>Date: {displayDate}</p>
        <p className='text-sm'>Amount: {formatInr(value)}</p>
      </div>
    );
  }
  return null;
}

function normalizeCategory(raw?: string): string {
  if (!raw || raw.trim().length === 0) return 'Others';
  const value = raw.trim();
  return value.length > 0 ? value : 'Others';
}

function AnalyticsPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<TransactionDoc[]>([]);
  const [balance, setBalance] = useState(0);
  const [savingsGoals, setSavingsGoals] = useState<NormalGoalLike[]>([]);
  const [timeRange, setTimeRange] = useState<'30days' | 'week' | 'month' | 'year' | 'all'>('30days');
  const [showAllTransactions, setShowAllTransactions] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!user?.uid) {
        if (mounted) {
          setTransactions([]);
          setBalance(0);
          setSavingsGoals([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      try {
        const txQuery = query(collection(db, 'transactions'), where('userId', '==', user.uid));
        const txSnap = await getDocs(txQuery);
        const txsFromFirestore: TransactionDoc[] = txSnap.docs.map((d) => {
          const data = d.data() as Omit<TransactionDoc, 'id'>;
          return { id: d.id, ...data };
        });

        const localSaved = getSavedSmsTransactions(user.uid);
        const localTxs: TransactionDoc[] = localSaved.map((tx) => ({
          id: tx.id,
          userId: tx.userId,
          amount: tx.amount,
          merchant: tx.merchant,
          category: (() => {
            const m = tx.merchant.match(/\(([^)]+)\)\s*$/);
            return m && m[1] ? m[1].trim() : 'Others';
          })(),
          date: tx.date,
          source: tx.source,
          type: tx.type,
          createdAt: tx.createdAt,
        }));

        const deduped = new Map<string, TransactionDoc>();
        txsFromFirestore.forEach((tx) => {
          const key = `${tx.amount}|${String(tx.date || '')}|${(tx.merchant || '').toLowerCase()}|${tx.type || ''}`;
          deduped.set(key, tx);
        });
        localTxs.forEach((tx) => {
          const key = `${tx.amount}|${String(tx.date || '')}|${(tx.merchant || '').toLowerCase()}|${tx.type || ''}`;
          if (!deduped.has(key)) deduped.set(key, tx);
        });
        const txs = Array.from(deduped.values());

        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const bankSnap = await getDoc(doc(db, 'bank_balances', user.uid));

        const userBalance = userSnap.exists() ? Number((userSnap.data() as { balance?: number }).balance) : NaN;
        const bankBalance = bankSnap.exists() ? Number((bankSnap.data() as { balance?: number }).balance) : NaN;
        const resolvedBalance = Number.isFinite(userBalance) ? userBalance : Number.isFinite(bankBalance) ? bankBalance : 0;

        const normalGoals = await getAllNormalGoalsFirestore(user.uid);
        const goalData = normalGoals.map((g) => ({
          id: g.id,
          name: g.name,
          targetAmount: g.targetAmount,
          currentBalance: g.currentBalance,
        }));

        if (!mounted) return;
        setTransactions(txs);
        setBalance(resolvedBalance);
        setSavingsGoals(goalData);
      } catch {
        if (!mounted) return;
        setTransactions([]);
        setBalance(0);
        setSavingsGoals([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [user?.uid]);

  const transactionsWithDate = useMemo(
    () => transactions.map((tx) => ({
      ...tx,
      parsedDate: toDate(tx.date) || toDate(tx.createdAt),
    })),
    [transactions]
  );

  const expenseTransactions = useMemo(
    () => transactionsWithDate.filter((tx) => tx.parsedDate && isExpense(tx)),
    [transactionsWithDate]
  );

  const now = useMemo(() => new Date(), []);

  const totalSpentThisMonth = useMemo(() => {
    return expenseTransactions.reduce((sum, tx) => {
      const d = tx.parsedDate as Date;
      const sameMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      return sameMonth ? sum + tx.amount : sum;
    }, 0);
  }, [expenseTransactions, now]);

  const totalSaved = useMemo(() => {
    const fromGoals = savingsGoals.reduce((sum, g) => sum + Math.max(0, g.currentBalance || 0), 0);
    if (fromGoals > 0) return fromGoals;

    const credits = transactionsWithDate
      .filter((tx) => tx.type === 'credit' && Number.isFinite(tx.amount) && tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0);
    return credits;
  }, [savingsGoals, transactionsWithDate]);

  const txCount = transactions.length;

  const lineData = useMemo(() => {
    const bucket = new Map<string, number>();
    const now = new Date();

    if (timeRange === '30days') {
      // Last 30 days - group by day
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        bucket.set(getDayKey(d), 0);
      }

      expenseTransactions.forEach((tx) => {
        const d = tx.parsedDate as Date;
        const key = getDayKey(d);
        const rangeStart = new Date(now);
        rangeStart.setDate(now.getDate() - 29);
        rangeStart.setHours(0, 0, 0, 0);
        if (d >= rangeStart) {
          if (bucket.has(key)) {
            bucket.set(key, (bucket.get(key) || 0) + tx.amount);
          }
        }
      });

      return Array.from(bucket.entries()).map(([date, amount]) => ({
        date, // Keep full YYYY-MM-DD for tooltip
        displayDate: date.slice(5), // MM-DD for chart label
        amount,
      }));
    } else if (timeRange === 'week') {
      // Last 7 days - group by day
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        bucket.set(getDayKey(d), 0);
      }

      expenseTransactions.forEach((tx) => {
        const d = tx.parsedDate as Date;
        const rangeStart = new Date(now);
        rangeStart.setDate(now.getDate() - 6);
        rangeStart.setHours(0, 0, 0, 0);
        if (d >= rangeStart) {
          const key = getDayKey(d);
          if (bucket.has(key)) {
            bucket.set(key, (bucket.get(key) || 0) + tx.amount);
          }
        }
      });

      return Array.from(bucket.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, amount]) => ({
          date, // Keep full YYYY-MM-DD for tooltip
          displayDate: date.slice(5), // MM-DD for chart label
          amount,
        }));
    } else if (timeRange === 'month') {
      // Current month - group by week
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 7)) {
        const ws = getWeekStart(d);
        const key = getDayKey(ws);
        bucket.set(key, 0);
      }

      expenseTransactions.forEach((tx) => {
        const d = tx.parsedDate as Date;
        if (d >= monthStart && d <= monthEnd) {
          const ws = getWeekStart(d);
          const key = getDayKey(ws);
          if (bucket.has(key)) {
            bucket.set(key, (bucket.get(key) || 0) + tx.amount);
          }
        }
      });

      return Array.from(bucket.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, amount]) => ({
          date, // Keep full YYYY-MM-DD for tooltip
          displayDate: `W${date.slice(5)}`, // W-MM-DD for chart label
          amount,
        }));
    } else if (timeRange === 'year') {
      // Last 12 months - group by month
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now);
        d.setMonth(now.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        bucket.set(monthKey, 0);
      }

      expenseTransactions.forEach((tx) => {
        const d = tx.parsedDate as Date;
        const rangeStart = new Date(now);
        rangeStart.setFullYear(now.getFullYear() - 1);
        if (d >= rangeStart) {
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (bucket.has(monthKey)) {
            bucket.set(monthKey, (bucket.get(monthKey) || 0) + tx.amount);
          }
        }
      });

      return Array.from(bucket.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, amount]) => ({
          date: month, // Keep full YYYY-MM for tooltip
          displayDate: month.slice(5), // MM for chart label
          amount,
        }));
    } else {
      // All time - group by month
      expenseTransactions.forEach((tx) => {
        const d = tx.parsedDate as Date;
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        bucket.set(monthKey, (bucket.get(monthKey) || 0) + tx.amount);
      });

      return Array.from(bucket.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, amount]) => ({
          date: month, // Keep full YYYY-MM for tooltip
          displayDate: month.slice(5), // MM for chart label
          amount,
        }));
    }
  }, [expenseTransactions, now, timeRange]);

  const pieData = useMemo(() => {
    const map = new Map<string, number>();

    // Filter transactions based on timeRange
    let filteredTxs = expenseTransactions;
    if (timeRange === '30days') {
      const rangeStart = new Date(now);
      rangeStart.setDate(now.getDate() - 29);
      rangeStart.setHours(0, 0, 0, 0);
      filteredTxs = expenseTransactions.filter((tx) => (tx.parsedDate as Date) >= rangeStart);
    } else if (timeRange === 'week') {
      const rangeStart = new Date(now);
      rangeStart.setDate(now.getDate() - 6);
      rangeStart.setHours(0, 0, 0, 0);
      filteredTxs = expenseTransactions.filter((tx) => (tx.parsedDate as Date) >= rangeStart);
    } else if (timeRange === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      filteredTxs = expenseTransactions.filter((tx) => {
        const d = tx.parsedDate as Date;
        return d >= monthStart && d <= monthEnd;
      });
    } else if (timeRange === 'year') {
      const rangeStart = new Date(now);
      rangeStart.setFullYear(now.getFullYear() - 1);
      filteredTxs = expenseTransactions.filter((tx) => (tx.parsedDate as Date) >= rangeStart);
    }
    // For 'all', use all expenseTransactions

    filteredTxs.forEach((tx) => {
      const cat = normalizeCategory(tx.category);
      map.set(cat, (map.get(cat) || 0) + tx.amount);
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenseTransactions, now, timeRange]);

  const totalPieAmount = useMemo(
    () => pieData.reduce((sum, item) => sum + item.value, 0),
    [pieData]
  );

  const weeklyData = useMemo(() => {
    const map = new Map<string, number>();

    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i * 7);
      const ws = getWeekStart(d);
      const key = getDayKey(ws);
      map.set(key, 0);
    }

    expenseTransactions.forEach((tx) => {
      const ws = getWeekStart(tx.parsedDate as Date);
      const key = getDayKey(ws);
      if (map.has(key)) {
        map.set(key, (map.get(key) || 0) + tx.amount);
      }
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, amount]) => ({
        week: weekStart.slice(5),
        amount,
      }));
  }, [expenseTransactions, now]);

  const recentTransactions = useMemo(() => {
    return [...transactionsWithDate]
      .filter((tx) => tx.parsedDate && Number.isFinite(tx.amount))
      .sort((a, b) => (b.parsedDate as Date).getTime() - (a.parsedDate as Date).getTime())
      .slice(0, 10);
  }, [transactionsWithDate]);

  const savingsProgress = useMemo(() => {
    const target = savingsGoals.reduce((sum, g) => sum + Math.max(0, g.targetAmount || 0), 0);
    const current = savingsGoals.reduce((sum, g) => sum + Math.max(0, g.currentBalance || 0), 0);
    const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
    return { target, current, pct };
  }, [savingsGoals]);

  return (
    <AuthGuard>
      <div className='min-h-screen w-full bg-background'>
        <Navbar />
        <main className='px-3 py-4 md:p-8 pt-16 md:pt-20 space-y-4 md:space-y-6'>
          <header>
            <h1 className='text-2xl md:text-4xl font-bold leading-tight'>Financial Analytics</h1>
            <p className='text-sm md:text-base text-muted-foreground mt-1'>Understand your spending behavior with interactive charts.</p>
          </header>

          {loading ? (
            <Card>
              <CardContent className='py-12 flex items-center justify-center gap-2 text-muted-foreground'>
                <Loader2 className='h-5 w-5 animate-spin' />
                Loading analytics...
              </CardContent>
            </Card>
          ) : (
            <>
              <div className='grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4'>
                <Card>
                  <CardHeader className='pb-1 md:pb-2'>
                    <CardTitle className='text-xs md:text-sm font-medium flex items-center justify-between gap-2'>
                      Total Balance
                      <Wallet className='h-4 w-4 text-muted-foreground' />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className='text-base md:text-xl font-bold'>{formatInr(balance)}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className='pb-1 md:pb-2'>
                    <CardTitle className='text-xs md:text-sm font-medium flex items-center justify-between gap-2'>
                      Total Spent (Month)
                      <TrendingDown className='h-4 w-4 text-muted-foreground' />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className='text-base md:text-xl font-bold'>{formatInr(totalSpentThisMonth)}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className='pb-1 md:pb-2'>
                    <CardTitle className='text-xs md:text-sm font-medium flex items-center justify-between gap-2'>
                      Total Saved
                      <PiggyBank className='h-4 w-4 text-muted-foreground' />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className='text-base md:text-xl font-bold'>{formatInr(totalSaved)}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className='pb-1 md:pb-2'>
                    <CardTitle className='text-xs md:text-sm font-medium flex items-center justify-between gap-2'>
                      Transactions
                      <ReceiptText className='h-4 w-4 text-muted-foreground' />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className='text-base md:text-xl font-bold'>{txCount}</p>
                  </CardContent>
                </Card>
              </div>

              <div className='grid grid-cols-1 xl:grid-cols-5 gap-6'>
                <Card className='xl:col-span-3'>
                  <CardHeader>
                    <div className='flex items-center justify-between gap-3'>
                      <div>
                        <CardTitle className='text-base md:text-xl'>Spending Trend</CardTitle>
                        <CardDescription>
                          {timeRange === '30days' && 'Daily spending over the last 30 days'}
                          {timeRange === 'week' && 'Daily spending over the last 7 days'}
                          {timeRange === 'month' && 'Weekly spending for current month'}
                          {timeRange === 'year' && 'Monthly spending over the last 12 months'}
                          {timeRange === 'all' && 'Monthly spending across all time'}
                        </CardDescription>
                      </div>
                      <Select value={timeRange} onValueChange={(val) => setTimeRange(val as typeof timeRange)}>
                        <SelectTrigger className='w-[140px]'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='30days'>Last 30 Days</SelectItem>
                          <SelectItem value='week'>Last Week</SelectItem>
                          <SelectItem value='month'>This Month</SelectItem>
                          <SelectItem value='year'>Last 12 Months</SelectItem>
                          <SelectItem value='all'>All Time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent className='h-[280px] md:h-[340px]'>
                    {lineData.some((x) => x.amount > 0) ? (
                      <ResponsiveContainer width='100%' height='100%'>
                        <LineChart data={lineData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                          <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#374151' />
                          <XAxis 
                            dataKey='displayDate' 
                            tickLine={false} 
                            axisLine={false} 
                            fontSize={10} 
                            interval={timeRange === '30days' ? 5 : timeRange === 'week' ? 0 : 3}
                            tick={{ fill: '#9CA3AF' }}
                          />
                          <YAxis 
                            tickLine={false} 
                            axisLine={false} 
                            fontSize={10} 
                            width={42}
                            tick={{ fill: '#9CA3AF' }}
                          />
                          <Tooltip content={<CustomLineTooltip />} cursor={{ stroke: '#3b82f6', strokeWidth: 2 }} />
                          <Line 
                            type='monotone' 
                            dataKey='amount' 
                            stroke='#3b82f6' 
                            strokeWidth={2.5} 
                            dot={{ fill: '#3b82f6', r: 3 }}
                            activeDot={{ r: 5, fill: '#1e40af' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className='h-full flex items-center justify-center text-muted-foreground'>No spending data available.</div>
                    )}
                  </CardContent>
                </Card>

                <Card className='xl:col-span-2'>
                  <CardHeader>
                    <CardTitle className='text-base md:text-xl'>Category-wise Spending</CardTitle>
                    <CardDescription>
                      {timeRange === '30days' && 'Distribution over last 30 days'}
                      {timeRange === 'week' && 'Distribution over last 7 days'}
                      {timeRange === 'month' && 'Distribution for current month'}
                      {timeRange === 'year' && 'Distribution over last 12 months'}
                      {timeRange === 'all' && 'Distribution across all time'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className='h-[280px] md:h-[340px]'>
                    {pieData.length > 0 ? (
                      <div className='h-full flex flex-col'>
                        <div className='flex-1 min-h-0'>
                          <ResponsiveContainer width='100%' height='100%'>
                            <PieChart>
                              <Pie
                                data={pieData}
                                dataKey='value'
                                nameKey='name'
                                cx='50%'
                                cy='50%'
                                innerRadius={55}
                                outerRadius={95}
                                label={false}
                                labelLine={false}
                              >
                                {pieData.map((_, idx) => (
                                  <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip content={<CustomPieTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        <div className='mt-3 space-y-1.5 max-h-[110px] overflow-y-auto pr-1'>
                          {pieData.map((item, idx) => {
                            const pct = totalPieAmount > 0 ? (item.value / totalPieAmount) * 100 : 0;
                            return (
                              <div key={`${item.name}-${idx}`} className='flex items-center justify-between text-xs'>
                                <div className='flex items-center gap-2 min-w-0'>
                                  <span
                                    className='h-2.5 w-2.5 rounded-full shrink-0'
                                    style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                                  />
                                  <span className='truncate text-muted-foreground'>{item.name}</span>
                                </div>
                                <span className='font-medium shrink-0'>
                                  {formatInr(item.value)} ({pct.toFixed(0)}%)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className='h-full flex items-center justify-center text-muted-foreground'>No category data for this period.</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className='grid grid-cols-1 xl:grid-cols-5 gap-6'>
                <Card className='xl:col-span-2'>
                  <CardHeader>
                    <CardTitle className='text-base md:text-xl'>Weekly Spending</CardTitle>
                    <CardDescription>Compare spending across recent weeks.</CardDescription>
                  </CardHeader>
                  <CardContent className='h-[250px] md:h-[300px]'>
                    {weeklyData.some((x) => x.amount > 0) ? (
                      <ResponsiveContainer width='100%' height='100%'>
                        <BarChart data={weeklyData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                          <CartesianGrid strokeDasharray='3 3' vertical={false} />
                          <XAxis dataKey='week' tickLine={false} axisLine={false} fontSize={10} />
                          <YAxis tickLine={false} axisLine={false} fontSize={10} width={42} />
                          <Tooltip formatter={(value) => [formatInr(Number(value)), 'Spent']} />
                          <Bar dataKey='amount' fill='#10b981' radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className='h-full flex items-center justify-center text-muted-foreground'>No weekly spending data yet.</div>
                    )}
                  </CardContent>
                </Card>

                <Card className='xl:col-span-3'>
                  <CardHeader>
                    <CardTitle className='text-base md:text-xl'>Recent Transactions</CardTitle>
                    <CardDescription>Latest transactions from your accounts.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {recentTransactions.length > 0 ? (
                      <div className='space-y-2'>
                        {recentTransactions.slice(0, showAllTransactions ? recentTransactions.length : 3).map((tx) => {
                          const d = tx.parsedDate as Date;
                          return (
                            <div key={tx.id} className='flex items-center justify-between rounded-md border p-3'>
                              <div className='min-w-0'>
                                <p className='font-medium truncate'>{tx.merchant || 'Unknown Merchant'}</p>
                                <p className='text-xs text-muted-foreground'>
                                  {normalizeCategory(tx.category)} · {d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                              </div>
                              <p className='font-semibold ml-3'>{formatInr(tx.amount)}</p>
                            </div>
                          );
                        })}
                        {recentTransactions.length > 3 && (
                          <div className='pt-2 flex justify-center'>
                            <button
                              onClick={() => setShowAllTransactions(!showAllTransactions)}
                              className='inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors'
                            >
                              {showAllTransactions ? 'Show Less' : 'View More'}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className='py-8 text-center text-muted-foreground'>No transactions found.</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className='text-base md:text-xl'>Savings Progress</CardTitle>
                  <CardDescription>Progress toward your savings goals.</CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                  {savingsGoals.length > 0 ? (
                    <>
                      <div className='flex items-center justify-between text-sm'>
                        <span>{formatInr(savingsProgress.current)} / {formatInr(savingsProgress.target)}</span>
                        <span>{savingsProgress.pct.toFixed(1)}%</span>
                      </div>
                      <Progress value={savingsProgress.pct} />
                    </>
                  ) : (
                    <p className='text-sm text-muted-foreground'>No savings goals found. Create a goal to track progress here.</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}

export default AnalyticsPage;
