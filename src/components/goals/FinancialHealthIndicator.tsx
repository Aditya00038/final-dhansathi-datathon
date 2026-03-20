"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type FinancialHealthIndicatorProps = {
    score: number;
};

export function FinancialHealthIndicator({ score }: FinancialHealthIndicatorProps) {
    const getStatus = (s: number) => {
        if (s >= 75) return { label: "Excellent", className: "bg-green-100 text-green-800 border-green-200" };
        if (s >= 50) return { label: "Good", className: "bg-yellow-100 text-yellow-800 border-yellow-200" };
        return { label: "Needs Work", className: "bg-red-100 text-red-800 border-red-200" };
    };

    const status = getStatus(score);

    return (
        <Badge variant="outline" className={cn("text-xs", status.className)}>
            {status.label}
        </Badge>
    );
}
