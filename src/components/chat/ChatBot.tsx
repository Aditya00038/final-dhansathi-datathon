"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWallet } from "@/contexts/WalletContext";
import { getFinancialAdvice } from "@/ai/flows/ai-financial-advisor-flow";
import { getGoalsFirestore, getSavedSmsTransactions } from "@/lib/local-store";
import { getGoalOnChainState } from "@/lib/blockchain";
import { getAllNormalGoalsFirestore } from "@/lib/normal-goal-store";
import { useAuth } from "@/contexts/AuthContext";
import { Goal, Deposit } from "@/lib/types";

interface GoalSummary {
  name: string;
  type: "on-chain" | "off-chain";
  targetAmount: number;
  currentSaved: number;
  deadline: string;
  currency: "ALGO" | "INR";
  goalCompleted: boolean;
  transactions?: Array<{
    type: "deposit" | "withdrawal";
    amount: number;
    timestamp: string;
  }>;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestions?: string[];
  timestamp: Date;
}

const QUICK_QUESTIONS = [
  "How can I save more?",
  "Budgeting tips",
  "Smart Contract vs Savings?",
  "Help me set a goal",
  "Check my progress",
  "Student saving tips",
];

/** Render simple markdown: **bold** and line breaks */
function renderMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    // Split on newlines for line breaks
    const lines = part.split('\n');
    return lines.map((line, j) => (
      <span key={`${i}-${j}`}>
        {j > 0 && <br />}
        {line}
      </span>
    ));
  });
}

