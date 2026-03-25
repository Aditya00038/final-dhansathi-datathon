'use server';

import { ai, isAIConfigured } from '../genkit';

let aiCooldownUntil = 0;

function extractRetryMsFromError(error: unknown): number {
  const msg = String((error as any)?.message || error || '');
  const secondsMatch = msg.match(/Please retry in\s+([\d.]+)s/i);
  if (secondsMatch) {
    const seconds = Number(secondsMatch[1]);
    if (!Number.isNaN(seconds) && seconds > 0) return Math.ceil(seconds * 1000);
  }
  return 60_000;
}

function isQuotaOrRateLimitError(error: unknown): boolean {
  const msg = String((error as any)?.message || error || '').toLowerCase();
  return msg.includes('429') || msg.includes('too many requests') || msg.includes('quota exceeded') || msg.includes('rate limit');
}

interface FinancialAdviceInput {
  userMessage: string;
  context?: {
    totalSaved?: number;
    totalTarget?: number;
    totalSavedInr?: number;
    totalTargetInr?: number;
    activeGoals?: number;
    completedGoals?: number;
    recentDeposits?: { amount: number; date: string }[];
    goals?: Array<{
      name: string;
      type: "on-chain" | "off-chain";
      targetAmount: number;
      currentSaved: number;
      deadline: string;
      currency: "ALGO" | "INR";
      goalCompleted: boolean;
      transactions?: Array<{
        type: "deposit" | "withdrawal";
        amount: number;
        timestamp: string;
      }>;
    }>;
    todaySpending?: Array<{
      amount: number;
      merchant: string;
      category: string;
    }>;
    todayTotal?: number;
  };
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
}

function compactResponse(text: string): string {
  const cleaned = text.replace(/\n{3,}/g, '\n\n').trim();
  if (cleaned.length <= 700) return cleaned;

  const sliced = cleaned.slice(0, 700);
  const lastSentence = Math.max(
    sliced.lastIndexOf('. '),
    sliced.lastIndexOf('! '),
    sliced.lastIndexOf('? ')
  );

  if (lastSentence > 240) {
    return `${sliced.slice(0, lastSentence + 1).trim()}\n\nIf you want, I can expand this in detail.`;
  }

  return `${sliced.trim()}...\n\nIf you want, I can expand this in detail.`;
}

// ─── Smart Intent Detection ───
type Intent =
  | 'greeting' | 'save_more' | 'budgeting' | 'smart_contract_vs_savings'
  | 'set_goal' | 'motivation' | 'student_finance' | 'investment'
  | 'emergency_fund' | 'debt' | 'expense_tracking' | 'income_boost'
  | 'habit_building' | 'app_help' | 'multiple_goals' | 'progress_check'
  | 'goal_specific' | 'daily_spending_check' | 'general';

function detectIntent(message: string, context?: FinancialAdviceInput['context']): Intent {
  const m = message.toLowerCase();

  // Follow-up questions like "when i deposit 600 date" should stay goal-aware
  if (/\b(when|date)\b.*\b(deposit|deposited|saved|add|added|put)\b|\b(deposit|deposited|saved|add|added|put)\b.*\b(when|date)\b/i.test(m))
    return 'goal_specific';
  
  // Check for daily spending questions
  if (/today.*spend|did.*spend.*today|how.*much.*spend|today.*expense|spent.*today|today.*money/i.test(m))
    return 'daily_spending_check';
  
  // Check if mentioning a specific goal by name
  if (context?.goals && context.goals.length > 0) {
    for (const goal of context.goals) {
      if (m.includes(goal.name.toLowerCase()) || m.includes(goal.name.toLowerCase().split(' ')[0])) {
        return 'goal_specific';
      }
    }
  }
  
  // Greetings
  if (/^(hi|hello|hey|namaste|hii+|sup|yo|good\s*(morning|evening|afternoon)|help me|i need help|i want.*help)/i.test(m))
    return 'greeting';
  if (/smart\s*contract|locked|vault|lock.*fund|contract\s*vs|blockchain\s*sav/i.test(m))
    return 'smart_contract_vs_savings';
  if (/set.*goal|create.*goal|new.*goal|goal.*plan|start.*goal|how.*goal/i.test(m))
    return 'set_goal';
  if (/budget|50.?30.?20|expense.*cut|cut.*spend|track.*spend|where.*money.*go|manage.*money/i.test(m))
    return 'budgeting';
  if (/save.*more|saving.*tip|how.*save|increase.*saving|save.*better|save.*money/i.test(m))
    return 'save_more';
  if (/motivat|give.*up|discourage|hard.*save|can.?t.*save|feel.*like.*quit|stay.*commit/i.test(m))
    return 'motivation';
  if (/student|college|school|hostel|pocket.*money|allowance|part.*time/i.test(m))
    return 'student_finance';
  if (/invest|mutual.*fund|stock|sip|fix.*deposit|fd|ppf|elss|nps|crypto/i.test(m))
    return 'investment';
  if (/emergency|rainy.*day|unexpected|backup.*fund|safety.*net/i.test(m))
    return 'emergency_fund';
  if (/debt|loan|emi|borrow|credit.*card|repay|interest/i.test(m))
    return 'debt';
  if (/track|monitor|where.*spend|log.*expense|expense.*app/i.test(m))
    return 'expense_tracking';
  if (/income|earn.*more|side.*hustle|freelanc|extra.*money|passive/i.test(m))
    return 'income_boost';
  if (/habit|daily|routine|discipline|automat|regular/i.test(m))
    return 'habit_building';
  if (/how.*use|app.*work|feature|what.*can|how.*this|tutorial|dhansathi/i.test(m))
    return 'app_help';
  if (/multiple.*goal|many.*goal|priorit|which.*goal.*first/i.test(m))
    return 'multiple_goals';
  if (/progress|how.*am.*i|on.*track|status|doing.*well/i.test(m))
    return 'progress_check';
  return 'general';
}

