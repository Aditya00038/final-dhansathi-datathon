"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { getGoalOnChainState, depositToGoal, withdrawFromGoal } from "@/lib/blockchain";
import type { OnChainGoal } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wallet, ExternalLink } from "lucide-react";
import Link from "next/link";

const DEMO_APP_ID = 755771019; // Your deployed contract

export default function DemoPage() {
  const { activeAddress, connectWallet, disconnectWallet, signTransactions } = useWallet();
  const { toast } = useToast();
  
  const [onChainGoal, setOnChainGoal] = useState<OnChainGoal | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [lastTxId, setLastTxId] = useState<string | null>(null);

  const fetchOnChainState = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getGoalOnChainState(DEMO_APP_ID);
      setOnChainGoal(data);
      toast({ title: "On-chain state loaded", description: `Total saved: ${(data.totalSaved / 1_000_000).toFixed(6)} ALGO` });
    } catch (error) {
      console.error(error);
      toast({ 
        variant: "destructive", 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to load on-chain data" 
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (DEMO_APP_ID) {
      fetchOnChainState();
    }
  }, [fetchOnChainState]);

  const handleDeposit = async () => {
    if (!activeAddress || !depositAmount) {
      toast({ variant: "destructive", title: "Error", description: "Connect wallet and enter amount" });
      return;
    }

    setIsDepositing(true);
    try {
      toast({ title: "Processing", description: "Check your wallet to approve the transaction" });
      const txId = await depositToGoal(DEMO_APP_ID, activeAddress, parseFloat(depositAmount), signTransactions);
      setLastTxId(txId);
      setDepositAmount("");
      toast({ title: "✅ Deposit Successful!", description: `TxID: ${txId.substring(0, 16)}...` });
      await fetchOnChainState();
    } catch (error) {
      console.error(error);
      toast({ 
        variant: "destructive", 
        title: "Deposit Failed", 
        description: error instanceof Error ? error.message : "An error occurred" 
      });
    } finally {
      setIsDepositing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!activeAddress) {
      toast({ variant: "destructive", title: "Error", description: "Connect your wallet" });
      return;
    }

    setIsWithdrawing(true);
    try {
      toast({ title: "Processing", description: "Check your wallet to approve the withdrawal" });
      const txId = await withdrawFromGoal(DEMO_APP_ID, activeAddress, signTransactions);
      setLastTxId(txId);
      toast({ title: "✅ Withdrawal Successful!", description: `TxID: ${txId.substring(0, 16)}...` });
      await fetchOnChainState();
    } catch (error) {
      console.error(error);
      toast({ 
        variant: "destructive", 
        title: "Withdrawal Failed", 
        description: error instanceof Error ? error.message : "An error occurred" 
      });
    } finally {
      setIsWithdrawing(false);
    }
  };

  const targetAmount = onChainGoal ? (onChainGoal.targetAmount / 1_000_000) : 0;
  const totalSaved = onChainGoal ? (onChainGoal.totalSaved / 1_000_000) : 0;
  const balance = onChainGoal ? (onChainGoal.balance / 1_000_000) : 0;
  const progress = targetAmount > 0 ? (totalSaved / targetAmount) * 100 : 0;
  const canWithdraw = onChainGoal && (onChainGoal.goalCompleted || (Date.now() / 1000 > onChainGoal.deadline));

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>🚀 AlgoSave Demo - Blockchain Testing</span>
            {activeAddress ? (
              <Button onClick={disconnectWallet} variant="outline" size="sm">
                <Wallet className="mr-2 h-4 w-4" />
                {`${activeAddress.substring(0, 6)}...${activeAddress.substring(activeAddress.length - 4)}`}
              </Button>
            ) : (
              <Button onClick={connectWallet} size="sm">
                <Wallet className="mr-2 h-4 w-4" />
                Connect Wallet
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* On-Chain State */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">On-Chain Contract State</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">App ID</p>
                <p className="text-xl font-bold">{DEMO_APP_ID}</p>
                <Badge className="mt-2 text-xs">Network: Testnet</Badge>              <Link 
                href={`https://testnet.explorer.perawallet.app/apps/${DEMO_APP_ID}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-xs mt-2 block"
              >
                View App on Explorer →
              </Link>              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Target Amount</p>
                <p className="text-xl font-bold">{targetAmount.toFixed(6)} ALGO</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Total Saved</p>
                <p className="text-xl font-bold">{totalSaved.toFixed(6)} ALGO</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Progress</p>
                <p className="text-xl font-bold">{progress.toFixed(1)}%</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Contract Balance</p>
                <p className="text-xl font-bold">{balance.toFixed(6)} ALGO</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="text-xl font-bold">{onChainGoal?.goalCompleted ? "✅ Complete" : "🔄 Active"}</p>
              </div>
            </div>

            <Button 
              onClick={fetchOnChainState} 
              disabled={isLoading}
              variant="outline" 
              className="w-full"
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isLoading ? "Refreshing..." : "Refresh On-Chain Data"}
            </Button>
          </div>

          {/* Deposit Section */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="font-semibold text-lg">💰 Make a Deposit</h3>
            <div className="flex gap-2">
              <Input 
                type="number" 
                placeholder="Amount (ALGO)" 
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                step="0.01"
                disabled={!activeAddress || isDepositing}
              />
              <Button 
                onClick={handleDeposit}
                disabled={!activeAddress || isDepositing || !depositAmount}
              >
                {isDepositing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isDepositing ? "..." : "Deposit"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This sends ALGO to the contract and calls the deposit() method in a grouped transaction.
            </p>
          </div>

          {/* Withdraw Section */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="font-semibold text-lg">🏦 Withdraw Funds</h3>
            {canWithdraw ? (
              <Button 
                onClick={handleWithdraw}
                disabled={!activeAddress || isWithdrawing}
                className="w-full"
              >
                {isWithdrawing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isWithdrawing ? "Withdrawing..." : `Withdraw ${balance.toFixed(6)} ALGO`}
              </Button>
            ) : (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  ❌ Withdrawal locked. Complete the goal or wait until the deadline.
                </p>
              </div>
            )}
          </div>

          {/* Transaction Link */}
          {lastTxId && (
            <div className="space-y-4 border-t pt-6">
              <h3 className="font-semibold text-lg">📊 Last Transaction</h3>
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <p className="text-xs font-mono break-all mb-3">{lastTxId}</p>
                  <Link 
                    href={`https://testnet.explorer.perawallet.app/tx/${lastTxId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center text-sm"
                  >
                    View on Pera Explorer <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Info */}
          <div className="border-t pt-6 space-y-2 text-xs text-muted-foreground">
            <p>✅ <strong>Features being tested:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Pera Wallet connection</li>
              <li>Grouped transactions (payment + app call)</li>
              <li>Real wallet signing</li>
              <li>On-chain state reading</li>
              <li>Withdrawal rules enforcement</li>
              <li>Transaction explorer links</li>
            </ul>
            <p className="mt-4 text-yellow-700 bg-yellow-50 p-2 rounded">
              📝 <strong>Note:</strong> Transaction links work immediately. App details on explorer may take 1-2 minutes to appear after first interaction.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
