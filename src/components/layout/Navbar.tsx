'use client';

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Target,
  BarChart3,
  LogOut,
  Menu,
  Sun,
  Moon,
  PiggyBank,
  Wallet,
  ClipboardPaste,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ConnectBank } from "./ConnectBank";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/savings/new", label: "Savings", icon: PiggyBank },
  { href: "/goals/new", label: "On-Chain", icon: Target },
  { href: "/sms-parser", label: "SMS Paste", icon: ClipboardPaste },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

const bottomNavItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/savings/new", label: "Savings", icon: PiggyBank },
  { href: "/goals/new", label: "On-Chain", icon: Target },
  { href: "/sms-parser", label: "SMS", icon: ClipboardPaste },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export default function Navbar() {
  const pathname = usePathname();
  const { activeAddress, connectWallet, disconnectWallet, isConnecting } = useWallet();
  const { logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleLogout = async () => {
    await disconnectWallet();
    await logout();
    setShowLogoutDialog(false);
  };

  const handleConnectWallet = async () => {
    try {
      await connectWallet();
      toast({ title: "Wallet Connected!", description: "Your Algorand wallet is now connected." });
    } catch (error) {
      toast({ variant: "destructive", title: "Connection Failed", description: error instanceof Error ? error.message : "Could not connect wallet." });
    }
  };

  const isActive = (href: string) =>
    pathname === href ||
    (href === "/goals/new" && pathname.startsWith("/goals")) ||
    (href === "/savings/new" && pathname.startsWith("/savings")) ||
    (href === "/sms-parser" && pathname.startsWith("/sms-parser"));

  return (
    <>
      {/* ───── Desktop Navbar ───── */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl hidden md:block">
        <div className="max-w-7xl mx-auto px-6 flex h-14 items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <Image
              src="/icons/DhanSathi.png"
              alt="DhanSathi logo"
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg object-cover shadow-sm group-hover:shadow-md transition-shadow"
              priority
            />
            <span className="text-lg font-bold tracking-tight">DhanSathi</span>
          </Link>

          <nav className="flex items-center gap-0.5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all",
                  isActive(item.href)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ConnectBank />
            {mounted && (
              <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="h-8 w-8 rounded-lg">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            )}
            {activeAddress ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-xs font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                {`${activeAddress.slice(0, 4)}...${activeAddress.slice(-4)}`}
              </div>
            ) : (
              <Button onClick={handleConnectWallet} disabled={isConnecting} variant="outline" size="sm" className="h-8 text-xs rounded-lg">
                <Wallet className="mr-1.5 h-3.5 w-3.5" />
                {isConnecting ? "Connecting…" : "Connect Wallet"}
              </Button>
            )}
            <Button onClick={() => setShowLogoutDialog(true)} variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* ───── Mobile Top Bar ───── */}
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl md:hidden">
        <div className="px-4 flex h-16 items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/icons/DhanSathi.png"
              alt="DhanSathi logo"
              width={28}
              height={28}
              className="h-7 w-7 rounded-lg object-cover"
              priority
            />
            <span className="text-base font-bold tracking-tight">DhanSathi</span>
          </Link>

          <div className="flex items-center gap-1">
            {mounted && (
              <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="h-10 w-10">
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            )}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] p-0 !z-[70]">
                <div className="flex flex-col h-full">
                  <div className="p-4 pb-3 border-b border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Menu</span>
                    </div>
                  </div>
                  <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
                    {navItems.map((item) => (
                      <SheetClose asChild key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                            isActive(item.href)
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                        >
                          <item.icon className="h-5 w-5" />
                          {item.label}
                        </Link>
                      </SheetClose>
                    ))}
                  </nav>
                  <div className="p-3 border-t border-border space-y-2">
                    <ConnectBank mobile />
                    {activeAddress ? (
                      <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-muted text-xs font-mono">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                        {`${activeAddress.slice(0, 6)}…${activeAddress.slice(-4)}`}
                      </div>
                    ) : (
                      <Button onClick={handleConnectWallet} disabled={isConnecting} variant="outline" className="w-full h-9 text-sm">
                        <Wallet className="mr-2 h-4 w-4" />
                        {isConnecting ? "Connecting…" : "Connect Wallet"}
                      </Button>
                    )}
                    <Button onClick={() => setShowLogoutDialog(true)} variant="ghost" className="w-full h-9 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* ───── Mobile Bottom Navigation ───── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/60 bg-background/90 backdrop-blur-xl md:hidden safe-area-pb">
        <div className="grid grid-cols-5 h-14">
          {bottomNavItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center h-7 w-7 rounded-lg transition-colors",
                  active && "bg-primary/10"
                )}>
                  <item.icon className="h-4 w-4" />
                </div>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Logout confirmation */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Logout?</AlertDialogTitle>
            <AlertDialogDescription>You will need to sign in again to access your data.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="h-9 bg-destructive text-destructive-foreground hover:bg-destructive/90">Logout</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
