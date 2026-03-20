"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  Send,
  Loader2,
  Sparkles,
  User,
  Lightbulb,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getGoalAdvice } from "@/ai/flows/ai-goal-advice-agent-flow";

interface GoalAdviceAgentProps {
  goalName: string;
  targetAmount: number;
  currentSaved: number;
  deadline: string; // ISO date string
  currency: "ALGO" | "INR";
  monthlyIncome?: number;
  monthlySpending?: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const SUGGESTED_QUESTIONS = [
  "Create a weekly savings plan",
  "Am I on track?",
  "How to save faster?",
  "What if I miss a week?",
];

export default function GoalAdviceAgent({
  goalName,
  targetAmount,
  currentSaved,
  deadline,
  currency,
  monthlyIncome,
  monthlySpending,
}: GoalAdviceAgentProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const remaining = targetAmount - currentSaved;
  const progress = targetAmount > 0 ? ((currentSaved / targetAmount) * 100).toFixed(1) : "0";

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = useCallback(
    async (messageText?: string) => {
      const text = messageText || input.trim();
      if (!text || isLoading) return;

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);
      setIsExpanded(true);

      try {
        const history = messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const result = await getGoalAdvice({
          goalName,
          targetAmount,
          currentSaved,
          deadline,
          currency,
          monthlyIncome,
          monthlySpending,
          userQuestion: text,
          conversationHistory: history,
        });

        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: result.response,
            timestamp: new Date(),
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content:
              "Sorry, I couldn't generate advice right now. Please try again.",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      input,
      isLoading,
      messages,
      goalName,
      targetAmount,
      currentSaved,
      deadline,
      currency,
      monthlyIncome,
      monthlySpending,
    ]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Goal Advice Agent
          </span>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMessages([]);
                setIsExpanded(false);
              }}
              className="h-7 text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          AI-powered advisor to help you achieve your &ldquo;{goalName}&rdquo;
          goal ({progress}% complete)
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Suggested questions when no conversation yet */}
        {messages.length === 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              Ask the advisor:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  className="text-xs px-2.5 py-1.5 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                  onClick={() => handleSend(q)}
                  disabled={isLoading}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conversation */}
        {isExpanded && messages.length > 0 && (
          <ScrollArea ref={scrollRef} className="h-[280px] pr-2">
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-2",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === "assistant" && (
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Sparkles className="h-3 w-3 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary"
                    )}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                  {msg.role === "user" && (
                    <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="h-3 w-3" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-3 w-3 text-primary" />
                  </div>
                  <div className="bg-secondary rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs text-muted-foreground">
                        Analyzing your goal...
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Quick suggestions after conversation */}
        {messages.length > 0 && !isLoading && (
          <div className="flex flex-wrap gap-1.5">
            {["What should I do next?", "Adjust my plan", "Tips to stay motivated"].map(
              (q, i) => (
                <button
                  key={i}
                  className="text-xs px-2 py-1 rounded-full border border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
                  onClick={() => handleSend(q)}
                  disabled={isLoading}
                >
                  {q}
                </button>
              )
            )}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && !e.shiftKey && handleSend()
            }
            placeholder="Ask about your goal..."
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
      </CardContent>
    </Card>
  );
}
