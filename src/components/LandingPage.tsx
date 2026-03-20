'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  TrendingUp,
  Bell,
  Shield,
  BarChart3,
  Github,
  Twitter,
  Linkedin,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import LanguageSelector from "@/components/layout/LanguageSelector";
import LanguageSelectorMobile from "@/components/layout/LanguageSelectorMobile";

export default function LandingPage() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* ───── Header ───── */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 flex h-14 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">DhanSathi</span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            {["Features", "Analytics", "About"].map((s) => (
              <a key={s} href={`#${s.toLowerCase()}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {s}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            {mounted && <LanguageSelector />}
            <Button variant="ghost" size="sm" onClick={() => router.push('/login')}>Sign In</Button>
            <Button size="sm" onClick={() => router.push('/register')}>Get Started</Button>
          </div>

          <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Mobile dropdown */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-border/60 bg-background">
            <div className="px-4 py-3 space-y-1">
              {["Features", "Analytics", "About"].map((s) => (
                <a key={s} href={`#${s.toLowerCase()}`} onClick={() => setIsMenuOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted">
                  {s}
                </a>
              ))}
            </div>
            <div className="border-t border-border/60 px-4 py-3 space-y-2">
              <div className="px-1">{mounted && <LanguageSelectorMobile />}</div>
              <Button variant="outline" size="sm" onClick={() => { setIsMenuOpen(false); router.push('/login'); }} className="w-full">Sign In</Button>
              <Button size="sm" onClick={() => { setIsMenuOpen(false); router.push('/register'); }} className="w-full">Get Started</Button>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ───── Hero ───── */}
        <section className="py-16 md:py-24">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <div className="inline-flex items-center rounded-full border border-border/60 px-3.5 py-1 mb-6 bg-muted/50 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary mr-1.5" />
              Discipline-as-a-Service on Algorand
            </div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight">
              <span className="text-primary">Achieve Your Savings Goals</span>
              <br />
              <span className="text-foreground">with Smart Contracts</span>
            </h1>
            <p className="text-muted-foreground mt-4 mb-8 max-w-xl mx-auto text-base md:text-lg">
              DhanSathi transforms saving from a challenge into a commitment. Enforce your own rules with Algorand smart contracts.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => router.push('/register')} size="lg" className="text-base px-7">
                Get Started <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
              <Button variant="outline" size="lg" className="text-base px-7" asChild>
                <a href="#features">Learn More</a>
              </Button>
            </div>
          </div>
        </section>

        {/* ───── Features ───── */}
        <section id="features" className="py-14 md:py-20 bg-muted/30">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold mb-3">Why DhanSathi?</h2>
              <p className="text-muted-foreground max-w-lg mx-auto text-sm md:text-base">Traditional savings methods fail because they lack structure. We provide the discipline required to succeed.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { icon: BarChart3, title: "AI-Powered Analytics", desc: "Personalized insights and recommendations to optimize your savings strategy.", accent: "text-blue-500 bg-blue-500/10" },
                { icon: Shield, title: "Smart Contract Security", desc: "Funds secured by Algorand smart contracts, enforcing your savings rules.", accent: "text-pink-500 bg-pink-500/10" },
                { icon: Bell, title: "Intelligent Alerts", desc: "Smart notifications to stay on track and celebrate milestones.", accent: "text-amber-500 bg-amber-500/10" },
              ].map((f) => (
                <div key={f.title} className="rounded-xl border border-border/60 bg-card p-6 hover:border-primary/40 transition-colors text-center">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-4 mx-auto ${f.accent}`}>
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ───── Analytics Preview ───── */}
        <section id="analytics" className="py-14 md:py-20">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold mb-3">Visualize Your Progress</h2>
              <p className="text-muted-foreground text-sm md:text-base">Track spending patterns and watch savings grow with AI-powered insights.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {[
                { title: "Spending Breakdown", color: "hsl(var(--chart-1))" },
                { title: "Savings Growth", color: "hsl(var(--chart-2))" },
                { title: "Goal Progress", color: "hsl(var(--chart-3))" },
              ].map((c) => (
                <div key={c.title} className="rounded-xl border border-border/60 bg-card p-5 h-40 flex flex-col justify-between">
                  <p className="text-sm font-medium text-muted-foreground">{c.title}</p>
                  <div className="flex items-end h-full w-full gap-2 mt-3">
                    {[60, 40, 75, 50].map((h, i) => (
                      <div key={i} style={{ backgroundColor: c.color, height: `${h}%`, opacity: 1- i * 0.15 }} className="flex-1 rounded-t-sm" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ───── About ───── */}
        <section id="about" className="py-14 md:py-20 bg-muted/30">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">About Us</h2>
            <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
              DhanSathi was built to solve a simple problem: saving money is hard. We provide students and young professionals with a commitment device to instill financial discipline. By leveraging Algorand blockchain, we make it easier to set, enforce, and achieve your financial goals.
            </p>
          </div>
        </section>
      </main>

      {/* ───── Footer ───── */}
      <footer className="border-t border-border/60">
        <div className="max-w-6xl mx-auto py-10 px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-bold">DhanSathi</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-sm mb-4">A DApp that transforms savings goals into powerful commitment devices on the Algorand blockchain.</p>
              <div className="flex gap-3">
                {[Github, Twitter, Linkedin].map((Icon, i) => (
                  <a key={i} href="#" className="text-muted-foreground hover:text-foreground transition-colors"><Icon className="h-4 w-4" /></a>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Quick Links</h4>
              <ul className="space-y-1.5 text-sm">
                {[["Features", "#features"], ["Analytics", "#analytics"], ["About", "#about"], ["Dashboard", "/dashboard"]].map(([l, h]) => (
                  <li key={l}><a href={h} className="text-muted-foreground hover:text-foreground transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Legal</h4>
              <ul className="space-y-1.5 text-sm">
                <li><a href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border/60 pt-6 flex flex-col md:flex-row justify-between items-center gap-2 text-xs text-muted-foreground">
            <p>&copy; 2025 DhanSathi. All rights reserved.</p>
            <p>Powered by <span className="font-semibold text-primary">Algorand</span></p>
          </div>
        </div>
      </footer>
    </div>
  );
}