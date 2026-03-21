"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, PiggyBank } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { addDepositToGoalFirestore } from "@/lib/local-store";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import { depositToGoal } from "@/lib/blockchain";
import { useBankBalance } from "@/hooks/useBankBalance";

type DepositDialogProps = {
  goalId: string;
  goalName: string;
  appId: number;
  onDepositSuccess: () => void;
  trigger?: React.ReactNode;
  initialAmount?: number;
};

const DepositSchema = z.object({
  amount: z.coerce.number().gt(0, { message: "Deposit amount must be positive." }),
});

type DepositFormValues = z.infer<typeof DepositSchema>;

export function DepositDialog({ goalId, goalName, appId, onDepositSuccess, trigger, initialAmount }: DepositDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { activeAddress, connectWallet, isConnecting, signTransactions } = useWallet();
  const { bankAccount } = useBankBalance();

  const form = useForm<DepositFormValues>({
    resolver: zodResolver(DepositSchema),
    defaultValues: {
      amount: initialAmount || ("" as unknown as number),
    }
  });

  useEffect(() => {
    if (initialAmount) {
      form.setValue("amount", initialAmount);
    }
  }, [initialAmount, form, isOpen]);

  async function onSubmit(data: DepositFormValues) {
    if (!user) {
        toast({
            variant: "destructive",
            title: "Not Authenticated",
            description: "Please log in to make a deposit.",
        });
        return;
    }

    if (!bankAccount) {
      toast({
        variant: "destructive",
        title: "Bank Not Connected",
        description: "Please connect your bank account before making a deposit.",
      });
      return;
    }

    if (!activeAddress) {
      try {
        await connectWallet();
      } catch {
        toast({
          variant: "destructive",
          title: "Wallet Connection Failed",
          description: "Please connect your Pera wallet to continue.",
        });
        return;
      }
    }

    if (!activeAddress) {
      toast({
        variant: "destructive",
        title: "Wallet Not Connected",
        description: "Please connect your Pera wallet to continue.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      toast({
        title: "Confirm in Pera Wallet",
        description: "Review and approve the Algorand transaction in your wallet.",
      });

      const txId = await depositToGoal(appId, activeAddress, data.amount, signTransactions);
      await addDepositToGoalFirestore(user.uid, goalId, { amount: data.amount, txId });

      toast({
        title: "Deposit Successful",
        description: `On-chain transaction confirmed: ${txId.slice(0, 10)}...`,
      });

      onDepositSuccess();
      setIsOpen(false);
      form.reset({ amount: "" as unknown as number });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Deposit Failed",
        description: error instanceof Error ? error.message : "Could not complete on-chain deposit.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const dialogTrigger = trigger || (
    <Button className="w-full" size="lg">
      <PiggyBank className="mr-2" /> Make a Deposit
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {dialogTrigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deposit to "{goalName}"</DialogTitle>
          <DialogDescription>
            Enter the amount in ALGO. You will confirm this transaction in Pera wallet.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
             <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (ALGO)</FormLabel>
                  <FormControl>
                    <Input type="number" step="any" placeholder="e.g., 2.5" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting || isConnecting || !bankAccount}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isConnecting ? "Connecting Wallet..." : isSubmitting ? "Processing..." : !bankAccount ? "Connect Bank First" : "Confirm in Pera Wallet"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
