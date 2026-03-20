"use client";

import CreateGoalForm from "@/components/goals/CreateGoalForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, ArrowLeft, Wallet, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useWallet } from "@/contexts/WalletContext";
import AuthGuard from "@/components/auth/AuthGuard";
import { useToast } from "@/hooks/use-toast";

export default function NewGoalPage() {
  const { activeAddress, connectWallet, isConnecting } = useWallet();
  const { toast } = useToast();

  const handleConnectWallet = async () => {
    try {
      await connectWallet();
      toast({ title: "Wallet Connected!" });
    } catch (error) {
      toast({ variant: "destructive", title: "Connection Failed", description: error instanceof Error ? error.message : "Could not connect wallet." });
    }
  };

  return (
    <AuthGuard>
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold">DhanSathi</span>
            </div>
          </div>
          {activeAddress ? (
            <Button variant="outline" size="sm" className="text-xs font-mono">
              <Wallet className="mr-1.5 h-3.5 w-3.5 text-green-500" />
              {`${activeAddress.substring(0, 4)}...${activeAddress.substring(activeAddress.length - 4)}`}
            </Button>
          ) : (
            <Button onClick={handleConnectWallet} disabled={isConnecting} variant="outline" size="sm">
              <Wallet className="mr-2 h-4 w-4" />
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </Button>
          )}
        </div>
      </header>

      <div className="container mx-auto max-w-2xl px-4 py-12">
        <Card className="shadow-lg bg-card border-border">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <Target className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="font-headline text-2xl">🔒 On-Chain Smart Contract Goal</CardTitle>
                <CardDescription>Funds locked on Algorand blockchain. Cannot withdraw until goal is complete. Maximum discipline!</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CreateGoalForm />
          </CardContent>
        </Card>
      </div>
    </div>
    </AuthGuard>
  );
}
