import type { OnChainGoal } from './types';
import type { Deposit } from './types';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  unlocked: boolean;
  unlockedAt?: Date;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
}

export interface AchievementProgress {
  achievements: Achievement[];
  totalUnlocked: number;
  totalPossible: number;
  nextMilestone: string | null;
}

// Achievement definitions with tiers
const ACHIEVEMENT_DEFINITIONS = [
  // Deposit-based achievements
  {
    id: 'first_deposit',
    name: 'First Step',
    description: 'Make your first deposit',
    icon: '🚀',
    tier: 'bronze' as const,
    color: 'text-amber-700',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    check: (deposits: Deposit[], _onChain: OnChainGoal) => deposits.length >= 1,
  },
  {
    id: 'five_deposits',
    name: 'Consistent Saver',
    description: 'Make 5 deposits',
    icon: '📈',
    tier: 'silver' as const,
    color: 'text-slate-700 dark:text-slate-300',
    bgColor: 'bg-slate-100 dark:bg-slate-800/50',
    check: (deposits: Deposit[], _onChain: OnChainGoal) => deposits.length >= 5,
  },
  {
    id: 'ten_deposits',
    name: 'Dedicated Depositor',
    description: 'Make 10 deposits',
    icon: '💪',
    tier: 'gold' as const,
    color: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    check: (deposits: Deposit[], _onChain: OnChainGoal) => deposits.length >= 10,
  },
  {
    id: 'twenty_deposits',
    name: 'Savings Master',
    description: 'Make 20 deposits',
    icon: '👑',
    tier: 'platinum' as const,
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    check: (deposits: Deposit[], _onChain: OnChainGoal) => deposits.length >= 20,
  },

  // Progress-based achievements
  {
    id: 'ten_percent',
    name: '10% There',
    description: 'Reach 10% of your goal',
    icon: '🌱',
    tier: 'bronze' as const,
    color: 'text-green-700',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    check: (_deposits: Deposit[], onChain: OnChainGoal) => 
      onChain.targetAmount > 0 && (onChain.totalSaved / onChain.targetAmount) >= 0.1,
  },
  {
    id: 'quarter_way',
    name: 'Quarter Way',
    description: 'Reach 25% of your goal',
    icon: '🌿',
    tier: 'silver' as const,
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    check: (_deposits: Deposit[], onChain: OnChainGoal) => 
      onChain.targetAmount > 0 && (onChain.totalSaved / onChain.targetAmount) >= 0.25,
  },
  {
    id: 'halfway',
    name: 'Halfway Hero',
    description: 'Reach 50% of your goal',
    icon: '⭐',
    tier: 'gold' as const,
    color: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    check: (_deposits: Deposit[], onChain: OnChainGoal) => 
      onChain.targetAmount > 0 && (onChain.totalSaved / onChain.targetAmount) >= 0.5,
  },
  {
    id: 'three_quarters',
    name: 'Almost There',
    description: 'Reach 75% of your goal',
    icon: '🔥',
    tier: 'platinum' as const,
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    check: (_deposits: Deposit[], onChain: OnChainGoal) => 
      onChain.targetAmount > 0 && (onChain.totalSaved / onChain.targetAmount) >= 0.75,
  },
  {
    id: 'goal_completed',
    name: 'Goal Crusher',
    description: 'Complete your savings goal',
    icon: '🏆',
    tier: 'diamond' as const,
    color: 'text-cyan-700 dark:text-cyan-300',
    bgColor: 'bg-gradient-to-r from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30',
    check: (_deposits: Deposit[], onChain: OnChainGoal) => onChain.goalCompleted,
  },

  // Amount-based achievements (in microAlgos - ALGO has 6 decimals)
  {
    id: 'save_1_algo',
    name: 'First ALGO',
    description: 'Save at least 1 ALGO',
    icon: '💎',
    tier: 'bronze' as const,
    color: 'text-blue-700',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    check: (_deposits: Deposit[], onChain: OnChainGoal) => onChain.totalSaved >= 1_000_000,
  },
  {
    id: 'save_10_algo',
    name: 'Double Digits',
    description: 'Save at least 10 ALGO',
    icon: '💰',
    tier: 'silver' as const,
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    check: (_deposits: Deposit[], onChain: OnChainGoal) => onChain.totalSaved >= 10_000_000,
  },
  {
    id: 'save_50_algo',
    name: 'Serious Saver',
    description: 'Save at least 50 ALGO',
    icon: '🎯',
    tier: 'gold' as const,
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    check: (_deposits: Deposit[], onChain: OnChainGoal) => onChain.totalSaved >= 50_000_000,
  },
  {
    id: 'save_100_algo',
    name: 'Century Saver',
    description: 'Save at least 100 ALGO',
    icon: '🌟',
    tier: 'platinum' as const,
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    check: (_deposits: Deposit[], onChain: OnChainGoal) => onChain.totalSaved >= 100_000_000,
  },

  // Special achievements
  {
    id: 'overachiever',
    name: 'Overachiever',
    description: 'Save more than your target amount',
    icon: '🚀',
    tier: 'diamond' as const,
    color: 'text-pink-700 dark:text-pink-400',
    bgColor: 'bg-gradient-to-r from-pink-100 to-rose-100 dark:from-pink-900/30 dark:to-rose-900/30',
    check: (_deposits: Deposit[], onChain: OnChainGoal) => 
      onChain.targetAmount > 0 && onChain.totalSaved > onChain.targetAmount,
  },
];

