'use server';

import { extractTransactionsFromSms } from "@/lib/ai-parser";
import type { AIParsedTransaction } from "@/lib/types";

// The server action now has a clear, explicit return type.
export async function parseSmsAction(sms: string): Promise<{ success: boolean; transactions: AIParsedTransaction[]; error?: string; }> {
    try {
        // The call to the AI parser now directly returns the correctly typed transactions.
        const transactions = await extractTransactionsFromSms(sms);
        
        // No more unnecessary date serialization is needed here.
        return { success: true, transactions: transactions };
    } catch (error: any) {
        console.error("Error in parseSmsAction:", error);
        // Ensure the transactions array is empty on failure.
        return { success: false, transactions: [], error: error.message || 'An unknown server error occurred.' };
    }
}
