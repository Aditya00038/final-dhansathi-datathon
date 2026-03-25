"use client";

import { useEffect, useState } from "react";
import type { Goal } from "@/lib/types";
import { getGoalByIdFirestore } from "@/lib/local-store";
import GoalDetailsClient from "@/components/goals/GoalDetailsClient";
import Navbar from "@/components/layout/Navbar";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import AuthGuard from "@/components/auth/AuthGuard";

export default function GoalPage() {
  const params = useParams();
  const id = params.id as string;
  const [goal, setGoal] = useState<Goal | null>(null);
  const [isLoadingGoal, setIsLoadingGoal] = useState(true);
  const { user, loading: isAuthLoading } = useAuth();

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
          <Navbar />
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
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <GoalDetailsClient goal={goal} />
        </div>
      </div>
    </AuthGuard>
  );
}