export function calculateAchievements(
  deposits: Deposit[],
  onChainGoal: OnChainGoal
): AchievementProgress {
  const achievements: Achievement[] = ACHIEVEMENT_DEFINITIONS.map((def) => ({
    id: def.id,
    name: def.name,
    description: def.description,
    icon: def.icon,
    color: def.color,
    bgColor: def.bgColor,
    tier: def.tier,
    unlocked: def.check(deposits, onChainGoal),
  }));

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  
  // Find next milestone
  let nextMilestone: string | null = null;
  const progressPercent = onChainGoal.targetAmount > 0 
    ? (onChainGoal.totalSaved / onChainGoal.targetAmount) * 100 
    : 0;
  
  if (progressPercent < 10) nextMilestone = "Reach 10% to unlock '10% There'";
  else if (progressPercent < 25) nextMilestone = "Reach 25% to unlock 'Quarter Way'";
  else if (progressPercent < 50) nextMilestone = "Reach 50% to unlock 'Halfway Hero'";
  else if (progressPercent < 75) nextMilestone = "Reach 75% to unlock 'Almost There'";
  else if (!onChainGoal.goalCompleted) nextMilestone = "Complete your goal to unlock 'Goal Crusher'";

  return {
    achievements,
    totalUnlocked: unlockedCount,
    totalPossible: achievements.length,
    nextMilestone,
  };
}

// Get tier styling
export function getTierBadgeStyle(tier: Achievement['tier']): string {
  switch (tier) {
    case 'bronze':
      return 'border-amber-300 dark:border-amber-700';
    case 'silver':
      return 'border-slate-400 dark:border-slate-500';
    case 'gold':
      return 'border-yellow-400 dark:border-yellow-600';
    case 'platinum':
      return 'border-purple-400 dark:border-purple-600';
    case 'diamond':
      return 'border-cyan-400 dark:border-cyan-500 shadow-lg shadow-cyan-200/50 dark:shadow-cyan-800/30';
    default:
      return 'border-border';
  }
}

// Get tier label
export function getTierLabel(tier: Achievement['tier']): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

// Calculate achievements for normal goals (INR-based)
export interface NormalGoalAchievementData {
  currentBalance: number;
  targetAmount: number;
  deposits: { amount: number; timestamp: string | Date }[];
  goalCompleted: boolean;
}

