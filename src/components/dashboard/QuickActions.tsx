import Link from "next/link";
import { PiggyBank, Shield, BarChart3, ClipboardPaste } from "lucide-react";
import { cn } from "@/lib/utils";

const actions = [
  { href: "/savings/new", label: "Savings Goal", icon: PiggyBank, accent: "text-emerald-600 bg-emerald-500/10" },
  { href: "/goals/new", label: "On-Chain Goal", icon: Shield, accent: "text-blue-600 bg-blue-500/10" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, accent: "text-amber-600 bg-amber-500/10" },
  { href: "/sms-parser", label: "SMS Paste", icon: ClipboardPaste, accent: "text-rose-600 bg-rose-500/10" },
];

export default function QuickActions() {
  return (
    <div className="grid grid-cols-4 gap-2 md:gap-3">
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="flex flex-col items-center gap-1.5 md:gap-2 p-3 md:p-4 rounded-xl border border-border/60 bg-card hover:bg-muted/50 transition-colors text-center"
        >
          <div className={cn("h-9 w-9 md:h-10 md:w-10 rounded-lg flex items-center justify-center", a.accent)}>
            <a.icon className="h-4 w-4 md:h-5 md:w-5" />
          </div>
          <span className="text-[11px] md:text-xs font-medium text-muted-foreground">{a.label}</span>
        </Link>
      ))}
    </div>
  );
}