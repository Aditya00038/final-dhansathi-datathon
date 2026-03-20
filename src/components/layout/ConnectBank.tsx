'use client';

import Link from 'next/link';
import { useBankBalance } from '@/hooks/useBankBalance';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Landmark, Wallet, LogOut, Loader2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type ConnectBankProps = {
  mobile?: boolean;
};

export function ConnectBank({ mobile = false }: ConnectBankProps) {
  const { bankAccount, loading, disconnectBank } = useBankBalance();
  const { toast } = useToast();

  const handleDisconnect = async () => {
    try {
      await disconnectBank();
      toast({
        title: 'Bank Disconnected',
        description: 'Your virtual bank account has been removed.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Disconnection Failed',
        description: error instanceof Error ? error.message : 'Could not disconnect your bank account.',
      });
    }
  };

  if (loading) {
    return (
      <Button
        variant="outline"
        size="sm"
        className={mobile ? "w-full h-9 text-sm rounded-lg" : "h-8 text-xs rounded-lg"}
        disabled
      >
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </Button>
    )
  }

  if (bankAccount) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={mobile ? "w-full h-9 text-sm justify-start rounded-lg" : "h-auto pl-2 pr-3 py-1.5 flex items-center gap-2"}
          >
            <Landmark className="h-4 w-4 text-muted-foreground flex-shrink-0 mr-2" />
            {mobile ? (
              <span className="truncate">{bankAccount.accountNickname}</span>
            ) : (
              <div className="flex flex-col items-start">
                <span className="text-xs font-semibold leading-tight">{bankAccount.accountNickname}</span>
                <span className="text-xs font-mono leading-tight text-muted-foreground">
                  ₹{bankAccount.balance.toLocaleString('en-IN')}
                </span>
              </div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="end">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold leading-none">{bankAccount.accountNickname}</p>
              <p className="text-sm text-muted-foreground">{bankAccount.bankName}</p>
              <p className="text-2xl font-bold pt-1">₹{bankAccount.balance.toLocaleString('en-IN')}</p>
            </div>
            <Button
              onClick={handleDisconnect}
              variant="destructive"
              size="sm"
              className="w-full"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Disconnect Account
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className={mobile ? "w-full h-9 text-sm rounded-lg" : "h-8 text-xs rounded-lg"}
    >
      <Link href="/connect-bank">
        <Wallet className="mr-2 h-4 w-4" />
        Connect Bank
      </Link>
    </Button>
  );
}
