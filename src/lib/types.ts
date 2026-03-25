import { z } from "zod";

export const TransactionSchema = z.object({
  id: z.string(),
  amount: z.number(),
  date: z.date(),
  merchant: z.string(),
  type: z.enum(["debit", "credit"]),
  accountId: z.string(),
});

export type Transaction = z.infer<typeof TransactionSchema>;

// This new type correctly represents a transaction where the date is a string,
// which is what the AI returns and what the client-side component should expect.
export type AIParsedTransaction = Omit<Partial<Transaction>, "date"> & {
  date?: string;
};

export type SavedSmsTransaction = {
  id: string;
  userId: string;
  amount: number;
  date: string;
  merchant: string;
  type: "debit" | "credit";
  source: "sms-paste" | "cash-manual";
  createdAt: string;
};

// Off-chain (Savings) goal transaction
export type NormalGoalTransaction = {
  id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  timestamp: string;
  note?: string;
};

// Off-chain (Savings) goal in INR, flexible withdrawal
export type NormalGoal = {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentBalance: number;
  deadline: string;
  createdAt: string;
  updatedAt?: string;
  monthlyIncome?: number;
  monthlySpending?: number;
  transactions: NormalGoalTransaction[];
  goalCompleted: boolean;
};

// On-chain goal (Smart Contract in ALGO)
export type Goal = {
  id: string;
  userId: string;
  name: string;
  appId: number;
  deadline?: string;
  deposits: Deposit[];
};

export type Deposit = {
  amount: number;
  timestamp: string;
};
