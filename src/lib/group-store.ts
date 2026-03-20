/**
 * Group Goals & Leaderboard — local-storage-based store.
 * 
 * Group goals allow friends to pool savings towards a shared target.
 * The leaderboard tracks total savings by wallet address.
 */

export interface GroupGoal {
  id: string;
  name: string;
  targetAmount: number; // in ALGO
  createdBy: string; // wallet address
  createdAt: string;
  members: GroupMember[];
}

export interface GroupMember {
  walletAddress: string;
  nickname: string;
  totalDeposited: number; // in ALGO
  joinedAt: string;
}

export interface LeaderboardEntry {
  walletAddress: string;
  nickname: string;
  totalSaved: number; // in ALGO
  goalsCompleted: number;
  rank?: number;
}

const GROUP_GOALS_KEY = "dhansathi_group_goals";
const LEADERBOARD_KEY = "dhansathi_leaderboard";

// ── Group Goals ──────────────────────────────────────────────────────────────

function readGroupGoals(): GroupGoal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GROUP_GOALS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeGroupGoals(goals: GroupGoal[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(GROUP_GOALS_KEY, JSON.stringify(goals));
}

export function getAllGroupGoals(): GroupGoal[] {
  return readGroupGoals();
}

export function getGroupGoalById(id: string): GroupGoal | null {
  return readGroupGoals().find((g) => g.id === id) ?? null;
}

export function createGroupGoal(data: {
  name: string;
  targetAmount: number;
  creatorAddress: string;
  creatorNickname: string;
}): GroupGoal {
  const goals = readGroupGoals();
  const newGoal: GroupGoal = {
    id: `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: data.name,
    targetAmount: data.targetAmount,
    createdBy: data.creatorAddress,
    createdAt: new Date().toISOString(),
    members: [
      {
        walletAddress: data.creatorAddress,
        nickname: data.creatorNickname,
        totalDeposited: 0,
        joinedAt: new Date().toISOString(),
      },
    ],
  };
  goals.push(newGoal);
  writeGroupGoals(goals);
  return newGoal;
}

export function joinGroupGoal(
  goalId: string,
  walletAddress: string,
  nickname: string
): GroupGoal | null {
  const goals = readGroupGoals();
  const idx = goals.findIndex((g) => g.id === goalId);
  if (idx === -1) return null;

  // Check if already a member
  const exists = goals[idx].members.some(
    (m) => m.walletAddress === walletAddress
  );
  if (exists) return goals[idx];

  goals[idx].members.push({
    walletAddress,
    nickname,
    totalDeposited: 0,
    joinedAt: new Date().toISOString(),
  });
  writeGroupGoals(goals);
  return goals[idx];
}

export function addGroupDeposit(
  goalId: string,
  walletAddress: string,
  amount: number
): GroupGoal | null {
  const goals = readGroupGoals();
  const idx = goals.findIndex((g) => g.id === goalId);
  if (idx === -1) return null;

  const memberIdx = goals[idx].members.findIndex(
    (m) => m.walletAddress === walletAddress
  );
  if (memberIdx === -1) return null;

  goals[idx].members[memberIdx].totalDeposited += amount;
  writeGroupGoals(goals);

  // Also update leaderboard
  updateLeaderboardEntry(walletAddress, goals[idx].members[memberIdx].nickname, amount);

  return goals[idx];
}

export function deleteGroupGoal(goalId: string) {
  const goals = readGroupGoals().filter((g) => g.id !== goalId);
  writeGroupGoals(goals);
}

// ── Leaderboard ──────────────────────────────────────────────────────────────

function readLeaderboard(): LeaderboardEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLeaderboard(entries: LeaderboardEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
}

export function getLeaderboard(): LeaderboardEntry[] {
  const entries = readLeaderboard();
  // Sort by totalSaved descending and assign ranks
  entries.sort((a, b) => b.totalSaved - a.totalSaved);
  return entries.map((e, i) => ({ ...e, rank: i + 1 }));
}

export function updateLeaderboardEntry(
  walletAddress: string,
  nickname: string,
  additionalSaved: number,
  goalCompleted?: boolean
) {
  const entries = readLeaderboard();
  const idx = entries.findIndex((e) => e.walletAddress === walletAddress);

  if (idx >= 0) {
    entries[idx].totalSaved += additionalSaved;
    entries[idx].nickname = nickname || entries[idx].nickname;
    if (goalCompleted) entries[idx].goalsCompleted += 1;
  } else {
    entries.push({
      walletAddress,
      nickname: nickname || `${walletAddress.substring(0, 6)}...${walletAddress.slice(-4)}`,
      totalSaved: additionalSaved,
      goalsCompleted: goalCompleted ? 1 : 0,
    });
  }

  writeLeaderboard(entries);
}

export function registerOnLeaderboard(walletAddress: string, nickname: string) {
  const entries = readLeaderboard();
  const exists = entries.some((e) => e.walletAddress === walletAddress);
  if (!exists) {
    entries.push({
      walletAddress,
      nickname: nickname || `${walletAddress.substring(0, 6)}...${walletAddress.slice(-4)}`,
      totalSaved: 0,
      goalsCompleted: 0,
    });
    writeLeaderboard(entries);
  }
}
