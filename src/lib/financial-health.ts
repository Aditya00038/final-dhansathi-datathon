import type { GoalWithOnChainData } from './types';

type HealthResult = {
    score: number;
    feedback: string[];
};

export function calculateFinancialHealth(goal: GoalWithOnChainData): HealthResult {
    const { onChain, deposits } = goal;
    let score = 50;
    const feedback: string[] = ["Base score for starting a goal."];

    // Factor 1: Goal Completion
    if (onChain.goalCompleted) {
        score += 25;
        feedback.push("+25: Goal completed! Fantastic discipline.");
    }

    // Factor 2: Deposit Consistency
    if (deposits && deposits.length > 0) {
        score += 10;
        feedback.push("+10: You've started! The first step is the hardest.");
    }
    if (deposits && deposits.length > 2) {
        score += 15;
        feedback.push("+15: Consistent savings are building a strong habit.");
    }

    // Factor 3: Progress towards goal (if not completed)
    if (!onChain.goalCompleted) {
        const progress = onChain.targetAmount > 0 ? (onChain.totalSaved / onChain.targetAmount) * 100 : 0;
        if (progress >= 50) {
            score += 10;
            feedback.push("+10: Over 50% of the way there. Keep it up!");
        }
    }
    
    // Factor 4: Deadline Status
    const deadlinePassed = onChain.deadline > 0 && Date.now() / 1000 > onChain.deadline;
    if (deadlinePassed && !onChain.goalCompleted) {
        score -= 15;
        feedback.push("-15: Deadline passed, but don't give up on your goal!");
    }

    // Normalize score to be between 0 and 100
    score = Math.max(10, Math.min(100, Math.round(score)));

    if (feedback.length === 1) {
        feedback.push("Make a deposit to improve your score.");
    }

    return { score, feedback };
}
