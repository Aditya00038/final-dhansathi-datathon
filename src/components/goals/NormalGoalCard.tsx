"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { NormalGoal } from "@/lib/types";
import { ArrowRight, Calendar, CheckCircle2, TrendingUp, TrendingDown, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSavingsPrediction } from "@/lib/normal-goal-store";
import { format } from "date-fns";

type NormalGoalCardProps = {
  goal: NormalGoal;
};

export default function NormalGoalCard({ goal }: NormalGoalCardProps) {
  const progress =
    goal.targetAmount > 0 ? (goal.currentBalance / goal.targetAmount) * 100 : 0;

  const status = goal.goalCompleted ? "completed" : "active";
  const prediction = getSavingsPrediction(goal);

  return (
    <Card className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md border-l-4 border-l-blue-500 border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-semibold">{goal.name}</CardTitle>
            <Badge variant="outline" className="mt-1 text-[10px] bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
              Off-Chain (Flexible)
            </Badge>
          </div>
          <Badge
            variant={status === "completed" ? "default" : "secondary"}
            className={cn(
              status === "completed" && "bg-accent text-accent-foreground"
            )}
          >
            {status === "completed" ? (
              <CheckCircle2 className="mr-1 h-3 w-3" />
            ) : null}
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>
        <CardDescription className="flex items-center pt-1 text-xs text-muted-foreground">
          <Calendar className="mr-1.5 h-3.5 w-3.5" />
          Deadline: {format(new Date(goal.deadline), "PPP")}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-grow space-y-3">
        <div>
          <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{Math.min(100, progress).toFixed(0)}%</span>
          </div>
          <Progress value={Math.min(100, progress)} />
        </div>

        <div className="flex items-end justify-between rounded-lg bg-muted/50 p-2.5">
          <div>
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className="text-lg font-semibold text-primary">
              ₹{goal.currentBalance.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Target</p>
            <p className="text-sm font-medium">
              ₹{goal.targetAmount.toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        {/* AI Prediction Snippet */}
        {!goal.goalCompleted && (
          <div className={cn(
            "flex items-center gap-2 rounded-md p-2 text-xs",
            prediction.onTrack
              ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300"
              : prediction.savingRate > 0
                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                : "bg-muted text-muted-foreground"
          )}>
            {prediction.onTrack ? (
              <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" />
            ) : prediction.savingRate > 0 ? (
              <TrendingDown className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <Clock className="h-3.5 w-3.5 flex-shrink-0" />
            )}
            <span>
              {prediction.savingRate > 0
                ? `Save ₹${Math.ceil(prediction.requiredPerWeek / 7).toLocaleString("en-IN")}/day to stay on track`
                : "Start saving to see predictions"}
            </span>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        <Button asChild className="w-full h-9 text-sm" variant="outline">
          <Link href={`/savings/${goal.id}`}>
            View Details <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
