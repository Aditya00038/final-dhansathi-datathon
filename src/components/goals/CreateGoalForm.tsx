"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { useWallet } from "@/contexts/WalletContext";
import { deployGoalContract } from "@/lib/blockchain";
import { saveGoalFirestore } from "@/lib/local-store";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const CreateGoalSchema = z.object({
  name: z.string().min(3, { message: "Goal name must be at least 3 characters." }),
  targetAmount: z.coerce.number().gt(0, { message: "Target amount must be greater than 0." }),
  deadline: z.date().min(new Date(), { message: "Deadline must be in the future." }),
});

type CreateGoalFormValues = z.infer<typeof CreateGoalSchema>;

export default function CreateGoalForm() {
  const { toast } = useToast();
  const { activeAddress, signTransactions } = useWallet();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<CreateGoalFormValues>({
    resolver: zodResolver(CreateGoalSchema),
    defaultValues: {
      name: "",
      targetAmount: "" as unknown as number, // Empty string to avoid uncontrolled->controlled warning
      deadline: undefined
    },
  });

  async function onSubmit(data: CreateGoalFormValues) {
    if (!activeAddress) {
      toast({
        variant: "destructive",
        title: "Wallet Not Connected",
        description: "Please connect your Pera wallet to create a goal.",
      });
      return;
    }
    if (!user) {
        toast({
            variant: "destructive",
            title: "Not Authenticated",
            description: "Please log in to create a goal.",
        });
        return;
    }
    setIsSubmitting(true);
    try {
      toast({ title: "Deploying Contract", description: "Please check your wallet to approve the transaction." });
      const appId = await deployGoalContract(
        activeAddress,
        {
          targetAmount: data.targetAmount,
          deadline: data.deadline,
        },
        signTransactions
      );

      toast({ title: "Contract Deployed!", description: `App ID: ${appId}. Now saving metadata...` });

      await saveGoalFirestore(user.uid, {
        name: data.name,
        appId,
      });

      toast({ title: "Goal Created!", description: "Your new savings goal is live on the blockchain." });
      router.push("/");

    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error Creating Goal",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Goal Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., New Laptop" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="targetAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Target Amount (ALGO)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" placeholder="e.g., 10" {...field} />
              </FormControl>
              <p className="text-xs text-muted-foreground mt-1">
                Set target in ALGO. INR value is shown automatically on the dashboard.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="deadline"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Deadline</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date < new Date() || date < new Date("1900-01-01")}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isSubmitting || !activeAddress}>
          {isSubmitting
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deploying Smart Contract...</>
            : "Deploy Smart Contract"
          }
        </Button>
        {!activeAddress && <p className="text-center text-sm text-muted-foreground">Connect your wallet to deploy a smart contract.</p>}
      </form>
    </Form>
  );
}
