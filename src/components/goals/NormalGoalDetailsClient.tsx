'use client';

import type { NormalGoal } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Calendar, Target, PiggyBank, CheckCircle2, History,
  Bot, Milestone, Wallet as WalletIcon, TrendingUp, TrendingDown,
  ArrowUpRight, ArrowDownRight, Sparkles, Shield, Clock, AlertTriangle,
  Banknote, Brain,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useState, useMemo, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  withdrawFromNormalGoalFirestore,
  updateNormalGoalFinancialsFirestore,
  getSavingsPrediction,
  getAIGoalAdvice,
} from '@/lib/normal-goal-store';
import GoalAdviceAgent from './GoalAdviceAgent';
import { NormalGoalDepositDialog } from './NormalGoalDepositDialog';
import { useBankBalance } from '@/hooks/useBankBalance';
import { useAuth } from '@/contexts/AuthContext';

type NormalGoalDetailsProps = {
  goal: NormalGoal;
  onGoalUpdate: () => void;
};

export default function NormalGoalDetailsClient({ goal, onGoalUpdate }: NormalGoalDetailsProps) {
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawNote, setWithdrawNote] = useState('');
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [showFinancials, setShowFinancials] = useState(false);
  const [incomeInput, setIncomeInput] = useState(goal.monthlyIncome?.toString() || '');
  const [spendingInput, setSpendingInput] = useState(goal.monthlySpending?.toString() || '');
  const { toast } = useToast();
  const { updateBalance } = useBankBalance();
  const { user } = useAuth();

  useEffect(() => {
    setIncomeInput(goal.monthlyIncome?.toString() || '');
    setSpendingInput(goal.monthlySpending?.toString() || '');
  }, [goal]);

  const prediction = useMemo(() => getSavingsPrediction(goal), [goal]);

  const aiAdvice = useMemo(() => getAIGoalAdvice(goal), [goal]);

  const progress = goal.targetAmount > 0
    ? Math.min(100, (goal.currentBalance / goal.targetAmount) * 100)
    : 0;

  const status = goal.goalCompleted ? 'completed' : 'active';

  const sortedTransactions = useMemo(() =>
    [...goal.transactions].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ), [goal.transactions]);

  const handleWithdraw = async () => {
    if (!user) return;

    const amt = parseFloat(withdrawAmount);
    if (!amt || amt <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Enter a positive amount.' });
      return;
    }
    if (amt > goal.currentBalance) {
      toast({ variant: 'destructive', title: 'Insufficient Balance', description: `You only have ₹${goal.currentBalance.toLocaleString('en-IN')}.` });
      return;
    }
    const result = await withdrawFromNormalGoalFirestore(user.uid, goal.id, amt, withdrawNote || undefined);
    if (!result) {
      toast({ variant: 'destructive', title: 'Withdraw Failed', description: 'Unable to withdraw from this goal right now.' });
      return;
    }

    // Refresh goal UI immediately; bank sync should not block progress updates.
    onGoalUpdate();

    try {
      await updateBalance(amt);
      toast({ title: 'Withdrawn', description: `₹${amt.toLocaleString('en-IN')} withdrawn from \'${goal.name}\'.` });
    } catch {
      toast({
        title: 'Withdrawn',
        description: `₹${amt.toLocaleString('en-IN')} withdrawn from \'${goal.name}\'. Bank balance sync failed; retry after reconnect.`,
      });
    }

    setWithdrawAmount('');
    setWithdrawNote('');
    setIsWithdrawOpen(false);
  };

  const handleSaveFinancials = async () => {
    if (!user) return;
    await updateNormalGoalFinancialsFirestore(user.uid, goal.id, {
      monthlyIncome: incomeInput ? parseFloat(incomeInput) : undefined,
      monthlySpending: spendingInput ? parseFloat(spendingInput) : undefined,
    });
    toast({ title: 'Financials Updated', description: 'AI advice will now be more personalized.' });
    onGoalUpdate();
    setShowFinancials(false);
  };

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <div className='flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <div className='flex items-center gap-2'>
                <CardTitle className='font-headline text-3xl'>{goal.name}</CardTitle>
                <Badge variant='outline' className='text-[10px] bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'>
                  💰 Off-Chain (Flexible)
                </Badge>
              </div>
              <CardDescription className='mt-2 flex items-center text-base'>
                <Calendar className='mr-2 h-4 w-4' />
                Deadline: {format(new Date(goal.deadline), 'PPP')}
              </CardDescription>
            </div>
            <Badge
              variant={status === 'completed' ? 'default' : 'secondary'}
              className={cn(
                'py-2 px-4 text-sm',
                status === 'completed' && 'bg-accent text-accent-foreground'
              )}
            >
              {status === 'completed' && <CheckCircle2 className='mr-1 h-4 w-4' />}
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='space-y-2'>
            <div className='flex justify-between text-sm'>
              <span>₹{goal.currentBalance.toLocaleString('en-IN')} / ₹{goal.targetAmount.toLocaleString('en-IN')}</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <Progress value={progress} />
          </div>

          <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
            <div className='flex items-center gap-4 rounded-lg border p-4'>
              <Target className='h-8 w-8 text-primary' />
              <div>
                <p className='text-sm text-muted-foreground'>Target</p>
                <p className='text-lg font-semibold'>₹{goal.targetAmount.toLocaleString('en-IN')}</p>
              </div>
            </div>
            <div className='flex items-center gap-4 rounded-lg border p-4'>
              <Banknote className='h-8 w-8 text-green-600' />
              <div>
                <p className='text-sm text-muted-foreground'>Balance</p>
                <p className='text-lg font-semibold text-green-600'>₹{goal.currentBalance.toLocaleString('en-IN')}</p>
              </div>
            </div>
            <div className='flex items-center gap-4 rounded-lg border p-4'>
              <Milestone className='h-8 w-8 text-yellow-500' />
              <div>
                <p className='text-sm text-muted-foreground'>Remaining</p>
                <p className='text-lg font-semibold'>
                  ₹{Math.max(0, goal.targetAmount - goal.currentBalance).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            <NormalGoalDepositDialog goalId={goal.id} goalName={goal.name} onDepositSuccess={onGoalUpdate} />
            <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
              <DialogTrigger asChild>
                <Button variant='outline' className='w-full' size='lg' disabled={goal.currentBalance <= 0}>
                  <WalletIcon className='mr-2 h-5 w-5' /> Withdraw
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Withdraw from '{goal.name}'</DialogTitle>
                  <DialogDescription>
                    You can withdraw anytime, but staying disciplined helps you reach your goal!
                  </DialogDescription>
                </DialogHeader>
                <div className='rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800'>
                  <div className='flex items-center gap-2 font-semibold mb-1'>
                    <AlertTriangle className='h-4 w-4' /> Are you sure?
                  </div>
                  <p>
                    Withdrawing will slow your progress. You\'ve saved ₹{goal.currentBalance.toLocaleString('en-IN')} so far — 
                    keep going! Consider using our <Link href='/goals/new' className='text-primary underline font-medium'>Smart Contract Goal</Link> to 
                    lock funds and stay disciplined.
                  </p>
                </div>
                <div className='space-y-4'>
                  <div>
                    <Label>Amount (₹)</Label>
                    <Input
                      type='number'
                      placeholder={`Max: ₹${goal.currentBalance.toLocaleString('en-IN')}`}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Reason (optional)</Label>
                    <Input
                      placeholder='e.g., Emergency'
                      value={withdrawNote}
                      onChange={(e) => setWithdrawNote(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleWithdraw} variant='destructive' className='w-full'>
                    Withdraw ₹{withdrawAmount || '0'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {!goal.goalCompleted && goal.currentBalance > 0 && (
            <Card className='border-dashed border-primary/30 bg-primary/5'>
              <CardContent className='p-4'>
                <div className='flex items-start gap-3'>
                  <Shield className='h-5 w-5 text-primary mt-0.5 flex-shrink-0' />
                  <div>
                    <p className='text-sm font-medium'>
                      Want to lock your savings and remove temptation?
                    </p>
                    <p className='text-xs text-muted-foreground mt-1'>
                      With <strong>Smart Contract Goals</strong>, your funds are locked on the blockchain.
                      You cannot withdraw until your goal is complete or the deadline passes. True discipline!
                    </p>
                    <Button variant='link' size='sm' className='px-0 mt-1 h-auto text-xs' asChild>
                      <Link href='/goals/new'>Try Smart Contract Goal →</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
        <div className='space-y-6 lg:col-span-2'>
          <Card className='border-primary/20'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Brain className='h-5 w-5 text-primary' />
                Smart AI Goal Advisor
                <Badge className='bg-primary/10 text-primary border-primary/20 text-[10px]'>AI</Badge>
              </CardTitle>
              <CardDescription>
                Personalized savings recommendation based on your income, spending, balance & deadline.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='rounded-lg bg-muted/50 p-4 text-sm leading-relaxed whitespace-pre-line'>
                {aiAdvice}
              </div>
              <Button variant='outline' size='sm' onClick={() => setShowFinancials(!showFinancials)}>
                <Sparkles className='mr-2 h-4 w-4' />
                {showFinancials ? 'Hide' : 'Update'} Income & Spending
              </Button>
              {showFinancials && (
                <div className='rounded-lg border p-4 space-y-3'>
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                    <div>
                      <Label className='text-xs'>Monthly Income (₹)</Label>
                      <Input
                        type='number'
                        value={incomeInput}
                        onChange={(e) => setIncomeInput(e.target.value)}
                        placeholder='e.g., 30000'
                      />
                    </div>
                    <div>
                      <Label className='text-xs'>Monthly Spending (₹)</Label>
                      <Input
                        type='number'
                        value={spendingInput}
                        onChange={(e) => setSpendingInput(e.target.value)}
                        placeholder='e.g., 20000'
                      />
                    </div>
                  </div>
                  <Button size='sm' onClick={handleSaveFinancials}>Save & Recalculate</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <TrendingUp className='h-5 w-5' />
                Auto-Savings Prediction Engine
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4'>
                <div className='rounded-lg border p-3 text-center'>
                  <p className='text-xs text-muted-foreground mb-1'>Required / Week</p>
                  <p className='text-xl font-bold text-primary'>
                    ₹{prediction.requiredPerWeek.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className='rounded-lg border p-3 text-center'>
                  <p className='text-xs text-muted-foreground mb-1'>Required / Month</p>
                  <p className='text-xl font-bold'>
                    ₹{Math.ceil(prediction.requiredPerMonth).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className='rounded-lg border p-3 text-center'>
                  <p className='text-xs text-muted-foreground mb-1'>Weeks Left</p>
                  <p className='text-xl font-bold'>{prediction.weeksLeft}</p>
                </div>
              </div>

              <div className={cn(
                'rounded-lg p-4 text-sm',
                prediction.onTrack
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : prediction.savingRate > 0
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-muted text-muted-foreground'
              )}>
                <div className='flex items-center gap-2 mb-1 font-medium'>
                  {prediction.onTrack ? (
                    <TrendingUp className='h-4 w-4' />
                  ) : prediction.savingRate > 0 ? (
                    <TrendingDown className='h-4 w-4' />
                  ) : (
                    <Clock className='h-4 w-4' />
                  )}
                  Prediction
                </div>
                <p>{prediction.message}</p>
                {prediction.savingRate > 0 && (
                  <p className='mt-2 text-xs opacity-80'>
                    Current saving rate: ₹{Math.round(prediction.savingRate).toLocaleString('en-IN')}/week
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='flex items-center'><History className='mr-2' /> Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              {sortedTransactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className='text-right'>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTransactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className='text-sm'>
                          {format(new Date(tx.timestamp), 'dd MMM yyyy, hh:mm a')}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant='outline'
                            className={cn(
                              'text-xs',
                              tx.type === 'deposit'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            )}
                          >
                            {tx.type === 'deposit' ? (
                              <ArrowUpRight className='mr-1 h-3 w-3' />
                            ) : (
                              <ArrowDownRight className='mr-1 h-3 w-3' />
                            )}
                            {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className={cn(
                          'font-medium',
                          tx.type === 'deposit' ? 'text-green-600' : 'text-red-600'
                        )}>
                          {tx.type === 'deposit' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className='text-right text-sm text-muted-foreground'>
                          {tx.note || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className='text-center text-muted-foreground py-4'>No transactions yet. Make your first deposit!</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center text-lg'>
                <Banknote className='mr-2 h-5 w-5' /> Account Balance
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='text-center'>
                <p className='text-3xl font-bold text-green-600'>
                  ₹{goal.currentBalance.toLocaleString('en-IN')}
                </p>
                <p className='text-xs text-muted-foreground mt-1'>Available balance</p>
              </div>
              <div className='flex justify-between text-sm pt-2 border-t'>
                <span className='text-muted-foreground'>Total deposited</span>
                <span className='font-medium text-green-600'>
                  ₹{goal.transactions
                    .filter(t => t.type === 'deposit')
                    .reduce((s, t) => s + t.amount, 0)
                    .toLocaleString('en-IN')}
                </span>
              </div>
              <div className='flex justify-between text-sm'>
                <span className='text-muted-foreground'>Total withdrawn</span>
                <span className='font-medium text-red-600'>
                  ₹{goal.transactions
                    .filter(t => t.type === 'withdrawal')
                    .reduce((s, t) => s + t.amount, 0)
                    .toLocaleString('en-IN')}
                </span>
              </div>
            </CardContent>
          </Card>

          {(goal.monthlyIncome || goal.monthlySpending) && (
            <Card>
              <CardHeader>
                <CardTitle className='text-lg flex items-center'>
                  <Bot className='mr-2 h-5 w-5' /> Your Financials
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-2 text-sm'>
                {goal.monthlyIncome && (
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Monthly Income</span>
                    <span className='font-medium'>₹{goal.monthlyIncome.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {goal.monthlySpending && (
                  <div className='flex justify-between'>
                    <span className='text-muted-foreground'>Monthly Spending</span>
                    <span className='font-medium'>₹{goal.monthlySpending.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {goal.monthlyIncome && goal.monthlySpending && (
                  <div className='flex justify-between pt-2 border-t font-medium'>
                    <span>Savings Capacity</span>
                    <span className={cn(
                      goal.monthlyIncome - goal.monthlySpending > 0 ? 'text-green-600' : 'text-red-600'
                    )}>
                      ₹{(goal.monthlyIncome - goal.monthlySpending).toLocaleString('en-IN')}/mo
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <GoalAdviceAgent
            goalName={goal.name}
            targetAmount={goal.targetAmount}
            currentSaved={goal.currentBalance}
            deadline={goal.deadline}
            currency='INR'
            monthlyIncome={goal.monthlyIncome}
            monthlySpending={goal.monthlySpending}
          />
        </div>
      </div>
    </div>
  );
}
