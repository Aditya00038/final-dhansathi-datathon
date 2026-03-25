import { Card, CardContent } from "@/components/ui/card";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { formatAlgoWithInr, formatINR } from "@/lib/utils";

interface ActivityItem {
  id: string;
  kind: "on-chain" | "off-chain";
  action: "deposit" | "withdrawal";
  amount: number;
  timestamp: string;
  goalName: string;
  currency: "ALGO" | "INR";
}

interface RecentActivityProps {
  activities: ActivityItem[];
}

export default function RecentActivity({ activities }: RecentActivityProps) {
  if (activities.length === 0) return null;

  const formatAmount = (activity: ActivityItem) => {
    if (activity.currency === "INR") {
      return formatINR(activity.amount);
    }
    return formatAlgoWithInr(activity.amount);
  };

  return (
    <div>
      <h2 className="text-lg md:text-xl font-semibold mb-3">Recent Activity</h2>
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-0">
          <div className="divide-y divide-border/60">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${activity.action === "deposit" ? "bg-primary/10" : "bg-amber-500/10"}`}>
                    {activity.action === "deposit" ? (
                      <ArrowUpRight className="h-4 w-4 text-primary" />
                    ) : (
                      <ArrowDownLeft className="h-4 w-4 text-amber-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{activity.goalName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {activity.action === "deposit" ? "Deposit" : "Withdrawal"} • {new Date(activity.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <p className={`text-sm font-semibold ${activity.action === "deposit" ? "text-primary" : "text-amber-600"}`}>
                  {activity.action === "deposit" ? "+" : "-"}
                  {formatAmount(activity)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}