// ─── Smart Contextual Response Generator ───
function generateSmartResponse(message: string, context?: FinancialAdviceInput['context']): {
  response: string;
  suggestions: string[];
} {
  const intent = detectIntent(message, context);

  const saved = context?.totalSaved ?? 0;
  const target = context?.totalTarget ?? 0;
  const savedInr = context?.totalSavedInr ?? 0;
  const targetInr = context?.totalTargetInr ?? 0;
  const active = context?.activeGoals ?? 0;
  const completed = context?.completedGoals ?? 0;
  const progress = target > 0 ? ((saved / target) * 100).toFixed(1) : '0';
  const hasContext = context && (saved > 0 || target > 0 || savedInr > 0 || targetInr > 0 || active > 0);

  const contextLine = hasContext
    ? `\n\n📊 Your Stats: ${saved.toFixed(2)} ALGO saved (${progress}%) • ₹${savedInr.toLocaleString('en-IN')} in Savings Goals • ${active} active goal${active !== 1 ? 's' : ''} • ${completed} completed`
    : '';

  // Helper function to find matching goal
  function findGoal(message: string) {
    if (!context?.goals || context.goals.length === 0) return null;
    const lower = message.toLowerCase();
    const byName = context.goals.find(g => lower.includes(g.name.toLowerCase()) || lower.includes(g.name.toLowerCase().split(' ')[0]));
    if (byName) return byName;

    // Try matching by asked amount (e.g. "when i deposit 600?")
    const amountMatch = lower.match(/(?:₹|rs\.?\s*)?\s*(\d{2,}(?:,\d{3})*(?:\.\d+)?)/);
    const askedAmount = amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : NaN;
    if (!Number.isNaN(askedAmount)) {
      const byAmount = context.goals.find((g) =>
        (g.transactions || []).some((tx) => tx.type === 'deposit' && Math.abs(tx.amount - askedAmount) < 0.01)
      );
      if (byAmount) return byAmount;
    }

    // If only one goal exists, assume follow-up refers to that goal
    if (context.goals.length === 1) return context.goals[0];
    return null;
  }

  switch (intent) {
    case 'daily_spending_check':
      if (context?.todaySpending && context.todaySpending.length > 0) {
        const transactions = context.todaySpending
          .map(t => `• ${t.merchant} — ₹${t.amount.toLocaleString('en-IN')} (${t.category})`)
          .join('\n');
        return {
          response: `**Today's Spending** 💸\n\n**Total: ₹${(context.todayTotal || 0).toLocaleString('en-IN')}**\n\n${transactions}\n\n**Tips:**\nYou've spent ₹${(context.todayTotal || 0).toLocaleString('en-IN')} so far today. If this is higher than usual, consider:\n• Avoiding food delivery tomorrow\n• Using public transport instead of cabs\n• Cutting one discretionary purchase\n\nEvery rupee saved → deposit to **GTA VI goal** (currently 12% complete, ₹4,400 remaining!)`,
          suggestions: ['Show me weekly spending', 'How to reduce spending?', 'View Analytics', 'Track cash spending'],
        };
      } else {
        return {
          response: `**Today's Spending** 💸\n\n✅ **Great! No spending tracked yet today**\n\nYou haven't logged any expenses yet. Ways to track:\n\n1. **Bank SMS:** Go to **SMS Parser** → paste your bank alert SMS\n2. **Cash spending:** Use **Cash Spender** tool in SMS Parser\n3. **See all:** Go to **Analytics** page for complete view\n\nKeeping today zero or low helps your **GTA VI goal**! 🎯`,
          suggestions: ['Track with SMS', 'Add cash spending', 'View Analytics', 'How to save more?'],
        };
      }

    case 'goal_specific':
      const goal = findGoal(message);
      if (goal) {
        const isDepositQuestion = /\b(did|have|has|am|i)\b.*\b(deposit|deposited|saved|add|added|put)\b|\bdeposit\b.*\b(goal|money|for)\b/i.test(message.toLowerCase());
        const isDateQuestion = /\bwhen\b|\bdate\b|\bwhich\s+day\b/i.test(message.toLowerCase());
        const goalProgress = goal.targetAmount > 0 
          ? ((goal.currentSaved / goal.targetAmount) * 100).toFixed(1)
          : '0';
        const remaining = Math.max(0, goal.targetAmount - goal.currentSaved);
        const deadlineDate = new Date(goal.deadline);
        const today = new Date();
        const daysLeft = Math.max(1, Math.ceil((deadlineDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)));
        const weeksLeft = Math.ceil(daysLeft / 7);
        const perDay = remaining / daysLeft;
        const perWeek = remaining / weeksLeft;

        const currencySymbol = goal.currency === 'INR' ? '₹' : '';
        const amountFormat = (amt: number) => currencySymbol 
          ? `₹${Math.round(amt).toLocaleString('en-IN')}`
          : `${amt.toFixed(2)} ALGO`;

        const amountMatch = message.toLowerCase().match(/(?:₹|rs\.?\s*)?\s*(\d{2,}(?:,\d{3})*(?:\.\d+)?)/);
        const askedAmount = amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : NaN;

        if (isDepositQuestion && isDateQuestion) {
          const deposits = (goal.transactions || [])
            .filter((tx) => tx.type === 'deposit')
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

          const matchedDeposit = !Number.isNaN(askedAmount)
            ? deposits.find((tx) => Math.abs(tx.amount - askedAmount) < 0.01)
            : deposits[0];

          if (matchedDeposit) {
            return {
              response: `You deposited ${amountFormat(matchedDeposit.amount)} for **${goal.name}** on **${new Date(matchedDeposit.timestamp).toLocaleDateString()}**.\n\nCurrent progress:\n• Saved: ${amountFormat(goal.currentSaved)}\n• Target: ${amountFormat(goal.targetAmount)}\n• Progress: ${goalProgress}%`,
              suggestions: [
                'Show my latest deposits',
                `How much weekly for ${goal.name}?`,
                'Am I on track?',
                'How to finish faster?'
              ],
            };
          }

          return {
            response: `I could not find a deposit record${!Number.isNaN(askedAmount) ? ` of ${amountFormat(askedAmount)}` : ''} for **${goal.name}** in your goal transactions.\n\nCurrent progress:\n• Saved: ${amountFormat(goal.currentSaved)}\n• Target: ${amountFormat(goal.targetAmount)}\n• Progress: ${goalProgress}%`,
            suggestions: [
              'Show goal progress',
              'Did I deposit for this goal?',
              'How much should I save weekly?',
              'View goal details'
            ],
          };
        }

        if (isDepositQuestion) {
          const hasDeposited = goal.currentSaved > 0;
          return {
            response: `${hasDeposited ? 'Yes' : 'No'}${hasDeposited ? `, you have deposited for **${goal.name}**.` : `, no deposit is recorded yet for **${goal.name}**.`}\n\n• Saved: ${amountFormat(goal.currentSaved)}\n• Target: ${amountFormat(goal.targetAmount)}\n• Progress: ${goalProgress}%\n• Remaining: ${amountFormat(remaining)}\n\n${hasDeposited ? 'You are on track. Keep adding weekly to finish on time.' : 'Make your first deposit now to start building momentum.'}`,
            suggestions: [
              `How much should I save weekly for ${goal.name}?`,
              'Show my goal progress',
              'How to finish faster?',
              'Motivate me'
            ],
          };
        }

        return {
          response: `**${goal.name}** ${goal.type === 'on-chain' ? '🔒' : '💰'}\n\n**Current Status:**\n• Saved: ${amountFormat(goal.currentSaved)}\n• Target: ${amountFormat(goal.targetAmount)}\n• Progress: ${goalProgress}%\n• Days Left: ${daysLeft} (${weeksLeft} weeks)\n\n**What You Need:**\n• Daily: ${amountFormat(perDay)}\n• Weekly: ${amountFormat(perWeek)}\n\n${goal.goalCompleted ? '✅ **Goal completed! Celebrate your achievement!**' : remaining > 0 ? `**To finish on time:** Save ${amountFormat(perWeek)}/week starting now. Going strong! 💪` : '**Almost there!**'}\n\nGo to your goal's detail page for personalized AI advice on how to reach it faster!`,
          suggestions: [
            `How to save ${amountFormat(perWeek)}/week?`,
            goal.type === 'off-chain' ? 'Withdraw from this goal?' : 'About this Smart Contract goal',
            'What if I fall behind?',
            'Motivate me to finish'
          ],
        };
      }
      // Fallback if goal not found
      return {
        response: `I couldn't find a goal matching "${message.split(/\s+/).find(w => w.length > 3) || 'that'}" in your active goals.\n\n**Your Current Goals:**\n${context?.goals && context.goals.length > 0 
          ? context.goals.map(g => `• ${g.name} (${g.type === 'on-chain' ? 'Smart Contract' : 'Savings'}) — ${((g.currentSaved / g.targetAmount) * 100).toFixed(0)}% complete`).join('\n')
          : 'No active goals yet. Create one to get started!'}\n\nWhich goal would you like help with?`,
        suggestions: context?.goals?.map(g => g.name) || ['Create a savings goal', 'Create a Smart Contract goal', 'Help me set a goal'],
      };

    case 'greeting':
      return {
        response: `Hello! Welcome to DhanSathi 👋\n\nI'm your personal financial assistant. I can help you with:\n\n💰 **Savings strategies** — tips to save more effectively\n🎯 **Goal planning** — create & track financial goals\n📊 **Budgeting** — manage income & expenses smartly\n🔒 **Smart Contracts** — lock funds for disciplined saving\n📈 **Investment ideas** — grow your money\n💪 **Motivation** — stay on track\n\nWhat would you like to explore?${contextLine}`,
        suggestions: ['How can I save more?', 'Help me set a goal', 'Smart Contract vs Savings?', 'Budgeting tips'],
      };

    case 'save_more':
      return {
        response: `Here are **proven strategies to save more** 💰\n\n**1. The 50/30/20 Rule**\nAllocate your income: 50% to needs (rent, food, bills), 30% to wants (entertainment, shopping), and 20% to savings. If you're serious about your goal, try 50/20/30 — putting 30% into savings!\n\n**2. Pay Yourself First**\nThe moment you receive income, transfer your savings amount FIRST. Don't save what's left after spending — spend what's left after saving.\n\n**3. The ₹100/Day Challenge**\nSave ₹100 every day into DhanSathi. That's ₹3,000/month or ₹36,500/year! Start small and increase gradually.\n\n**4. Cut These Common Leaks**\n• Cancel unused subscriptions (Netflix, Spotify you don't use)\n• Cook at home 3 extra days/week → save ₹2,000-4,000/month\n• Use public transport 2 days/week\n• Switch to a cheaper phone plan\n\n**5. The 24-Hour Rule**\nBefore any non-essential purchase over ₹500, wait 24 hours. You'll skip 60% of impulse buys!${contextLine}`,
        suggestions: ['Tell me about 50/30/20 rule', 'How to build saving habit?', 'Smart Contract vs Savings?', 'Income boosting tips'],
      };

    case 'budgeting':
      return {
        response: `**Budgeting Made Simple in DhanSathi** 📊\n\n**Step 1: Connect Your Bank (Optional)**\n• Go to **Dashboard** → **Connect Bank**\n• Transactions auto-import, auto-categorize\n• See real spending instantly\n\n**Step 2: Track Cash/SMS Spending**\n• Go to **SMS Parser**\n• Paste bank SMS messages → auto-extracts spending\n• Or use **Cash Spender** to manually log cash spending\n• All tracked in one place\n\n**Step 3: Review Your Analytics**\n• Go to **Analytics** page\n• See pie chart: Food, Shopping, Travel, Bills breakdown\n• View recent transactions\n• Check: "Where is my money actually going?"\n\n**Step 4: Find Leaks & Cut Costs**\nOnce you see categories:\n🍔 **Food spending ₹X?** → Cook at home 3x/week = save ₹2000-4000/month\n🚗 **Transport ₹Y?** → Use transit 2x/week = save ₹500-1000/month\n📱 **Subscriptions ₹Z?** → Cancel unused apps = save ₹500+/month\n\n**Step 5: Redirect Savings → Goal**\nMoney you cut from budget = deposit to your **Savings Goal** (GTA VI!)\n\n**Pro Tip**: Review analytics every Sunday. Takes 10 minutes, saves ₹1000s/month!`,
        suggestions: ['Send my bank SMS', 'View my analytics', 'Track cash spending', 'Save more tips'],
      };

    case 'smart_contract_vs_savings':
      return {
        response: `Great question! Here's the difference between **Smart Contract Goals** and **Savings Goals** in DhanSathi 🔒 vs 💰\n\n**🔒 Smart Contract Goals**\n• Your funds are **locked on the Algorand blockchain**\n• You **cannot withdraw** until you reach your target or deadline passes\n• Perfect for people who struggle with impulse withdrawals\n• Enforces **Discipline-as-a-Service** — the code won't let you quit!\n• Funds saved in **ALGO** (cryptocurrency)\n• Requires an Algorand wallet\n• Best for: Big goals where you need maximum discipline\n\n**💰 Savings Goals (Flexible)**\n• You can **withdraw anytime** — full flexibility\n• Track progress with AI predictions & advice\n• Funds in **INR (₹)** — no crypto needed\n• Great for: Short-term goals, emergency savings, or if you're new\n\n**Which should you choose?**\n• 🔒 Use Smart Contract if: "I know I'll withdraw early if I can"\n• 💰 Use Savings if: "I want flexibility but still want to track goals"\n\n**Pro tip**: Start with a Savings Goal to build the habit, then graduate to Smart Contract for bigger goals!`,
        suggestions: ['Create a Smart Contract goal', 'Create a Savings goal', 'Tell me about Algorand', 'How to stay disciplined?'],
      };

    case 'set_goal':
      return {
        response: `Let me help you **set a great financial goal** 🎯\n\n**The SMART Framework for Savings Goals:**\n\n✅ **Specific**: Not "save money" → "Save ₹50,000 for a new laptop"\n✅ **Measurable**: Track progress in DhanSathi\n✅ **Achievable**: Based on your actual income/expenses\n✅ **Relevant**: Something you truly care about\n✅ **Time-bound**: Set a realistic deadline\n\n**Popular Goal Ideas:**\n1. 🚨 **Emergency Fund** — 3-6 months of expenses (start with 1 month!)\n2. 💻 **Gadget/Device** — ₹20,000-80,000 in 3-6 months\n3. ✈️ **Travel** — ₹15,000-50,000 depending on destination\n4. 📚 **Education** — Course fees, books, certifications\n5. 🏠 **Rent Deposit** — Usually 2-3 months rent\n\n**Quick Calculator:**\nIf your goal is ₹30,000 in 3 months:\n→ Save ₹10,000/month\n→ Or ₹2,500/week\n→ Or ₹360/day\n\nBreaking it down makes it feel achievable!\n\n**Next step**: Go to Savings or Smart Contract in the nav to create your goal. I can help you decide which type is right for you!`,
        suggestions: ['Which goal type should I pick?', 'Calculate my weekly savings', 'What if I can\'t save that much?', 'Smart Contract vs Savings?'],
      };

    case 'motivation':
      return {
        response: `I hear you — saving isn't always easy. But you're already ahead just by thinking about it! 💪\n\n**Remember Your "Why"**\nClose your eyes and picture yourself with that goal accomplished. How does it feel? That feeling is your fuel.\n\n**The Science of Small Wins**\nYour brain releases dopamine (the feel-good chemical) when you hit milestones. That's why DhanSathi shows your progress bar — every deposit moves it forward!\n\n**Reframe Your Thinking**\n❌ "I'm sacrificing fun to save"\n✅ "I'm choosing my future self over a temporary want"\n\n**The Compound Effect**\n• ₹50/day → ₹1,500/month → ₹18,250/year\n• ₹100/day → ₹3,000/month → ₹36,500/year\n• ₹200/day → ₹6,000/month → ₹73,000/year\nSmall daily amounts become life-changing money!\n\n**When You Feel Like Quitting:**\n1. Look at your progress in DhanSathi\n2. Remember: 80% of success is just showing up\n3. Even ₹10 is better than ₹0 — deposit something, anything\n4. Consider a Smart Contract goal — it literally prevents quitting!\n\nYou've got this! 🚀`,
        suggestions: ['Show me my progress', 'How to build a saving habit?', 'Tell me about Smart Contract lock', 'Daily savings challenge'],
      };

    case 'student_finance':
      return {
        response: `**Student Finance Guide** 🎓\n\nManaging money as a student is tough, but starting now gives you a HUGE advantage!\n\n**Income Ideas for Students:**\n• 💻 Freelancing on Fiverr/Upwork (writing, design, coding) — ₹5,000-20,000/month\n• 📞 Part-time customer support — ₹8,000-15,000/month\n• 📚 Tutoring juniors — ₹200-500/hour\n• 🛍️ Sell notes/study materials online\n• 📱 Social media management — ₹3,000-10,000/month\n\n**Student Saving Hacks:**\n• Cook in batches on weekends → cheapest meals all week\n• Use student discounts EVERYWHERE (many apps have student plans)\n• Share subscriptions with friends (Netflix, Spotify family)\n• Buy second-hand textbooks or use library\n• Walk/cycle for short distances → save ₹50-100/day\n\n**Micro-Saving Strategy:**\nEven ₹500/month matters! Start a Savings Goal in DhanSathi:\n• ₹500/month × 12 months = ₹6,000/year\n• ₹1,000/month × 12 months = ₹12,000/year\n\nMany successful people started saving as students. Your future self will thank you! 🌟`,
        suggestions: ['Freelancing tips', 'How to start with ₹500?', 'Student budget template', 'Set up my first goal'],
      };

    case 'investment':
      return {
        response: `**Investment Basics** 📈\n\n⚠️ *Note: I'm a savings advisor, not a certified investment advisor. Always do your own research!*\n\n**Start Here (After Emergency Fund):**\n\n1. **SIP in Mutual Funds** 🏦\n   • Start with ₹500-1,000/month\n   • Index funds (Nifty 50, Sensex) for beginners\n   • Average 12-15% annual returns historically\n\n2. **PPF (Public Provident Fund)** 🔒\n   • Government-backed, safe\n   • 7-7.5% interest, tax-free returns\n   • 15-year lock-in (similar to our Smart Contract concept!)\n\n3. **Fixed Deposits** 🏛️\n   • 6-7% guaranteed returns\n   • Good for short-term parking of money\n\n4. **Algorand (ALGO)** ⛓️\n   • Our Smart Contract goals use ALGO\n   • Blockchain-based, transparent\n   • Higher risk but interesting technology\n\n**Golden Rule**: Build your savings goals in DhanSathi FIRST, then explore investments. You need a solid savings habit before investing.\n\n**Order of Priority:**\n1. Emergency Fund (3 months expenses)\n2. Essential savings goals\n3. Long-term investments (SIP)\n4. Experimental (crypto, stocks)`,
        suggestions: ['What is SIP?', 'Tell me about ALGO', 'Emergency fund first?', 'How much to invest?'],
      };

    case 'emergency_fund':
      return {
        response: `**Emergency Fund Guide** 🚨\n\nThis should be your **#1 financial priority** before any other goal!\n\n**What is it?**\nMoney set aside for unexpected expenses — job loss, medical bills, urgent repairs, or any "oh no" moment.\n\n**How much do you need?**\n• **Minimum**: 1 month of expenses\n• **Ideal**: 3-6 months of expenses\n• **Example**: If you spend ₹20,000/month → save ₹60,000-₹1,20,000\n\n**Where to keep it?**\n• In a **Savings Goal** on DhanSathi (flexible withdrawal!) — NOT a Smart Contract (you need instant access)\n• Or a separate savings bank account\n\n**How to build it fast:**\n1. Calculate 1 month of expenses\n2. Set it as a Savings Goal in DhanSathi\n3. Save aggressively until you hit it\n4. Then build up to 3 months gradually\n\n**Why it matters:**\n• 70% of Indians don't have an emergency fund\n• Without one, emergencies become debt (credit cards, loans)\n• It gives you peace of mind and financial confidence\n\nStart today — even ₹1,000 is a beginning! 💪`,
        suggestions: ['Create emergency fund goal', 'How much per month?', 'What counts as emergency?', 'I already have one, what next?'],
      };

    case 'debt':
      return {
        response: `**Debt Management Guide** 💳\n\n**Step 1: List ALL Debts**\nWrite down every debt: amount, interest rate, and minimum payment.\n\n**Step 2: Choose Your Strategy**\n\n🔥 **Avalanche Method** (Save most money):\n→ Pay minimums on all debts\n→ Put extra money toward highest interest rate first\n→ Best mathematically\n\n☃️ **Snowball Method** (Most motivating):\n→ Pay minimums on all debts\n→ Put extra money toward smallest balance first\n→ Quick wins keep you motivated\n\n**Step 3: Stop Accumulating**\n• Freeze credit cards (literally put in freezer!)\n• Delete saved card details from shopping apps\n• Use cash/debit only\n\n**Key Rules:**\n• Never pay only minimums on credit cards — interest eats you alive (36-42% per year!)\n• Don't take new loans to pay old ones\n• Build a small emergency fund (₹10,000) alongside debt repayment\n\n**After debt is clear**: Create a Savings Goal and redirect your EMI amount into savings. You won't even notice the difference! 🎉`,
        suggestions: ['Which method is better?', 'How to avoid more debt?', 'Save while paying debt?', 'Credit card tips'],
      };

    case 'expense_tracking':
      return {
        response: `**Track Your Expenses in DhanSathi** 📱\n\nHere's exactly how to track spending:\n\n**1. For Bank Transactions:**\n• Go to **Dashboard** → **Connect Bank**\n• Link your bank account\n• All bank transactions auto-track in **Analytics** page\n• See spending by category with pie charts\n\n**2. For SMS Bank Alerts:**\n• Go to **SMS Parser**\n• Paste your bank SMS messages\n• DhanSathi automatically extracts: amount, merchant, date\n• Auto-categorizes each transaction\n• See all parsed expenses in **Analytics**\n\n**3. For Cash Spending:**\n• Go to **SMS Parser** → scroll to **Cash Spender**\n• Manually log: amount, date, merchant, category\n• Same as SMS tracking but for cash\n• Deduct from goal later if needed\n\n**4. View All Spending:**\n• Go to **Analytics** page\n• See pie chart: Food, Shopping, Travel, Bills, etc.\n• View recent transactions list\n• Check your spending by category\n\n**5. Spending Insights:**\n• Go to **Spending Insights** page\n• See trends over time\n• Identify categories where you overspend\n\nStart with SMS Parser today — takes 2 minutes to paste your bank alerts!`,
        suggestions: ['Send me bank SMS', 'View Analytics', 'Check Spending Insights', 'Budget tips'],
      };

    case 'income_boost':
      return {
        response: `**Ways to Earn Extra Income** 💼\n\n**Skill-Based (₹10,000-50,000+/month):**\n• 💻 Web/App Development — freelance on Upwork\n• ✍️ Content Writing — blogs, social media\n• 🎨 Graphic Design — logos, social posts\n• 📹 Video Editing — YouTube, Instagram reels\n• 🗣️ Online Tutoring — teach what you know\n\n**Quick Start (₹3,000-15,000/month):**\n• 📦 Reselling on Meesho/Amazon\n• 📸 Sell photos on stock photo sites\n• 🎤 Voiceover work on Fiverr\n• 📊 Data entry / virtual assistance\n• 🚗 Weekend delivery (Swiggy, Zomato)\n\n**Passive Income Ideas:**\n• 📚 Create a course on Udemy\n• 📖 Write an eBook\n• 🏠 Rent out spare space\n• 💰 Refer friends to apps (many pay ₹100-500 per referral)\n\n**The "Side Hustle Savings" Strategy:**\nKeep your main income for expenses. Put 100% of side income into DhanSathi goals. This way you accelerate savings without changing your lifestyle!\n\nEven ₹5,000 extra/month = ₹60,000/year in extra savings! 🚀`,
        suggestions: ['Best for beginners?', 'How to start freelancing?', 'I have no skills, what now?', 'Save my extra income'],
      };

    case 'habit_building':
      return {
        response: `**Build an Unbreakable Saving Habit** 🔄\n\n**The 21/90 Rule:**\n• It takes 21 days to form a habit\n• It takes 90 days to make it permanent\n• Challenge: Save something EVERY DAY for 21 days straight!\n\n**Habit Stacking:**\nAttach saving to something you already do:\n• "After morning coffee → deposit ₹50 in DhanSathi"\n• "After dinner → check my goal progress"\n• "On payday → transfer 20% to savings"\n\n**The Pocket Change Method:**\nEnd of every day, whatever loose change you have → deposit it. ₹10, ₹50, ₹100 — doesn't matter. The act of saving is more important than the amount!\n\n**Gamify It:**\n• 🎯 Try the 52-week challenge: ₹100 in week 1, ₹200 in week 2... ₹5,200 in week 52 = ₹1,37,800/year!\n• 🔒 Use Smart Contract goals to make it impossible to break the habit\n• 📈 Check your DhanSathi progress daily — watching the number grow is addictive!\n\n**When You Slip:**\nMissed a day? That's fine! Don't quit — just deposit double tomorrow. Progress > perfection! 💪`,
        suggestions: ['52-week challenge details', 'Set up auto-savings', 'Smart Contract for discipline', 'Daily saving challenge'],
      };

    case 'app_help':
      return {
        response: `**DhanSathi App Guide** 📱\n\n**💰 Dashboard**\n• Overview of all your goals & total saved\n• **Connect Bank** to auto-import transactions\n• Quick action buttons\n\n**🎯 Savings Goals** (Flexible INR)\n• Create goals with target amount\n• Deposit & withdraw anytime\n• Track progress in real-time\n• AI advice on each goal\n\n🔒 **Smart Contract Goals** (Locked ALGO)\n• Funds locked on Algorand blockchain\n• Cannot withdraw until goal complete\n• Maximum discipline!\n\n**📊 Analytics**\n• See ALL your spending\n• Pie chart breakdown by category\n• Recent transactions list\n• Bank + SMS + Cash spending combined\n\n**📱 SMS Parser**\n• Paste bank SMS messages\n• Auto-extracts: amount, merchant, date\n• **Cash Spender** tool for manual cash logging\n• All tracked in Analytics\n\n💡 **Spending Insights**\n• See spending trends over time\n• Identify highest spending categories\n• Weekly/monthly summaries\n\n**📌 To Track Expenses:**\n1. Go **SMS Parser** → paste bank SMS\n2. Or use **Cash Spender** for manual logging\n3. View everything in **Analytics**\n\n**Ready to start?** Go to SMS Parser right now!`,
        suggestions: ['Track expenses', 'View Analytics', 'Create a goal', 'Connect bank'],
      };

    case 'multiple_goals':
      return {
        response: `**Managing Multiple Goals** 🎯🎯🎯\n\n**Priority Order:**\n1. 🚨 **Emergency Fund** — Always first! (1-3 months expenses)\n2. 💳 **High-Interest Debt** — Credit cards, personal loans\n3. 🎯 **Important Goals** — Education, career, essentials\n4. 🌟 **Lifestyle Goals** — Travel, gadgets, fun stuff\n\n**The Bucket Strategy:**\nSplit your savings across goals based on priority:\n• Emergency Fund: 40% of savings\n• Primary Goal: 35%\n• Secondary Goal: 25%\n\nOnce emergency fund is complete, redistribute to other goals!\n\n**In DhanSathi:**\n• Create separate goals for each target\n• Use **Smart Contract** for your most important goal (prevents temptation)\n• Use **Savings Goals** for flexible/short-term goals\n• Check your Dashboard to see combined progress\n\n**Common Mistake:**\n❌ Spreading ₹50 across 10 goals → No progress anywhere\n✅ Focus on 2-3 goals max → Real progress, real motivation\n\nFocus creates momentum! 🚀`,
        suggestions: ['How to prioritize goals?', 'Emergency fund tips', 'Which goal type for each?', 'Create my first goal'],
      };

    case 'progress_check':
      if (hasContext) {
        const progressNum = parseFloat(progress);
        let assessment = '';
        if (progressNum >= 75) assessment = "🎉 **Amazing progress!** You're in the home stretch! Keep this momentum and you'll reach your goal soon. Consider increasing deposits to finish even faster.";
        else if (progressNum >= 50) assessment = "🌟 **Great job — you're past halfway!** The hardest part is behind you. Stay consistent and you'll get there. Can you increase weekly deposits by even 10%?";
        else if (progressNum >= 25) assessment = "💪 **Good start!** You've built momentum. Now focus on consistency — try to deposit at least something every week. The habit is forming!";
        else if (progressNum > 0) assessment = "🌱 **You've started — that's what matters!** Most people never begin. Now aim for small, regular deposits. Even ₹100/day adds up significantly over months.";
        else assessment = "🎯 **Ready to begin!** Create your first goal and make that first deposit. The hardest step is always the first one — everything gets easier after that.";

        return {
          response: `**Your Progress Report** 📊\n\n**Smart Contract Goals (ALGO):**\n• 💰 Saved: ${saved.toFixed(2)} ALGO\n• 🎯 Target: ${target.toFixed(2)} ALGO\n• 📈 Progress: ${progress}%\n\n**Savings Goals (INR):**\n• 💰 Saved: ₹${savedInr.toLocaleString('en-IN')}\n• 🎯 Target: ₹${targetInr.toLocaleString('en-IN')}\n\n**Overall:**\n• 🟢 Active Goals: ${active}\n• ✅ Completed Goals: ${completed}\n\n${assessment}${contextLine.slice(0, -5)}`,
          suggestions: ['How to save faster?', 'Create a new goal', 'Motivation tips', 'Budgeting help'],
        };
      }
      return {
        response: `I'd love to check your progress! To see your stats, make sure you have some active goals with deposits.\n\n**To get started:**\n1. Go to **Savings** or **Smart Contract** in the navigation\n2. Create your first goal\n3. Make a deposit\n4. Come back and ask me about your progress!\n\nI'll be able to give you personalized insights once you have some data. 📊`,
        suggestions: ['Create a Savings goal', 'Create a Smart Contract goal', 'How to set a good goal?', 'Tips for first goal'],
      };

    default:
      return {
        response: `Great question! Here's what I can help you with 🤝\n\n**Popular Topics:**\n• 💰 **"How can I save more?"** — Practical saving strategies\n• 📊 **"Budgeting tips"** — Manage your money better\n• 🎯 **"Help me set a goal"** — Create your first savings goal\n• 🔒 **"Smart Contract vs Savings?"** — Which goal type to pick\n• 💪 **"How to stay motivated?"** — Keep going when it's hard\n• 🎓 **"Student saving tips"** — On a tight budget\n• 📈 **"Investment basics"** — Grow your money\n• 🚨 **"Emergency fund"** — Build your safety net\n\nJust type your question and I'll give you detailed, actionable advice! You can also ask me about your progress, budgeting strategies, or anything related to personal finance. 😊`,
        suggestions: ['How can I save more?', 'Budgeting tips', 'Help me set a goal', 'Smart Contract vs Savings?'],
      };
  }
}

