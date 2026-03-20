"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Download } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export default function Header() {
  const { toast } = useToast();
  const { activeAddress, isConnecting, connectWallet, disconnectWallet } = useWallet();
  const { isInstallable, install } = usePWAInstall();

  const handleConnect = async () => {
    try {
      await connectWallet();
      toast({
        title: "Wallet Connected!",
        description: "Pera Wallet has been successfully connected.",
      });
    } catch (error) {
       toast({
        variant: "destructive",
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Could not connect to the wallet.",
      });
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <Logo className="h-6 w-6 text-primary" />
          <span className="hidden font-bold sm:inline-block font-headline">
            AlgoSave
          </span>
        </Link>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-2">
            {isInstallable && (
              <Button onClick={install} variant="outline" size="sm" className="hidden sm:flex">
                <Download className="mr-2 h-4 w-4" />
                Install App
              </Button>
            )}
            {activeAddress ? (
               <Button onClick={disconnectWallet} variant="outline" size="sm">
                <Wallet className="mr-2 h-4 w-4" />
                {`${activeAddress.substring(0, 6)}...${activeAddress.substring(activeAddress.length - 4)}`}
              </Button>
            ) : (
              <Button onClick={handleConnect} disabled={isConnecting} size="sm">
                <Wallet className="mr-2 h-4 w-4" />
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </Button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
