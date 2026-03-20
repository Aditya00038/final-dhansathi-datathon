'use server';
/**
 * @fileOverview An AI agent that provides personalized congratulatory messages and micro-tips for savings achievements.
 */

import { ai } from '@/ai/genkit';

export interface AchievementCoachInput {
  achievementName: string;
  goalName: string;
  currentSaved: number;
  targetAmount: number;
  progressPercentage: number;
}

export interface AchievementCoachOutput {
  congratulatoryMessage: string;
  microTip: string;
}

const DEFAULT_MESSAGE = "Great progress on your savings journey! Every deposit is securely recorded on the blockchain.";
const DEFAULT_TIP = "Keep up the consistent saving - you're building a great financial habit!";

export async function getAchievementCoachAdvice(input: AchievementCoachInput): Promise<AchievementCoachOutput> {

  const prompt = `You are an encouraging financial coach for students. A student has just unlocked the \"${input.achievementName}\" milestone for their savings goal: \"${input.goalName}\".

Current status:
- Saved: ${input.currentSaved} ALGO
- Target: ${input.targetAmount} ALGO
- Progress: ${input.progressPercentage}%

Generate:
1. A congratulatory message (2-3 sentences) explaining this achievement and that it's recorded on the blockchain
2. A relevant micro-tip to help them continue saving

Respond in JSON format: {\"congratulatoryMessage\": \"...\", \"microTip\": \"...\"}`;

  try {
    const { text } = await ai.generate({ prompt });
    const parsed = JSON.parse(text || '{}');
    return {
      congratulatoryMessage: parsed.congratulatoryMessage || DEFAULT_MESSAGE,
      microTip: parsed.microTip || DEFAULT_TIP,
    };
  } catch (error) {
    console.error('Error generating achievement advice:', error);
    return {
      congratulatoryMessage: DEFAULT_MESSAGE,
      microTip: DEFAULT_TIP,
    };
  }
}
