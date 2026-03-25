"use client";

import CreateGoalForm from "@/components/goals/CreateGoalForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, ArrowLeft } from "lucide-react";
import Link from "next/link";
import AuthGuard from "@/components/auth/AuthGuard";
import Navbar from "@/components/layout/Navbar";

export default function NewGoalPage() {
  return (
    <AuthGuard>
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar />

      <div className="container mx-auto max-w-2xl px-4 py-12">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Link>
        </Button>

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
