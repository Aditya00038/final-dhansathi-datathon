'use server';

import { ai } from '@/ai/genkit';

interface GoalAdviceInput {
  goalName: string;
  targetAmount: number; // in ALGO or INR depending on goal type
  currentSaved: number;
  deadline: string;
  currency: 'ALGO' | 'INR';
  monthlyIncome?: number;
  monthlySpending?: number;
  userQuestion?: string;
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
}

const FALLBACK_RESPONSES: Record<string, string> = {
  plan: "To achieve your goal, break it into weekly milestones. Calculate how much you need per week: (target - saved) / weeks_left. Automate your savings if possible, and track progress weekly!",
  behind: "Don't worry about being behind! Reassess your budget — can you cut 10-15% of non-essential spending? Even small increases in weekly savings compound over time.",
  motivate: "Remember why you started! Visualize achieving your goal. Every deposit, no matter how small, is progress. You're building discipline that will serve you for life!",
  strategy: "Try the 50/30/20 rule: 50% needs, 30% wants, 20% savings. If your goal needs more, temporarily adjust to 50/25/25. Track every expense for a week to find hidden savings.",
  default: "Stay consistent with your savings plan. Break your target into weekly amounts, track your progress, and celebrate milestones along the way!",
};

function getFallbackResponse(question: string, input: GoalAdviceInput): string {
  const lower = question.toLowerCase();
  const remaining = input.targetAmount - input.currentSaved;
  const deadlineDate = new Date(input.deadline);
  const weeksLeft = Math.max(1, Math.ceil((deadlineDate.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)));
  const perWeek = remaining / weeksLeft;

  if (lower.includes('plan') || lower.includes('how')) {
    return `To reach your ${input.goalName} goal, you need to save approximately ${perWeek.toFixed(2)} ${input.currency}/week. ${FALLBACK_RESPONSES.plan}`;
  }
  if (lower.includes('behind') || lower.includes('catch up')) return FALLBACK_RESPONSES.behind;
  if (lower.includes('motivat') || lower.includes('give up')) return FALLBACK_RESPONSES.motivate;
  if (lower.includes('strateg') || lower.includes('budget')) return FALLBACK_RESPONSES.strategy;

  return `You need ${remaining.toFixed(2)} ${input.currency} more in ${weeksLeft} weeks (${perWeek.toFixed(2)} ${input.currency}/week). ${FALLBACK_RESPONSES.default}`;
}

export async function getGoalAdvice(input: GoalAdviceInput) {
  const remaining = input.targetAmount - input.currentSaved;
  const deadlineDate = new Date(input.deadline);
  const weeksLeft = Math.max(1, Math.ceil((deadlineDate.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)));
  const perWeek = remaining / weeksLeft;
  const progress = input.targetAmount > 0 ? ((input.currentSaved / input.targetAmount) * 100).toFixed(1) : '0';

  const systemPrompt = `You are a Goal Achievement Advisor for DhanSathi, a savings app. You help users create actionable plans to accomplish their specific savings goals.

Your role:
1. Analyze the user's goal, progress, and timeline
2. Create personalized step-by-step plans
3. Suggest weekly/monthly savings targets
4. Identify potential challenges and solutions
5. Provide motivation and accountability tips
6. Suggest income-boosting or expense-cutting strategies when relevant

Current Goal Details:
- Goal: "${input.goalName}"
- Target: ${input.targetAmount} ${input.currency}
- Saved so far: ${input.currentSaved} ${input.currency}
- Remaining: ${remaining.toFixed(2)} ${input.currency}
- Progress: ${progress}%
- Deadline: ${input.deadline}
- Weeks remaining: ${weeksLeft}
- Required per week: ${perWeek.toFixed(2)} ${input.currency}
${input.monthlyIncome ? `- Monthly Income: ₹${input.monthlyIncome}` : ''}
${input.monthlySpending ? `- Monthly Spending: ₹${input.monthlySpending}` : ''}
${input.monthlyIncome && input.monthlySpending ? `- Monthly Savings Capacity: ₹${input.monthlyIncome - input.monthlySpending}` : ''}

Guidelines:
- Be specific and actionable — no vague advice
- Keep responses concise (2-3 paragraphs max)
- Use the user's actual numbers in your advice
- Be encouraging but realistic
- For Indian users, give culturally relevant tips
- If the goal seems unreachable, gently suggest adjusting the timeline or target`;

  const conversationHistory = input.conversationHistory
    ?.map((msg) => ({
      role: (msg.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
      content: [{ text: msg.content }],
    })) || [];

  const userQ = input.userQuestion || `Create a plan to help me achieve my "${input.goalName}" goal.`;

  try {
    const { text } = await ai.generate({
      system: systemPrompt,
      messages: [
        ...conversationHistory,
        { role: 'user', content: [{ text: userQ }] },
      ],
    });
    return {
      success: true,
      response: text || "Let me help you plan! Could you tell me more about your situation?",
    };
  } catch (error) {
    console.error('Error generating goal advice:', error);
    return {
      success: true,
      response: getFallbackResponse(userQ, input),
    };
  }
}
