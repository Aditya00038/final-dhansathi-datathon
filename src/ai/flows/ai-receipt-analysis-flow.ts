'use server';
/**
 * @fileOverview An AI agent that analyzes a receipt image and suggests a micro-saving amount.
 */

import { ai } from '@/ai/genkit';

export interface ReceiptAnalysisInput {
  imageDataUri: string;
  goalName: string;
}

export interface ReceiptAnalysisOutput {
  suggestedAmount: number;
  reason: string;
}

// Fallback when AI is not configured
function getFallbackAnalysis(goalName: string): ReceiptAnalysisOutput {
  return {
    suggestedAmount: 0.5,
    reason: `Great job tracking your spending! Consider saving 0.5 ALGO towards your "${goalName}" goal.`,
  };
}

export async function analyzeReceipt(
  input: ReceiptAnalysisInput
): Promise<ReceiptAnalysisOutput> {
  const prompt = `You are a savings assistant. The user uploaded a receipt for their goal: \"${input.goalName}\".

Suggest a micro-saving amount (0.5 to 2 ALGO) and give a short encouraging reason.

Respond in JSON: {\"suggestedAmount\": 0.5, \"reason\": \"...\"}`;

  try {
    const parts = input.imageDataUri
      ? [{ text: prompt }, { media: { url: input.imageDataUri } }]
      : [{ text: prompt }];
    const { text } = await ai.generate(parts);
    const parsed = JSON.parse(text || '{}');
    return {
      suggestedAmount: parsed.suggestedAmount || 0.5,
      reason: parsed.reason || getFallbackAnalysis(input.goalName).reason,
    };
  } catch (error) {
    return getFallbackAnalysis(input.goalName);
  }
}
