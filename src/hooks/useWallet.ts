
"use client";

import { useState, useEffect, useCallback } from "react";
import { peraWallet, reconnectWalletSession, disconnectWalletSession } from "@/lib/blockchain";
import type { Transaction } from "algosdk";

export function useWallet() {
  const [activeAddress, setActiveAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

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
  }, []);

  const handleDisconnectWallet = useCallback(async () => {
    await disconnectWalletSession();
    setActiveAddress(null);
  }, []);

  const signTransactions = useCallback(async (transactions: Transaction[]) => {
    if (!activeAddress) {
      throw new Error("No active wallet session.");
    }
    const formattedTxns = transactions.map(txn => ({ txn }));
    return peraWallet.signTransaction([formattedTxns]);
  }, [activeAddress]);

  useEffect(() => {
    setIsConnecting(true);
    reconnectWalletSession()
      .then((accounts) => {
        peraWallet.connector?.on("disconnect", handleDisconnectWallet);
        if (accounts.length) {
          setActiveAddress(accounts[0]);
        }
      })
      .finally(() => setIsConnecting(false));
  }, [handleDisconnectWallet]);


  return {
    activeAddress,
    isConnecting,
    connectWallet: handleConnectWallet,
    disconnectWallet: handleDisconnectWallet,
    signTransactions,
  };
}
