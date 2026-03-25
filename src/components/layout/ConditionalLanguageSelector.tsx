"use client";

import { usePathname } from "next/navigation";
import FloatingLanguageSelector from "@/components/layout/FloatingLanguageSelector";

export default function ConditionalLanguageSelector() {
  const pathname = usePathname();

  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return null;
  }

  return <FloatingLanguageSelector />;
}
