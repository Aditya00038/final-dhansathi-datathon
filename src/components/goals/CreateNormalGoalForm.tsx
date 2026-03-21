"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon, Loader2, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "../ui/form";
import { createNormalGoalFirestore } from "@/lib/normal-goal-store";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const NormalGoalSchema = z.object({
  name: z.string().min(3, { message: "Goal name must be at least 3 characters." }),
  targetAmount: z.coerce.number().gt(0, { message: "Target amount must be greater than 0." }),
  deadline: z.date().min(new Date(), { message: "Deadline must be in the future." }),
  monthlyIncome: z.coerce.number().min(0).optional(),
  monthlySpending: z.coerce.number().min(0).optional(),
});

type NormalGoalFormValues = z.infer<typeof NormalGoalSchema>;

export default function CreateNormalGoalForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  const form = useForm<NormalGoalFormValues>({
    resolver: zodResolver(NormalGoalSchema),
    defaultValues: {
      name: "",
      targetAmount: "" as unknown as number,
      deadline: undefined,
      monthlyIncome: "" as unknown as number,
      monthlySpending: "" as unknown as number,
    },
  });

  async function onSubmit(data: NormalGoalFormValues) {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Not Logged In",
        description: "You must be logged in to create a goal.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const goal = await createNormalGoalFirestore(user.uid, {
        name: data.name,
        targetAmount: data.targetAmount,
        deadline: data.deadline.toISOString(),
        monthlyIncome: data.monthlyIncome || undefined,
        monthlySpending: data.monthlySpending || undefined,
      });

      toast({
        title: "Goal Created!",
        description: `"${goal.name}" — Save ₹${data.targetAmount.toLocaleString("en-IN")} by ${format(data.deadline, "PPP")}.`,
      });
      router.push(`/savings/${goal.id}`);
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
                <Input placeholder="e.g., New Laptop, Emergency Fund, Vacation" {...field} />
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
              <FormLabel>Target Amount (₹ INR)</FormLabel>
              <FormControl>
                <Input type="number" step="1" placeholder="e.g., 50000" {...field} />
              </FormControl>
              <FormDescription>
                How much do you want to save for this goal?
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="deadline"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Target Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "h-11 w-full justify-start rounded-xl border-border/60 bg-background text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? format(field.value, "PPP") : <span>When do you want to reach this goal?</span>}
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto rounded-xl border border-border/60 p-2 shadow-lg" align="start">
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

        <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            Smart AI Advisor — Add your financials for personalized tips
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="monthlyIncome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Income (₹)</FormLabel>
                  <FormControl>
                    <Input type="number" step="1" placeholder="e.g., 30000" {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">Optional — helps AI give better advice</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="monthlySpending"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Spending (₹)</FormLabel>
                  <FormControl>
                    <Input type="number" step="1" placeholder="e.g., 20000" {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">Optional — helps AI give better advice</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting || !user}>
          {isSubmitting
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Goal...</>
            : "Create Savings Goal"
          }
        </Button>
      </form>
    </Form>
  );
}
