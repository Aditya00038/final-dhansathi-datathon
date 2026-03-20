'use client';

import { z } from "zod";
import { Algodv2, makeApplicationNoOpTxn, waitForConfirmation } from "algosdk";
import { ALGOD_CLIENT, getSuggestedParams } from "./algokit-config";
import type { Goal, Deposit, NormalGoal } from "./types";

const GoalSchema = z.object({
    id: z.string(),
    name: z.string(),
    targetAmount: z.number(),
    currentAmount: z.number(),
    createdAt: z.date(),
});

const GroupGoalSchema = GoalSchema.extend({
    groupMembers: z.array(z.string()),
});

export function getGoals(): Goal[] {
    const goals = localStorage.getItem("goals");
    return goals ? JSON.parse(goals) : [];
}

export function saveGoal(goal: Goal): void {
    const goals = getGoals();
    goals.push(goal);
    localStorage.setItem("goals", JSON.stringify(goals));
}

export function getNormalGoals(): NormalGoal[] {
    const goals = localStorage.getItem("normal_goals");
    return goals ? JSON.parse(goals) : [];
}

export function saveNormalGoal(goal: NormalGoal): void {
    const goals = getNormalGoals();
    goals.push(goal);
    localStorage.setItem("normal_goals", JSON.stringify(goals));
}
