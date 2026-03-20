"use client";

import CreateNormalGoalForm from "@/components/goals/CreateNormalGoalForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PiggyBank, ArrowLeft, TrendingUp, Shield, Sparkles } from "lucide-react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import { useWallet } from "@/contexts/WalletContext";
import AuthGuard from "@/components/auth/AuthGuard";

export default function NewSavingsGoalPage() {
  return (
    <AuthGuard>
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar />

      <div className="container mx-auto max-w-2xl px-4 py-8">
        {/* Goal Type Header */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Link>
          </Button>
        </div>

        <Card className="shadow-lg bg-card border-border mb-6">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
                <PiggyBank className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="font-headline text-2xl">💰 Off-Chain Savings Goal</CardTitle>
                <CardDescription>
                  Flexible savings in INR. Deposit & withdraw anytime. Perfect for everyday goals with AI-powered tracking.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CreateNormalGoalForm />
          </CardContent>
        </Card>

        {/* Upsell to Smart Contract */}
        <Card className="border-dashed border-primary/40 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0 mt-0.5">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-1.5">
                  Need maximum discipline? 🔒
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Try our <strong>On-Chain Goal</strong> — your funds are locked on the Algorand blockchain and
                  cannot be withdrawn until your goal is complete. No temptation, no excuses!
                </p>
                <Button variant="link" size="sm" className="px-0 mt-1 h-auto text-xs" asChild>
                  <Link href="/goals/new">Create On-Chain Goal →</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </AuthGuard>
  );
}