export function calculateNormalGoalAchievements(
  goal: NormalGoalAchievementData
): AchievementProgress {
  const progress = goal.targetAmount > 0 ? (goal.currentBalance / goal.targetAmount) * 100 : 0;
  
  const achievements: Achievement[] = [
    {
      id: 'first_step',
      name: 'First Step',
      description: 'Make your first deposit',
      icon: '🚀',
      tier: 'bronze',
      color: 'text-amber-700',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
      unlocked: goal.deposits.length >= 1,
    },
    {
      id: 'consistent',
      name: 'Consistent Saver',
      description: 'Make 5 deposits',
      icon: '📈',
      tier: 'silver',
      color: 'text-slate-700 dark:text-slate-300',
      bgColor: 'bg-slate-100 dark:bg-slate-800/50',
      unlocked: goal.deposits.length >= 5,
    },
    {
      id: 'ten_percent',
      name: '10% There',
      description: 'Reach 10% of your goal',
      icon: '🌱',
      tier: 'bronze',
      color: 'text-green-700',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      unlocked: progress >= 10,
    },
    {
      id: 'quarter',
      name: 'Quarter Way',
      description: 'Reach 25% of your goal',
      icon: '🌿',
      tier: 'silver',
      color: 'text-green-700 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      unlocked: progress >= 25,
    },
    {
      id: 'halfway',
      name: 'Halfway Hero',
      description: 'Reach 50% of your goal',
      icon: '⭐',
      tier: 'gold',
      color: 'text-yellow-700 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
      unlocked: progress >= 50,
    },
    {
      id: 'three_quarter',
      name: 'Almost There',
      description: 'Reach 75% of your goal',
      icon: '🔥',
      tier: 'platinum',
      color: 'text-orange-700 dark:text-orange-400',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
      unlocked: progress >= 75,
    },
    {
      id: 'completed',
      name: 'Goal Crusher',
      description: 'Complete your savings goal',
      icon: '🏆',
      tier: 'diamond',
      color: 'text-cyan-700 dark:text-cyan-300',
      bgColor: 'bg-gradient-to-r from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30',
      unlocked: goal.goalCompleted,
    },
    {
      id: 'save_1000',
      name: 'First Thousand',
      description: 'Save at least ₹1,000',
      icon: '💎',
      tier: 'bronze',
      color: 'text-blue-700',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      unlocked: goal.currentBalance >= 1000,
    },
    {
      id: 'save_10000',
      name: 'Five Figures',
      description: 'Save at least ₹10,000',
      icon: '💰',
      tier: 'silver',
      color: 'text-blue-700 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      unlocked: goal.currentBalance >= 10000,
    },
    {
      id: 'save_50000',
      name: 'Serious Saver',
      description: 'Save at least ₹50,000',
      icon: '🎯',
      tier: 'gold',
      color: 'text-emerald-700 dark:text-emerald-400',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      unlocked: goal.currentBalance >= 50000,
    },
    {
      id: 'overachiever',
      name: 'Overachiever',
      description: 'Save more than your target',
      icon: '🚀',
      tier: 'diamond',
      color: 'text-pink-700 dark:text-pink-400',
      bgColor: 'bg-gradient-to-r from-pink-100 to-rose-100 dark:from-pink-900/30 dark:to-rose-900/30',
      unlocked: goal.currentBalance > goal.targetAmount && goal.targetAmount > 0,
    },
  ];

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  
  let nextMilestone: string | null = null;
  if (progress < 10) nextMilestone = "Reach 10% to unlock '10% There'";
  else if (progress < 25) nextMilestone = "Reach 25% to unlock 'Quarter Way'";
  else if (progress < 50) nextMilestone = "Reach 50% to unlock 'Halfway Hero'";
  else if (progress < 75) nextMilestone = "Reach 75% to unlock 'Almost There'";
  else if (!goal.goalCompleted) nextMilestone = "Complete your goal to unlock 'Goal Crusher'";

  return {
    achievements,
    totalUnlocked: unlockedCount,
    totalPossible: achievements.length,
    nextMilestone,
  };
}
