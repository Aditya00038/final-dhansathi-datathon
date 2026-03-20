import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight } from "lucide-react";
import { formatAlgoWithInr } from "@/lib/utils";

interface Deposit {
  amount: number;
  timestamp: number;
  goalName: string;
}

interface RecentActivityProps {
  deposits: Deposit[];
}

export default function RecentActivity({ deposits }: RecentActivityProps) {
  if (deposits.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg md:text-xl font-semibold mb-3">Recent Activity</h2>
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-0">
          <div className="divide-y divide-border/60">
            {deposits.map((deposit, index) => (
              <div key={index} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ArrowUpRight className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{deposit.goalName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(deposit.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-primary">+{formatAlgoWithInr(deposit.amount)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}