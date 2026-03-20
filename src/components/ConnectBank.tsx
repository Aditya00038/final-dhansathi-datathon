'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBankBalance } from '@/hooks/useBankBalance';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const ConnectBank = () => {
  const [initialBalance, setInitialBalance] = useState('');
  const { setInitialBalance: setBalance, updateBalance } = useBankBalance();
  const { toast } = useToast();

  const handleConnect = async () => {
    const balanceValue = parseFloat(initialBalance);
    if (isNaN(balanceValue) || balanceValue <= 0) {
      toast({ variant: "destructive", title: "Invalid balance", description: "Please enter a valid initial balance." });
      return;
    }
    try {
      await setBalance(balanceValue);
      toast({ title: "Bank Connected", description: `Your initial balance is set to ₹${balanceValue.toFixed(2)}` });
    } catch (error) {
      console.error("Error setting initial balance:", error);
      toast({ variant: "destructive", title: "Connection Failed", description: "Could not connect bank account." });
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 border rounded-lg">
      <h3 className="text-lg font-semibold">Connect Your Bank</h3>
      <div className="flex gap-2">
        <Input
          type="number"
          placeholder="Initial Bank Balance"
          value={initialBalance}
          onChange={(e) => setInitialBalance(e.target.value)}
        />
        <Button onClick={handleConnect}>Connect</Button>
      </div>
    </div>
  );
};