// ─── Main Export ───
export async function getFinancialAdvice(input: FinancialAdviceInput) {
  // Detect intent for suggestion generation and fallback categorization
  const intent = detectIntent(input.userMessage, input.context);

  // Build goals context string
  const goalsContext = input.context?.goals?.length
    ? input.context.goals.map(g => {
        const currency = g.currency === 'INR' ? '₹' : '';
        const savedStr = currency 
          ? `₹${Math.round(g.currentSaved).toLocaleString('en-IN')}` 
          : `${g.currentSaved.toFixed(2)} ALGO`;
        const targetStr = currency 
          ? `₹${g.targetAmount.toLocaleString('en-IN')}` 
          : `${g.targetAmount.toFixed(2)} ALGO`;
        const pct = ((g.currentSaved / g.targetAmount) * 100).toFixed(0);
        const latestDeposit = (g.transactions || [])
          .filter((tx) => tx.type === 'deposit')
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        const latestDepositText = latestDeposit
          ? ` | Latest deposit: ${currency ? `₹${Math.round(latestDeposit.amount).toLocaleString('en-IN')}` : `${latestDeposit.amount.toFixed(2)} ALGO`} on ${new Date(latestDeposit.timestamp).toLocaleDateString('en-IN')}`
          : ' | Latest deposit: none';
        return `- ${g.name}: ${savedStr} of ${targetStr} (${pct}%) — ${g.type === 'on-chain' ? 'Smart Contract (locked)' : 'Savings Goal (flexible)'}${latestDepositText}`;
      }).join('\n')
    : '- No goals yet';

  const systemPrompt = `You are DhanSathi AI, an expert financial advisor chatbot built into DhanSathi — a savings app that offers both flexible Savings Goals (INR, withdraw anytime) and Smart Contract Goals (ALGO, locked on Algorand blockchain until goal is met).

Your personality: Friendly, knowledgeable, encouraging, practical. You use examples with ₹ (Indian Rupees) and ALGO.

Capabilities you help with:
1. Savings strategies (50/30/20 rule, pay yourself first, micro-saving)
2. Goal planning (SMART goals, weekly breakdowns, milestones)
3. Budgeting (expense tracking, cutting costs, automation)
4. Smart Contract vs Savings comparison
5. Student finance, side hustles, income boosting
6. Investment basics (SIP, mutual funds, FD, PPF)
7. Debt management (avalanche/snowball methods)
8. Motivation and habit-building
9. Emergency fund planning
10. DhanSathi app features and how to use them

Response rules:
- Keep answers concise: 80-140 words unless user asks for deep detail
- Use at most 4 bullet points
- Include practical ₹ amounts (₹50/day, ₹500/week examples)
- Reference the user's actual data if available
- Be culturally relevant for Indian users
- End with one clear next step
- Avoid long essays and avoid repeating points
- Use emojis sparingly for visual hierarchy
- Never fabricate data, transactions, deposits, goals, or app features
- If user asks whether they deposited for a specific goal, answer YES/NO in the first line
- For goal deposit questions, use goal.currentSaved > 0 as deposited signal and include saved/target/progress

${input.context ? `
User's Financial Data:
- Total Saved (ALGO): ${input.context.totalSaved?.toFixed(2) || 0} ALGO
- Total Target (ALGO): ${input.context.totalTarget?.toFixed(2) || 0} ALGO
- Total Saved (INR): ₹${(input.context.totalSavedInr || 0).toLocaleString('en-IN')}
- Total Target (INR): ₹${(input.context.totalTargetInr || 0).toLocaleString('en-IN')}
- ALGO Progress: ${input.context.totalTarget ? ((input.context.totalSaved || 0) / input.context.totalTarget * 100).toFixed(1) : 0}%
- Active Goals: ${input.context.activeGoals || 0}
- Completed Goals: ${input.context.completedGoals || 0}
${input.context.recentDeposits?.length ? `- Recent Deposits: ${input.context.recentDeposits.map(d => `${d.amount} ALGO on ${d.date}`).join(', ')}` : '- No recent deposits'}
${input.context.todaySpending?.length ? `- Today's Spending: ₹${(input.context.todayTotal || 0).toLocaleString('en-IN')} across ${input.context.todaySpending.length} transaction(s)` : '- Today\'s Spending: ₹0 (nothing tracked yet)'}

User's Goals:
${goalsContext}

Use this data to personalize your response.` : ''}`;

  const conversationHistory = input.conversationHistory?.map(msg => ({
    role: (msg.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
    content: [{ text: msg.content }],
  })) || [];

  // Try AI first (unless we are in temporary cooldown due to rate limiting)
  if (isAIConfigured && Date.now() >= aiCooldownUntil) {
    try {
      const { text } = await ai.generate({
        system: systemPrompt,
        messages: [
          ...conversationHistory,
          { role: 'user', content: [{ text: input.userMessage }] },
        ],
      });

      if (text && text.length > 30) {
        // Generate contextual follow-up suggestions
        const suggestions = getSuggestionsForIntent(intent);

        return {
          success: true,
          data: {
            response: compactResponse(text),
            suggestions,
            category: intent as string,
          },
        };
      }
    } catch (error) {
      if (isQuotaOrRateLimitError(error)) {
        const retryMs = extractRetryMsFromError(error);
        aiCooldownUntil = Date.now() + retryMs;
        console.warn(`Gemini quota/rate-limit reached. Using fallback for ${Math.ceil(retryMs / 1000)}s.`);
      } else {
        console.error('AI generation failed, using smart fallback:', error);
      }
    }
  }

  // Smart fallback — still provides excellent responses
  const smartResponse = generateSmartResponse(input.userMessage, input.context);
  return {
    success: true,
    data: {
      response: compactResponse(smartResponse.response),
      suggestions: smartResponse.suggestions,
      category: intent as string,
    },
  };
}

function getSuggestionsForIntent(intent: Intent): string[] {
  const map: Record<Intent, string[]> = {
    greeting: ['How can I save more?', 'Help me set a goal', 'Budgeting tips'],
    save_more: ['50/30/20 rule details', 'Track my expenses', 'Set a goal'],
    budgeting: ['Send my bank SMS', 'View my analytics', 'Track cash spending'],
    smart_contract_vs_savings: ['Create a goal', 'Tell me about ALGO', 'Which is safer?'],
    set_goal: ['Smart Contract vs Savings?', 'Calculate weekly savings', 'Goal ideas'],
    motivation: ['Show my progress', 'Daily challenge', 'Smart Contract lock'],
    student_finance: ['Freelancing tips', 'Start with ₹500', 'Student budget'],
    investment: ['What is SIP?', 'Emergency fund first?', 'ALGO explained'],
    emergency_fund: ['How much to save?', 'Create emergency goal', 'Then what?'],
    debt: ['Which method?', 'Save while in debt?', 'Credit card tips'],
    expense_tracking: ['Today\'s spending', 'Weekly summary', 'Save more tips'],
    income_boost: ['Freelancing tips', 'Passive income', 'Side hustles'],
    habit_building: ['52-week challenge', 'Smart Contract discipline', 'Daily tips'],
    app_help: ['Track expenses', 'View Analytics', 'Create a goal'],
    multiple_goals: ['Priority order', 'Which goal type?', 'Emergency fund'],
    progress_check: ['Save faster', 'New goal', 'Motivation'],
    goal_specific: ['How to save more?', 'Withdraw from goal?', 'Motivate me'],
    daily_spending_check: ['Weekly spending', 'Reduce spending', 'View Analytics'],
    general: ['Save more', 'Budget tips', 'Set a goal', 'Smart Contract?'],
  };
  return map[intent] || map.general;
}

// Quick tips generator for dashboard  
export async function getQuickSavingsTip(context?: {
  totalSaved?: number;
  progressPercent?: number;
}) {
  const prompt = `Generate a short, motivating savings tip (1-2 sentences) for a user who has saved ${context?.totalSaved?.toFixed(2) || 0} ALGO and is ${context?.progressPercent || 0}% towards their goal. Be encouraging and specific. Use ₹ examples.`;

  try {
    const { text } = await ai.generate({ prompt });
    return { success: true, tip: text };
  } catch {
    const tips = [
      "The 24-hour rule: Wait a day before any purchase over ₹500. You'll skip most impulse buys! 🧠",
      "₹100/day = ₹36,500/year. Small amounts create big results! 💰",
      "Pay yourself first — save before you spend, not the other way around! 🎯",
      "Track every rupee for a week. You'll find ₹2,000+ in hidden savings! 📊",
      "Try a no-spend day today. Deposit the saved amount into your goal! 🚀",
    ];
    return {
      success: true,
      tip: tips[Math.floor(Math.random() * tips.length)],
    };
  }
}