export default function ChatBot() {
  const { activeAddress } = useWallet();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userContext, setUserContext] = useState<{
    totalSaved: number;
    totalTarget: number;
    activeGoals: number;
    completedGoals: number;
    recentDeposits: { amount: number; date: string }[];
    goals: GoalSummary[];
    totalSavedInr: number;
    totalTargetInr: number;
    todaySpending: { amount: number; merchant: string; category: string }[];
    todayTotal: number;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load financial context when opened
  useEffect(() => {
    if (!isOpen || !user || userContext) return;

    async function loadContext() {
      try {
        const goals = await getGoalsFirestore(user.uid);
        const normalGoals = await getAllNormalGoalsFirestore(user.uid);

        let totalSaved = 0; // ALGO
        let totalTarget = 0; // ALGO
        let totalSavedInr = 0; // INR
        let totalTargetInr = 0; // INR
        let completedGoals = 0;
        const allDeposits: Deposit[] = [];
        const goalSummaries: GoalSummary[] = [];

        // Process on-chain goals (ALGO)
        for (const goal of goals) {
          if (goal.deposits) {
            allDeposits.push(...goal.deposits);
          }
          try {
            const onChain = await getGoalOnChainState(goal.appId);
            const saved = (onChain.totalSaved || 0) / 1_000_000;
            const target = (onChain.targetAmount || 0) / 1_000_000;
            totalSaved += saved;
            totalTarget += target;
            if (onChain.goalCompleted) completedGoals++;

            goalSummaries.push({
              name: goal.name,
              type: "on-chain",
              targetAmount: target,
              currentSaved: saved,
              deadline: goal.deadline || new Date().toISOString(),
              currency: "ALGO",
              goalCompleted: onChain.goalCompleted,
              transactions: (goal.deposits || []).map((d) => ({
                type: "deposit",
                amount: d.amount,
                timestamp: d.timestamp,
              })),
            });
          } catch {
            // Skip failed on-chain lookups
          }
        }

        // Process off-chain (normal) goals (INR)
        for (const ng of normalGoals) {
          totalSavedInr += ng.currentBalance || 0;
          totalTargetInr += ng.targetAmount || 0;
          if (ng.goalCompleted) completedGoals++;

          goalSummaries.push({
            name: ng.name,
            type: "off-chain",
            targetAmount: ng.targetAmount,
            currentSaved: ng.currentBalance || 0,
            deadline: ng.deadline,
            currency: "INR",
            goalCompleted: ng.goalCompleted,
            transactions: (ng.transactions || []).map((tx) => ({
              type: tx.type,
              amount: tx.amount,
              timestamp: tx.timestamp,
            })),
          });
        }

        // Get today's spending
        const todayDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const allTransactions = await getSavedSmsTransactions(user.uid);
        const todayTransactions = allTransactions.filter(t => {
          const txDate = typeof t.date === 'string' ? t.date : new Date(t.date).toISOString().split('T')[0];
          return txDate === todayDate && t.type === 'debit';
        });
        const todayTotal = todayTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

        setUserContext({
          totalSaved,
          totalTarget,
          totalSavedInr,
          totalTargetInr,
          activeGoals: goals.length + normalGoals.filter(g => !g.goalCompleted).length - completedGoals,
          completedGoals,
          goals: goalSummaries,
          todaySpending: todayTransactions.map(t => ({
            amount: t.amount,
            merchant: t.merchant,
            category: t.source === 'cash-manual' ? 'Cash' : 'Bank',
          })),
          todayTotal,
          recentDeposits: allDeposits.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5).map((d) => ({
            amount: d.amount,
            date: new Date(d.timestamp).toLocaleDateString(),
          })),
        });
      } catch (error) {
        console.error("Error loading chatbot context:", error);
      }
    }

    loadContext();
  }, [isOpen, user, userContext]);

  // Welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content:
            "Hey! I'm **DhanSathi AI** — your personal finance assistant 💰\n\nI can help you with:\n• **Savings strategies** & budgeting\n• **Goal planning** & tracking\n• **Smart Contract** vs Savings advice\n• **Investment** basics & tips\n• **Student finance** & side hustles\n\nTry one of the questions below or type anything!",
          suggestions: QUICK_QUESTIONS.slice(0, 4),
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, messages.length]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = useCallback(
    async (messageText?: string) => {
      const text = messageText || input.trim();
      if (!text || isLoading) return;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);

      try {
        const conversationHistory = messages
          .filter((m) => m.id !== "welcome")
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }));

        const result = await getFinancialAdvice({
          userMessage: text,
          context: userContext || undefined,
          conversationHistory,
        });

        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content:
            result.success && result.data
              ? result.data.response
              : "I'm having trouble right now. Please try again.",
          suggestions:
            result.success && result.data?.suggestions?.length
              ? result.data.suggestions
              : undefined,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: "Sorry, something went wrong. Please try again.",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, messages, userContext]
  );

  if (!activeAddress) return null;

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 md:bottom-6 md:right-6 z-[70] h-14 w-14 rounded-full bg-primary text-primary-foreground ring-4 ring-background shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
          aria-label="Open AI Chat"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-background animate-pulse" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed left-3 right-3 md:left-auto bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-6 md:right-6 z-[70] w-auto max-w-[400px] h-[500px] md:h-[560px] flex flex-col shadow-2xl border-primary/20 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground rounded-t-lg">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-sm">DhanSathi AI</p>
                <p className="text-xs text-primary-foreground/70">
                  {isLoading ? "Thinking..." : "Online"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setIsOpen(false)}
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => {
                  setIsOpen(false);
                  setMessages([]);
                  setUserContext(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea ref={scrollRef} className="flex-1 px-3 py-3">
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-2",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-secondary rounded-bl-md"
                    )}
                  >
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {renderMarkdown(message.content)}
                    </div>
                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {message.suggestions.map((s, i) => (
                          <button
                            key={i}
                            className="text-xs px-2 py-1 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                            onClick={() => handleSend(s)}
                            disabled={isLoading}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2 justify-start">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="bg-secondary rounded-2xl rounded-bl-md px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="text-xs text-muted-foreground">
                        Thinking...
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="px-3 py-3 border-t border-border bg-background/95">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && handleSend()
                }
                placeholder="Ask anything..."
                disabled={isLoading}
                className="flex-1 text-sm h-9"
              />
              <Button
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                size="icon"
                className="h-9 w-9"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
