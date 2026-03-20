'use client';

import { useEffect, useRef, useId } from "react";

/**
 * Mobile language selector for Indian languages using Google Translate.
 */
export default function LanguageSelectorMobile() {
  const initializedRef = useRef(false);
  const uniqueId = useId();
  const elementId = `gte_mobile_${uniqueId.replace(/:/g, '_')}`;

  useEffect(() => {
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
    }, 500);

    const timeout = setTimeout(() => clearInterval(interval), 15000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [elementId]);

  return (
    <div id={elementId} className="w-full"></div>
  );
}
