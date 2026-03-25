'use client';

import { useEffect, useMemo, useState } from "react";

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
  const [lang, setLang] = useState("en");
  const elementId = "gte_hidden_selector";

  const languageOptions = useMemo(() => ([
    { value: "en", label: "English" },
    { value: "hi", label: "हिंदी" },
    { value: "mr", label: "मराठी" },
    { value: "bn", label: "বাংলা" },
    { value: "te", label: "తెలుగు" },
    { value: "ta", label: "தமிழ்" },
    { value: "gu", label: "ગુજરાતી" },
    { value: "kn", label: "ಕನ್ನಡ" },
    { value: "ml", label: "മലയാളം" },
    { value: "pa", label: "ਪੰਜਾਬੀ" },
    { value: "or", label: "ଓଡ଼ିଆ" },
  ]), []);

  const writeGoogTransCookie = (value: string) => {
    const cookieValue = `/en/${value}`;
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `googtrans=${cookieValue}; path=/; max-age=${maxAge}`;
    if (window.location.hostname.includes(".")) {
      document.cookie = `googtrans=${cookieValue}; domain=.${window.location.hostname}; path=/; max-age=${maxAge}`;
    }
  };

  const applyLanguage = (value: string) => {
    writeGoogTransCookie(value);
    const combo = document.querySelector("select.goog-te-combo") as HTMLSelectElement | null;
    if (combo) {
      combo.value = value;
      combo.dispatchEvent(new Event("change", { bubbles: true }));
    }
    setLang(value);
    // Reliable fallback: reload so Google applies cookie-driven translation consistently.
    window.location.reload();
  };

  useEffect(() => {
    const saved = document.cookie.match(/(?:^|;\s*)googtrans=\/en\/([a-z]+)/i)?.[1] || "en";
    setLang(saved);

    const tryInit = () => {
      const el = document.getElementById(elementId);
      if (!el) return false;
      if (el.querySelector("select.goog-te-combo")) return true;
      if (!window.google?.translate?.TranslateElement?.InlineLayout) return false;
      el.innerHTML = "";
      try {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: "en",
            layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
            includedLanguages: "en,hi,bn,te,ta,mr,gu,kn,ml,pa,or",
          },
          elementId
        );
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
  }, []);

  return (
    <div className="hidden md:block fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-3 md:bottom-6 md:right-6 z-[55] notranslate" translate="no">
      <div className="rounded-xl border border-border/70 bg-background/95 backdrop-blur px-3 py-2 shadow-lg notranslate" translate="no">
        <label htmlFor="floating-language" className="block text-[11px] text-muted-foreground mb-1 notranslate" translate="no">
          भाषा / Language
        </label>
        <select
          id="floating-language"
          value={lang}
          onChange={(e) => applyLanguage(e.target.value)}
          className="h-8 min-w-[130px] md:min-w-[170px] rounded-md border border-border bg-background px-2 text-sm notranslate"
          aria-label="Change Language"
          translate="no"
        >
          {languageOptions.map((option) => (
            <option key={option.value} value={option.value} className="notranslate" translate="no">
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Hidden Google element keeps translation engine available without showing widget UI */}
      <div id={elementId} className="hidden" aria-hidden="true" />
    </div>
  );
}
