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

function formatMoney(value: number, currency: GoalAdviceInput['currency']) {
  if (!Number.isFinite(value)) return `0 ${currency}`;
  if (currency === 'INR') return `₹${Math.max(0, value).toLocaleString('en-IN')}`;
  return `${Math.max(0, value).toFixed(2)} ALGO`;
}

function getFallbackResponse(question: string, input: GoalAdviceInput): string {
  const lower = question.toLowerCase();
  const remaining = input.targetAmount - input.currentSaved;
  const deadlineDate = new Date(input.deadline);
  const weeksLeft = Math.max(1, Math.ceil((deadlineDate.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)));
  const perWeek = remaining / weeksLeft;
  const perDay = perWeek / 7;

  const basePlan = [
    `Snapshot: You need ${formatMoney(remaining, input.currency)} in ${weeksLeft} week(s).`,
    `Target pace: ${formatMoney(perWeek, input.currency)}/week (${formatMoney(perDay, input.currency)}/day).`,
    'Next 7 days: Make one deposit today, schedule 2 smaller top-ups, and review spending leaks once this weekend.',
  ].join('\n');

  if (lower.includes('plan') || lower.includes('how')) {
    return `Goal: ${input.goalName}\n${basePlan}\n${FALLBACK_RESPONSES.plan}`;
  }
  if (lower.includes('behind') || lower.includes('catch up')) return FALLBACK_RESPONSES.behind;
  if (lower.includes('motivat') || lower.includes('give up')) return FALLBACK_RESPONSES.motivate;
  if (lower.includes('strateg') || lower.includes('budget')) return FALLBACK_RESPONSES.strategy;

  return `Goal: ${input.goalName}\n${basePlan}\n${FALLBACK_RESPONSES.default}`;
}

export async function getGoalAdvice(input: GoalAdviceInput) {
  const remaining = input.targetAmount - input.currentSaved;
  const deadlineDate = new Date(input.deadline);
  const weeksLeft = Math.max(1, Math.ceil((deadlineDate.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)));
  const perWeek = remaining / weeksLeft;
  const progress = input.targetAmount > 0 ? ((input.currentSaved / input.targetAmount) * 100).toFixed(1) : '0';

  const systemPrompt = `You are DhanSathi Goal Advice Agent.

You must answer like a high-quality finance coach: clear, practical, and specific to THIS exact goal. Keep it professional, warm, and direct.

Hard scope rules:
- Only discuss personal finance and this user's goal details.
- Do not answer unrelated topics.
- If user asks non-finance content, politely redirect to goal finance guidance.
- Never provide harmful/illegal financial instructions.

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
- Use the user's real numbers in every answer
- Keep response concise but structured in markdown with these sections:
  1) Snapshot
  2) What to do this week
  3) Risk and fix
  4) Next best action
- Include at least one concrete numeric target (per day, per week, or per month)
- If the goal seems unreachable, say so gently and suggest a revised timeline/target with numbers
- For INR goals, use ₹ and India-friendly examples; for ALGO goals, keep units in ALGO
- Do not use generic motivation fluff; tie motivation to progress percentage and deadline urgency
- Maximum length: 220 words unless the user explicitly asks for detail`;

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
