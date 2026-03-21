"use client";

import { useEffect, useState, useCallback } from "react";
import type { NormalGoal } from "@/lib/types";
import { getNormalGoalByIdFirestore } from "@/lib/normal-goal-store";
import NormalGoalDetailsClient from "@/components/goals/NormalGoalDetailsClient";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import AuthGuard from "@/components/auth/AuthGuard";
import Navbar from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";

export default function SavingsGoalPage() {
  const params = useParams();
  const { user } = useAuth();
  const id = params.id as string;
  const [goal, setGoal] = useState<NormalGoal | null | undefined>(undefined);

  const refreshGoal = useCallback(async () => {
    if (user && id) {
      const found = await getNormalGoalByIdFirestore(user.uid, id);
      setGoal(found);
    }
  }, [id, user]);

  useEffect(() => {
    refreshGoal();
  }, [refreshGoal]);

  if (goal === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl font-semibold">Goal not found</h2>
          <p className="mt-2 text-muted-foreground">
            This savings goal doesn&apos;t exist or was removed.
          </p>
          <Button asChild className="mt-6">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AuthGuard>
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Navbar />
      <div className="container mx-auto px-4 py-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Link>
        </Button>
        <NormalGoalDetailsClient goal={goal} onGoalUpdate={refreshGoal} />
      </div>
    </div>
    </AuthGuard>
  );
}
