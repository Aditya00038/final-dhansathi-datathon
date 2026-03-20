import { Loader2, RefreshCw, Shield, PiggyBank } from "lucide-react";
import GoalCard from "@/components/goals/GoalCard";
import NormalGoalCard from "@/components/goals/NormalGoalCard";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { GoalWithOnChainData, NormalGoal } from "@/lib/types";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface GoalsListProps {
  goals: GoalWithOnChainData[];
  normalGoals: NormalGoal[];
  isLoading: boolean;
  loadGoals: () => void;
}

type TabType = "all" | "savings" | "contract";

export default function GoalsList({ goals, normalGoals, isLoading, loadGoals }: GoalsListProps) {
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const totalGoals = goals.length + normalGoals.length;

  const tabs: { key: TabType; label: string; count: number; icon?: typeof PiggyBank }[] = [
    { key: "all", label: "All", count: totalGoals },
    { key: "savings", label: "Off-Chain", count: normalGoals.length, icon: PiggyBank },
    { key: "contract", label: "On-Chain", count: goals.length, icon: Shield },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg md:text-xl font-semibold">Your Goals</h2>
        <div className="flex items-center gap-1.5">
          <Button onClick={loadGoals} variant="ghost" size="icon" disabled={isLoading} className="h-8 w-8">
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
          <Button asChild size="sm" className="h-8 text-xs">
            <Link href="/savings/new">
              <PiggyBank className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline">Save</span>
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 text-xs">
            <Link href="/goals/new">
              <Shield className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lock</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Tab filters */}
      {totalGoals > 0 && (
        <div className="flex gap-1 p-1 rounded-lg bg-muted/50 w-fit mb-5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                activeTab === tab.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.icon && <tab.icon className="h-3 w-3" />}
              {tab.label}
              <span className="ml-0.5 text-[10px] opacity-60">{tab.count}</span>
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Loading goals...</p>
        </div>
      ) : totalGoals > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(activeTab === "all" || activeTab === "savings") &&
            normalGoals.map((goal) => <NormalGoalCard key={goal.id} goal={goal} />)}
          {(activeTab === "all" || activeTab === "contract") &&
            goals.map((goal) => <GoalCard key={goal.id} goal={goal} />)}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-14 px-4">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <PiggyBank className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No goals yet</h3>
          <p className="mt-1 text-sm text-muted-foreground text-center max-w-xs">
            Start saving! Choose off-chain for flexibility or on-chain to lock funds on blockchain.
          </p>
          <div className="flex gap-2 mt-5">
            <Button asChild size="sm">
              <Link href="/savings/new">
                <PiggyBank className="mr-1.5 h-4 w-4" /> Off-Chain
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/goals/new">
                <Shield className="mr-1.5 h-4 w-4" /> On-Chain
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}