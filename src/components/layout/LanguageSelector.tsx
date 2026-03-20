'use client';

import { Globe } from "lucide-react";
import { useEffect, useRef, useId } from "react";

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
 * Language selector for Indian languages using Google Translate.
 */
export default function LanguageSelector() {
  const elementRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const uniqueId = useId();
  const elementId = `gte_desktop_${uniqueId.replace(/:/g, '_')}`;

  useEffect(() => {
    initializedRef.current = false;

    const tryInit = () => {
      if (initializedRef.current) return true;
      const el = document.getElementById(elementId);
      if (!el) return false;
      if (!window.google?.translate?.TranslateElement?.InlineLayout) return false;
      // If already has a select inside, skip
      if (el.querySelector('select.goog-te-combo')) {
        initializedRef.current = true;
        return true;
      }
      // Clear any stale children
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
      } catch (e) {
        console.warn('Google Translate init failed, will retry:', e);
        return false;
      }
    };

    // Poll until initialized (API may load late)
    const interval = setInterval(() => {
      if (tryInit()) clearInterval(interval);
    }, 500);

    // Stop after 15s
    const timeout = setTimeout(() => clearInterval(interval), 15000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [elementId]);

  return (
    <div className="lang-selector-wrapper">
      <Globe className="lang-selector-icon" />
      <div id={elementId} ref={elementRef} className="google-translate-widget"></div>
    </div>
  );
}
