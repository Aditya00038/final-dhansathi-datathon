"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { peraWallet, reconnectWalletSession, disconnectWalletSession } from "@/lib/blockchain";
import type { Transaction } from "algosdk";

interface WalletContextType {
  activeAddress: string | null;
  isConnecting: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  signTransactions: (transactions: Transaction[]) => Promise<Uint8Array[]>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [activeAddress, setActiveAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(true); // Start true to check session
  const [isInitialized, setIsInitialized] = useState(false);

  const handleDisconnectWallet = useCallback(async () => {
    await disconnectWalletSession();
    setActiveAddress(null);
  }, []);

  const handleConnectWallet = useCallback(async () => {
    setIsConnecting(true);
    try {
      const addresses = await peraWallet.connect();
      peraWallet.connector?.on("disconnect", handleDisconnectWallet);
      setActiveAddress(addresses[0]);
    } catch (error: any) {
      if (error?.data?.type !== "CONNECT_MODAL_CLOSED") {
        console.error(error);
        throw error;
      }
    } finally {
      setIsConnecting(false);
    }
  }, [handleDisconnectWallet]);

  const signTransactions = useCallback(async (transactions: Transaction[]) => {
    if (!activeAddress) {
      throw new Error("No active wallet session.");
    }
    const formattedTxns = transactions.map(txn => ({ txn }));
    return peraWallet.signTransaction([formattedTxns]);
  }, [activeAddress]);

  // Reconnect session on mount (only once)
  useEffect(() => {
    if (isInitialized) return;
    
    setIsInitialized(true);
    reconnectWalletSession()
      .then((accounts) => {
        peraWallet.connector?.on("disconnect", handleDisconnectWallet);
        if (accounts.length) {
          setActiveAddress(accounts[0]);
        }
      })
      .catch((err) => {
        console.error("Failed to reconnect wallet:", err);
      })
      .finally(() => {
        setIsConnecting(false);
      });
  }, [isInitialized, handleDisconnectWallet]);

  return (
    <WalletContext.Provider
      value={{
        activeAddress,
        isConnecting,
        connectWallet: handleConnectWallet,
        disconnectWallet: handleDisconnectWallet,
        signTransactions,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
