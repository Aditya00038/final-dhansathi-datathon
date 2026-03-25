"use client";

import { usePathname } from "next/navigation";
import ChatBot from "@/components/chat/ChatBot";

export default function ConditionalChatBot() {
  const pathname = usePathname();
  
  // Hide ChatBot on goal details and all off-chain savings pages
  if (pathname.match(/^\/goals\/[^/]+$/) || pathname.startsWith("/savings")) {
    return null;
  }
  
  return <ChatBot />;
}
