'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

export interface BankAccount {
  userId: string;
  bankName: string;
  accountNickname: string;
  balance: number;
  status?: 'active' | 'disconnected';
}

export interface ConnectBankPayload {
  bankName: string;
  accountNickname: string;
  initialBalance: number;
}

export const useBankBalance = () => {
  const { user } = useAuth();
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [disconnectedAccount, setDisconnectedAccount] = useState<BankAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setBankAccount(null);
      setDisconnectedAccount(null);
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'bank_balances', user.uid);
    const unsubscribe = onSnapshot(docRef, (doc) => {
      setBankAccount(null);
      setDisconnectedAccount(null);
      if (doc.exists()) {
        const account = doc.data() as BankAccount;
        if (account.status === 'active') {
          setBankAccount(account);
        } else if (account.status === 'disconnected') {
          setDisconnectedAccount(account);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const connectBank = useCallback(async (payload: ConnectBankPayload) => {
    if (!user) throw new Error('User not authenticated');
    const docRef = doc(db, 'bank_balances', user.uid);
    const newAccount: BankAccount = {
      userId: user.uid,
      bankName: payload.bankName,
      accountNickname: payload.accountNickname,
      balance: payload.initialBalance,
      status: 'active',
    };
    await setDoc(docRef, newAccount);
    setBankAccount(newAccount);
    setDisconnectedAccount(null);
  }, [user]);

  const reconnectBank = useCallback(async () => {
    if (!user) throw new Error('User not authenticated');
    const docRef = doc(db, 'bank_balances', user.uid);
    await updateDoc(docRef, { status: 'active' });
  }, [user]);

  const updateBalance = useCallback(async (amount: number) => {
    if (!user) throw new Error('User not authenticated');
    const docRef = doc(db, 'bank_balances', user.uid);
    await updateDoc(docRef, { balance: increment(amount) });
  }, [user]);

  const disconnectBank = useCallback(async () => {
    if (!user) throw new Error('User not authenticated');
    const docRef = doc(db, 'bank_balances', user.uid);
    await updateDoc(docRef, { status: 'disconnected' });
    setBankAccount(null);
  }, [user]);

  return { bankAccount, disconnectedAccount, loading, connectBank, reconnectBank, updateBalance, disconnectBank };
};
