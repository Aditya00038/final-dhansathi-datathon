"use client";

import { useEffect, useState } from "react";
import type { Goal } from "@/lib/types";
import { getGoalByIdFirestore } from "@/lib/local-store";
import GoalDetailsClient from "@/components/goals/GoalDetailsClient";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Wallet, TrendingUp } from "lucide-react";
import { useParams } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import AuthGuard from "@/components/auth/AuthGuard";
import { useAuth } from "@/contexts/AuthContext";

export default function GoalPage() {
  const params = useParams();
  const id = params.id as string;
  const [goal, setGoal] = useState<Goal | null>(null);
  const [isLoadingGoal, setIsLoadingGoal] = useState(true);
  const { activeAddress, connectWallet, isConnecting } = useWallet();
  const { user, loading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const handleConnectWallet = async () => {
    try {
      await connectWallet();
    } catch {
      toast({ title: "Connection failed", description: "Could not connect wallet.", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!user) {
      setGoal(null);
      setIsLoadingGoal(false);
      return;
    }

    const loadGoal = async () => {
      const found = (await getGoalByIdFirestore(user.uid, id)) || null;
      setGoal(found);
      setIsLoadingGoal(false);
    };

    loadGoal();
  }, [id, user, isAuthLoading]);

  if (isAuthLoading || isLoadingGoal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!goal) {
    return (
      <AuthGuard>
      <div className="min-h-screen bg-background">
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
              <span className="text-xs bg-muted px-3 py-1 rounded-full font-mono">
                {`${activeAddress.substring(0, 6)}...${activeAddress.substring(activeAddress.length - 4)}`}
              </span>
            ) : (
              <Button onClick={handleConnectWallet} variant="outline" size="sm" disabled={isConnecting}>
                <Wallet className="mr-2 h-4 w-4" />
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </Button>
            )}
          </div>
        </header>
        <div className="container mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl font-semibold">Goal not found</h2>
          <p className="mt-2 text-muted-foreground">
            This goal doesn't exist or was removed.
          </p>
          <Button asChild className="mt-6">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
      </AuthGuard>
    );
  }

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
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <GoalDetailsClient goal={goal} />
      </div>
    </div>
    </AuthGuard>
  );
}
