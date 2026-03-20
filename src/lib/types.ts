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
