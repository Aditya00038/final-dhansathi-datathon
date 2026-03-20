'use client';

import { Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

declare global {
  interface Window {
    google?: {
      translate: {
        TranslateElement: {
          new (options: { pageLanguage: string; layout: unknown; includedLanguages?: string }, elementId: string): void;
          InlineLayout: { SIMPLE: unknown };
        };
      };
    };
    __googleTranslateReady?: boolean;
  }
}

/**
 * Floating language selector that's always visible on all pages.
 */
export default function FloatingLanguageSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const initializedRef = useRef(false);
  const elementId = "gte_floating_selector";

  useEffect(() => {
    if (!isOpen) return;
    initializedRef.current = false;

    const tryInit = () => {
      if (initializedRef.current) return true;
      const el = document.getElementById(elementId);
      if (!el) return false;
      if (!window.google?.translate?.TranslateElement?.InlineLayout) return false;
      if (el.querySelector('select.goog-te-combo')) {
        initializedRef.current = true;
        return true;
      }
      el.innerHTML = '';
      try {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
            includedLanguages: 'en,hi,bn,te,ta,mr,gu,kn,ml,pa,or',
          },
          elementId
        );
        initializedRef.current = true;
        return true;
      } catch {
        return false;
      }
    };

    const interval = setInterval(() => {
      if (tryInit()) clearInterval(interval);
    }, 300);

    const timeout = setTimeout(() => clearInterval(interval), 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isOpen]);

  return (
    <div className="fixed bottom-20 left-4 md:bottom-6 md:left-6 z-[55]">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg bg-background border-2 border-primary/20 hover:border-primary hover:bg-primary/10"
            aria-label="Change Language"
          >
            <Globe className="h-5 w-5 text-primary" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          side="top" 
          align="start" 
          className="w-auto p-3"
          sideOffset={8}
        >
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Select Language / भाषा चुनें
            </p>
            <div 
              id={elementId} 
              className="google-translate-floating min-w-[150px]"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
