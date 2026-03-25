"use client";

import type { Goal, OnChainGoal, GoalWithOnChainData, AchievementNFT } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDateFromTimestamp, microAlgosToAlgos, toDate } from '@/lib/utils';
import { Calendar, Target, PiggyBank, CheckCircle2, History, Milestone, Wallet, AlertTriangle, ExternalLink, HeartPulse, Lock, ShieldAlert, Sparkles } from 'lucide-react';
import { DepositDialog } from './DepositDialog';
import { SavingsChart } from './SavingsChart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { getGoalOnChainState, withdrawFromGoal, mintAchievementNFT } from '@/lib/blockchain';
import { useWallet } from '@/contexts/WalletContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { calculateFinancialHealth } from '@/lib/financial-health';
import { FinancialHealthIndicator } from './FinancialHealthIndicator';
import { getGoalByIdFirestore, saveNFT, getNFTByGoalId } from '@/lib/local-store';
import GoalAdviceAgent from './GoalAdviceAgent';
import { useBankBalance } from '@/hooks/useBankBalance';
import { useAuth } from '@/contexts/AuthContext';

type GoalDetailsClientProps = {
  goal: Goal;
};

export default function GoalDetailsClient({ goal: initialGoal }: GoalDetailsClientProps) {
  const [goal, setGoal] = useState(initialGoal);
  const [onChainGoal, setOnChainGoal] = useState<OnChainGoal | null>(null);
  const [isFetchingOnChain, setIsFetchingOnChain] = useState(true);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [latestTxId, setLatestTxId] = useState<string | null>(null);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [achievementNFT, setAchievementNFT] = useState<AchievementNFT | null>(null);
  const [isMintingNFT, setIsMintingNFT] = useState(false);

  const { activeAddress, signTransactions, connectWallet, isConnecting } = useWallet();
  const { user } = useAuth();
  const { toast } = useToast();
  const { updateBalance } = useBankBalance();

  const handleConnectWallet = useCallback(async () => {
    try {
      await connectWallet();
      toast({ title: 'Wallet Connected', description: 'Pera wallet connected successfully.' });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: 'Could not connect Pera wallet. Please try again.',
      });
    }
  }, [connectWallet, toast]);

  const fetchOnChainData = useCallback(async () => {
    if (!user) return;
    setIsFetchingOnChain(true);
    try {
      const data = await getGoalOnChainState(goal.appId);
      setOnChainGoal(data);
      
      const updatedGoal = await getGoalByIdFirestore(user.uid, goal.id);
      if (updatedGoal) {
        setGoal(updatedGoal);

        if (updatedGoal.deposits && updatedGoal.deposits.length > 0) {
          const sortedDeposits = [...updatedGoal.deposits].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setLatestTxId(sortedDeposits[0].txId);
        }
      }

      const existingNFT = getNFTByGoalId(user.uid, goal.id);
      if (existingNFT) setAchievementNFT(existingNFT);
      
    } catch (error) {
      console.error("Failed to fetch on-chain data:", error);
      toast({ variant: 'destructive', title: "Error", description: "Could not load on-chain goal data." });
    } finally {
      setIsFetchingOnChain(false);
    }
  }, [goal.appId, goal.id, toast, user]);

  useEffect(() => {
    if (user) {
        fetchOnChainData();
    }
  }, [fetchOnChainData, user]);

  const fullGoalData: GoalWithOnChainData | null = useMemo(() => {
    if (!onChainGoal) return null;
    return { ...goal, onChain: onChainGoal };
  }, [goal, onChainGoal]);
  
  const { score: healthScore, feedback: healthFeedback } = useMemo(() => {
      if (!fullGoalData) return { score: 0, feedback: [] };
      return calculateFinancialHealth(fullGoalData);
  }, [fullGoalData]);

  const handleWithdraw = async () => {
    if (!activeAddress || !onChainGoal) {
      toast({ variant: 'destructive', title: "Cannot Withdraw", description: "Please connect your wallet." });
      return;
    }
    setIsWithdrawing(true);
    try {
      toast({ title: "Processing Withdrawal", description: "Please check your wallet to approve." });
      const withdrawAmount = microAlgosToAlgos(onChainGoal.balance);
      const txId = await withdrawFromGoal(goal.appId, activeAddress, signTransactions);
      await updateBalance(withdrawAmount);
      toast({ title: "Withdrawal Successful!", description: `TxID: ${txId.substring(0, 10)}...` });
      setLatestTxId(txId);
      await fetchOnChainData();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Withdrawal Failed", description: error instanceof Error ? error.message : "An unknown error occurred." });
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleMintNFT = async () => {
    if (!activeAddress || !onChainGoal || !user) {
      toast({ variant: 'destructive', title: "Cannot Mint NFT", description: "Please connect your wallet and log in." });
      return;
    }
    setIsMintingNFT(true);
    try {
      toast({ title: "Minting Achievement NFT", description: "Please approve the transaction in your wallet." });
      const { asaId, txId } = await mintAchievementNFT(
        activeAddress,
        {
          goalName: goal.name,
          targetAmount: onChainGoal.targetAmount,
          totalSaved: onChainGoal.totalSaved,
          appId: goal.appId,
        },
        signTransactions
      );
      const nft: AchievementNFT = {
        asaId,
        txId,
        goalId: goal.id,
        goalName: goal.name,
        targetAmount: onChainGoal.targetAmount,
        totalSaved: onChainGoal.totalSaved,
        appId: goal.appId,
        mintedAt: new Date().toISOString(),
      };
      saveNFT(user.uid, nft);
      setAchievementNFT(nft);
      toast({ title: "🎉 Achievement NFT Minted!", description: `ASA ID: ${asaId}. Permanent on-chain proof of your achievement!` });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "NFT Minting Failed", description: error instanceof Error ? error.message : "An unknown error occurred." });
    } finally {
      setIsMintingNFT(false);
    }
  };


  if (!user) {
      return (
          <Card className="text-center p-8">
            <CardHeader>
              <CardTitle className="flex items-center justify-center"><AlertTriangle className="mr-2 text-destructive" /> Please Log In</CardTitle>
            </CardHeader>
            <CardContent>
              <p>You need to be logged in to view your goals.</p>
            </CardContent>
          </Card>
      )
  }

  if (isFetchingOnChain) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!onChainGoal || !fullGoalData) {
    return (
      <Card className="text-center p-8">
        <CardHeader>
          <CardTitle className="flex items-center justify-center"><AlertTriangle className="mr-2 text-destructive" /> Failed to Load Goal</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Could not load the on-chain data for this goal. The contract may not be accessible or there might be a network issue.</p>
          <Button onClick={fetchOnChainData} className="mt-4">Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const targetAmount = microAlgosToAlgos(onChainGoal.targetAmount);
  const currentSaved = microAlgosToAlgos(onChainGoal.totalSaved);
  const progress = targetAmount > 0 ? (currentSaved / targetAmount) * 100 : 0;
  const status = onChainGoal.goalCompleted ? "completed" : "active";
  
  const sortedDeposits = Array.isArray(goal.deposits) ? [...goal.deposits].sort((a, b) => {
      const dateA = toDate(a.timestamp).getTime();
      const dateB = toDate(b.timestamp).getTime();
      return dateB - dateA;
  }) : [];

  const canWithdraw = onChainGoal.goalCompleted || (onChainGoal.deadline > 0 && Date.now() / 1000 > onChainGoal.deadline);


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="font-headline text-3xl">{goal.name}</CardTitle>
                <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                  🔒 On-Chain (Locked)
                </Badge>
              </div>
              <CardDescription className="mt-2 flex items-center text-base">
                <Calendar className="mr-2 h-4 w-4" />
                Deadline: {formatDateFromTimestamp(onChainGoal.deadline)}
              </CardDescription>
               <div className="mt-1 flex items-center text-xs text-muted-foreground">
                 <Badge variant="outline">App ID: {goal.appId}</Badge>
                 <Badge variant="outline" className="ml-2">Network: Testnet</Badge>
              </div>
            </div>
             <Badge
              variant={status === 'completed' ? 'default' : 'secondary'}
              className={cn(
                'py-2 px-4 text-sm',
                status === 'completed' && 'bg-accent text-accent-foreground'
              )}
            >
              {status === 'completed' ? (
                <CheckCircle2 className="mr-1 h-4 w-4" />
              ) : null}
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between font-mono text-sm">
              <span>{formatCurrency(currentSaved)} / {formatCurrency(targetAmount)}</span>
              <span>{progress.toFixed(2)}%</span>
            </div>
            <Progress value={progress} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex items-center gap-4 rounded-lg border p-4">
                  <Target className="h-8 w-8 text-primary" />
                  <div>
                      <p className="text-sm text-muted-foreground">Target</p>
                      <p className="text-lg font-semibold">{formatCurrency(targetAmount)}</p>
                  </div>
              </div>
              <div className="flex items-center gap-4 rounded-lg border p-4">
                  <PiggyBank className="h-8 w-8 text-accent" />
                  <div>
                      <p className="text-sm text-muted-foreground">Saved</p>
                      <p className="text-lg font-semibold">{formatCurrency(currentSaved)}</p>
                  </div>
              </div>
              <div className="flex items-center gap-4 rounded-lg border p-4">
                  <Milestone className="h-8 w-8 text-yellow-500" />
                  <div>
                      <p className="text-sm text-muted-foreground">Remaining</p>
                      <p className="text-lg font-semibold">{formatCurrency(Math.max(0, targetAmount - currentSaved))}</p>
                  </div>
              </div>
          </div>
           {status !== 'completed' && <DepositDialog goalId={goal.id} goalName={goal.name} appId={goal.appId} onDepositSuccess={fetchOnChainData} />}
           
           {!canWithdraw && onChainGoal.balance > 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
                <CardHeader className="flex-row items-center gap-4 space-y-0 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                        <ShieldAlert className="h-6 w-6" />
                    </div>
                    <div>
                        <CardTitle className="text-lg text-destructive">Smart Contract Vault — Locked</CardTitle>
                        <CardDescription className="text-xs">
                            Withdrawal is restricted by the on-chain smart contract.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                    <div className="rounded-md bg-destructive/10 p-3 border border-destructive/20">
                        <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                            <Lock className="h-4 w-4" />
                            Without completing your goal, you cannot withdraw your funds.
                        </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        The smart contract enforces your savings discipline. Your funds are securely locked on-chain and will only be released when:
                    </p>
                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                        <li>You reach your savings target of <strong>{formatCurrency(targetAmount)}</strong></li>
                        <li>Or the deadline passes: <strong>{formatDateFromTimestamp(onChainGoal.deadline)}</strong></li>
                    </ul>
                    <p className="text-xs text-muted-foreground italic">
                        This is <strong>Discipline-as-a-Service</strong> — stay committed and achieve your goal! 💪
                    </p>
                </CardContent>
            </Card>
           )}

           {canWithdraw && onChainGoal.balance > 0 && (
            !activeAddress ? (
              <Button onClick={handleConnectWallet} className="w-full" variant="outline" disabled={isConnecting}>
                <Wallet className="mr-2 h-4 w-4" />
                {isConnecting ? 'Connecting Wallet...' : 'Connect Pera Wallet to Withdraw'}
              </Button>
            ) : (
              <AlertDialog open={showWithdrawConfirm} onOpenChange={setShowWithdrawConfirm}>
                <AlertDialogTrigger asChild>
                  <Button disabled={isWithdrawing} className="w-full" variant="outline">
                    {isWithdrawing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2" />}
                    {isWithdrawing ? "Withdrawing..." : `Withdraw ${formatCurrency(microAlgosToAlgos(onChainGoal.balance))}`}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                        <ShieldAlert className="h-5 w-5" />
                      </div>
                      <AlertDialogTitle>Smart Contract Withdrawal</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3">
                        <p>
                          You are about to withdraw <strong>{formatCurrency(microAlgosToAlgos(onChainGoal.balance))}</strong> from your smart contract vault.
                        </p>
                        <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-3 border border-amber-200 dark:border-amber-800">
                          <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                            ⚠️ Please confirm you understand:
                          </p>
                          <ul className="text-sm text-amber-700 dark:text-amber-300 list-disc list-inside mt-1 space-y-1">
                            <li>This action will release all locked funds from the smart contract</li>
                            <li>The smart contract vault cannot be reversed once withdrawn</li>
                            <li>Your goal progress will be reset to zero</li>
                          </ul>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Are you sure you want to proceed with the withdrawal?
                        </p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        setShowWithdrawConfirm(false);
                        handleWithdraw();
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Yes, Withdraw Funds
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )
           )}
        </CardContent>
      </Card>
      
      {latestTxId && (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span>Last Transaction</span>
                     <Link href={`https://testnet.explorer.perawallet.app/tx/${latestTxId}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center text-xs">
                        View on Explorer <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
                </CardTitle>
            </CardHeader>
            <CardContent>
                 <p className="text-xs font-mono break-all bg-muted p-2 rounded-md">{latestTxId}</p>
            </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
           <Card>
            <CardHeader>
              <CardTitle className="flex items-center"><Milestone className="mr-2" /> Savings Journey</CardTitle>
            </CardHeader>
            <CardContent>
              <SavingsChart goal={goal} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center"><History className="mr-2"/> Deposit History</CardTitle>
            </CardHeader>
            <CardContent>
              {sortedDeposits.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="text-right">Transaction ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedDeposits.map((deposit, index) => (
                      <TableRow key={index}>
                        <TableCell>{formatDateFromTimestamp(deposit.timestamp)}</TableCell>
                        <TableCell>{formatCurrency(deposit.amount)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          <Link href={`https://testnet.explorer.perawallet.app/tx/${deposit.txId}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" title={deposit.txId}>
                            {deposit.txId.substring(0, 12)}...
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground">No deposits made yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><HeartPulse className="mr-2" /> Financial Health</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">{healthScore}</span>
                    <span className="text-muted-foreground">/ 100</span>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                    {healthFeedback.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
            </CardContent>
          </Card>

          {onChainGoal.goalCompleted && (
            <Card className="border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20">
              <CardHeader>
                <CardTitle className="flex items-center text-yellow-700 dark:text-yellow-400">
                  <Sparkles className="mr-2 h-5 w-5" /> ARC-3 Achievement NFT
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {achievementNFT ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-700">NFT Minted On-Chain</span>
                    </div>
                    <p className="text-muted-foreground">
                      <span className="font-medium">ASA ID:</span>{" "}
                      <Link
                        href={`https://testnet.explorer.perawallet.app/asset/${achievementNFT.asaId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline font-mono"
                      >
                        {achievementNFT.asaId}
                      </Link>
                    </p>
                    <p className="text-muted-foreground">
                      <span className="font-medium">Mint TxID:</span>{" "}
                      <Link
                        href={`https://testnet.explorer.perawallet.app/tx/${achievementNFT.txId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline font-mono text-xs"
                      >
                        {achievementNFT.txId.substring(0, 16)}...
                      </Link>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Minted: {new Date(achievementNFT.mintedAt).toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Goal completed! Mint a unique ARC-3 compliant NFT as permanent on-chain proof of your achievement. 🎉
                    </p>
                    <Button
                      onClick={activeAddress ? handleMintNFT : handleConnectWallet}
                      disabled={isMintingNFT || isConnecting}
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
                    >
                      {isMintingNFT ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Minting NFT...</>
                      ) : isConnecting ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting Wallet...</>
                      ) : !activeAddress ? (
                        <><Wallet className="mr-2 h-4 w-4" /> Connect Pera Wallet</>
                      ) : (
                        <><Sparkles className="mr-2 h-4 w-4" /> Mint Achievement NFT</>
                      )}
                    </Button>
                    {!activeAddress && (
                      <p className="text-center text-xs text-muted-foreground">Connect your wallet to mint.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <GoalAdviceAgent
            goalName={goal.name}
            targetAmount={targetAmount}
            currentSaved={currentSaved}
            deadline={onChainGoal.deadline > 0 ? new Date(onChainGoal.deadline * 1000).toISOString() : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()}
            currency="ALGO"
          />
        </div>
      </div>
    </div>
  );
}
