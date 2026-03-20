import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Target, BarChart3, Banknote } from "lucide-react";
import { formatINR, algoToInr } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface FinancialOverviewProps {
  totalSaved: number;
  totalTarget: number;
  progressPercent: number;
  activeGoals: number;
  completedGoals: number;
  normalTotalSaved?: number;
  normalTotalTarget?: number;
}

export default function FinancialOverview({
  totalSaved, totalTarget, progressPercent, activeGoals, completedGoals,
  normalTotalSaved = 0, normalTotalTarget = 0,
}: FinancialOverviewProps) {
  const stats = [
    {
      title: "On-Chain",
      value: formatINR(algoToInr(totalSaved)),
      subtitle: `${totalSaved.toFixed(2)} ALGO locked`,
      icon: TrendingUp,
      accent: "text-emerald-500 bg-emerald-500/10",
    },
    {
      title: "Off-Chain",
      value: `₹${normalTotalSaved.toLocaleString("en-IN")}`,
      subtitle: normalTotalTarget > 0 ? `of ₹${normalTotalTarget.toLocaleString("en-IN")}` : "Flexible savings",
      icon: Banknote,
      accent: "text-blue-500 bg-blue-500/10",
    },
    {
      title: "Progress",
      value: `${progressPercent}%`,
      subtitle: undefined as string | undefined,
      icon: BarChart3,
      accent: "text-amber-500 bg-amber-500/10",
    },
    {
      title: "Goals",
      value: completedGoals > 0 ? `${completedGoals} done` : `${activeGoals} active`,
      subtitle: completedGoals > 0 ? `${activeGoals} in progress` : undefined,
      icon: Target,
      accent: "text-pink-500 bg-pink-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat, i) => (
        <Card key={i} className="border-border/60 shadow-sm">
          <CardContent className="p-3.5 md:p-5">
            <div className="flex items-start gap-3">
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", stat.accent)}>
                <stat.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] md:text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.title}</p>
                <p className="text-base md:text-xl font-bold truncate mt-0.5">{stat.value}</p>
                {stat.subtitle && <p className="text-[11px] text-muted-foreground truncate">{stat.subtitle}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}