"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const DISMISSED_KEY = "dhansathi_pwa_install_dismissed";

export default function InstallPrompt() {
  const { isInstallable, install } = usePWAInstall();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Don't show if user already dismissed
    const wasDismissed = localStorage.getItem(DISMISSED_KEY);
    if (wasDismissed || !isInstallable) return;

    // Show banner after a small delay
    const timer = setTimeout(() => setShowBanner(true), 1500);
    return () => clearTimeout(timer);
  }, [isInstallable]);

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      setShowBanner(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem(DISMISSED_KEY, "true");
  };

  if (!showBanner || !isInstallable) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-500 md:bottom-4 md:left-auto md:right-4 md:w-auto">
      <div className="mx-auto max-w-lg p-4 md:p-0">
        <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-2xl">
          {/* Icon */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Install DhanSathi</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add to home screen for faster access & offline support
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" onClick={handleInstall} className="gap-1.5">
              <Download className="h-4 w-4" />
              Install
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleDismiss}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
