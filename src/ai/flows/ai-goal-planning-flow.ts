'use server';
/**
 * @fileOverview An AI agent that suggests a realistic target amount, suitable deadline,
 * and a personalized savings plan based on a user's goal description.
 */

import { ai } from '@/ai/genkit';

export interface AIGoalPlanningInput {
  goalDescription: string;
}

export interface AIGoalPlanningOutput {
  suggestedTargetAmount: number;
  suggestedDeadline: string;
  suggestedSavingsPlan: string;
}

// Fallback planning when AI is not configured
function getFallbackPlan(): AIGoalPlanningOutput {
  const today = new Date();
  const deadline = new Date(today.setMonth(today.getMonth() + 3));
  
  return {
    suggestedTargetAmount: 5,
    suggestedDeadline: deadline.toISOString().split('T')[0],
    suggestedSavingsPlan: "Save 0.5 ALGO weekly to reach your goal in 3 months. Start small and increase gradually as you build the habit!",
  };
}

export async function aiGoalPlanning(
  input: AIGoalPlanningInput
): Promise<AIGoalPlanningOutput> {
  const prompt = `As an expert financial advisor, suggest a realistic savings plan for a student.

Goal: ${input.goalDescription}

Provide:
1. Target amount in ALGO (number only)
2. Deadline in YYYY-MM-DD format
3. A weekly/monthly savings plan

Respond in JSON format: {\"suggestedTargetAmount\": 5, \"suggestedDeadline\": \"2026-05-01\", \"suggestedSavingsPlan\": \"...\"}`;

  try {
    const { text } = await ai.generate({ prompt });
    const parsed = JSON.parse(text || '{}');
    return {
      suggestedTargetAmount: parsed.suggestedTargetAmount || 5,
      suggestedDeadline: parsed.suggestedDeadline || getFallbackPlan().suggestedDeadline,
      suggestedSavingsPlan: parsed.suggestedSavingsPlan || getFallbackPlan().suggestedSavingsPlan,
    };
  } catch (error) {
    return getFallbackPlan();
  }
}
