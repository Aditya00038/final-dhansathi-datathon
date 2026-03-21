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
import { useBankBalance } from "@/hooks/useBankBalance";
import { useAuth } from "@/contexts/AuthContext";
import { depositToNormalGoalFirestore } from "@/lib/normal-goal-store";

declare const Razorpay: any;

type NormalGoalDepositDialogProps = {
  goalId: string;
  goalName: string;
  onDepositSuccess: () => void;
};

const DepositSchema = z.object({
  amount: z.coerce.number().gt(0, { message: "Deposit amount must be positive." }),
});

type DepositFormValues = z.infer<typeof DepositSchema>;

export function NormalGoalDepositDialog({ goalId, goalName, onDepositSuccess }: NormalGoalDepositDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { bankAccount, updateBalance } = useBankBalance();

  const form = useForm<DepositFormValues>({
    resolver: zodResolver(DepositSchema),
    defaultValues: {
      amount: "" as unknown as number,
    }
  });

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
        document.body.removeChild(script);
    }
  }, []);

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

    setIsSubmitting(true);

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: data.amount * 100,
      currency: "INR",
      name: "DhanSathi",
      description: `Deposit to ${goalName}`,
      modal: {
          ondismiss: () => {
              setIsSubmitting(false);
          }
      },
      handler: async (response: any) => {
        try {
          await depositToNormalGoalFirestore(user.uid, goalId, data.amount, `Razorpay TX: ${response.razorpay_payment_id}`);
          await updateBalance(-data.amount);
          toast({
            title: "Deposit Successful!",
            description: `₹${data.amount} added to "${goalName}".`,
          });
          onDepositSuccess();
          setIsOpen(false);
          form.reset({ amount: "" as unknown as number });
        } catch (error) {
          toast({
            variant: "destructive",
            title: "Deposit Failed",
            description: "Could not record your deposit.",
          });
        } finally {
            setIsSubmitting(false);
        }
      },
      prefill: {
        name: "Test User",
        email: "test.user@example.com",
        contact: "9999999999",
      },
      theme: {
        color: "#3399cc",
      },
    };

    try {
        const rzp = new Razorpay(options);
        rzp.open();
    } catch(err) {
        toast({
            variant: "destructive",
            title: "Payment Error",
            description: "Failed to initialize Razorpay. Please try again later."
        });
        setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" size="lg">
          <PiggyBank className="mr-2" /> Make a Deposit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deposit to "{goalName}"</DialogTitle>
          <DialogDescription>
            Enter the amount you wish to deposit.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
             <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (INR)</FormLabel>
                  <FormControl>
                    <Input type="number" step="any" placeholder="e.g., 500" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting || !bankAccount}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "Processing..." : !bankAccount ? "Connect Bank First" : "Confirm Deposit"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
