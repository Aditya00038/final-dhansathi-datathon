"use client"

import * as React from "react"
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { Goal } from "@/lib/types"
import { toDate } from "@/lib/utils"
import { algoToInr } from "@/lib/algo-inr"

const chartConfig = {
  savings: {
    label: "Saved",
    color: "hsl(var(--accent))",
  },
} satisfies ChartConfig

type SavingsChartProps = {
  goal: Goal;
};

export function SavingsChart({ goal }: SavingsChartProps) {
    const chartData = React.useMemo(() => {
    if (!goal || !goal.deposits || !Array.isArray(goal.deposits)) return [];

    let cumulativeSavings = 0;
    const dataPoints = goal.deposits
      .map(deposit => ({ // ensure dates are Date objects
          ...deposit,
          timestamp: toDate(deposit.timestamp)
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map(deposit => {
        cumulativeSavings += deposit.amount;
        return {
          date: deposit.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          savings: algoToInr(cumulativeSavings),
        };
      });
    
    // Add initial point
    const createdAtDate = toDate(goal.createdAt);
    const startPoint = {
        date: createdAtDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        savings: 0,
    };
    
    // De-duplicate dates, keeping the last entry for each day
    const uniqueDataPoints = Array.from(new Map([...[startPoint], ...dataPoints].map(item => [item.date, item])).values());
    
    return uniqueDataPoints;
  }, [goal]);

  if (chartData.length < 2) {
    return (
        <div className="flex h-[250px] w-full items-center justify-center rounded-lg border-2 border-dashed">
            <p className="text-muted-foreground">Not enough data to display chart. Make a deposit to get started!</p>
        </div>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="h-[250px] w-full">
      <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
        <YAxis 
            tickLine={false} 
            axisLine={false} 
            tickMargin={8} 
            fontSize={12} 
            tickFormatter={(value) => `₹${Math.round(value)}`}
            domain={['dataMin', 'dataMax']}
        />
        <Tooltip
            cursor={true}
            content={<ChartTooltipContent
                labelKey="date"
                formatter={(value, name) => [`${typeof value === 'number' ? `₹${Math.round(value)}` : value}`, 'Total Saved (₹)']}
            />}
        />
        <Line
          dataKey="savings"
          type="monotone"
          stroke="var(--color-savings)"
          strokeWidth={2}
          dot={{
            fill: "var(--color-savings)",
          }}
          activeDot={{
            r: 6,
          }}
        />
      </LineChart>
    </ChartContainer>
  )
}
