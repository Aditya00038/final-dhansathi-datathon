'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/ai-goal-planning-flow.ts';
import '@/ai/flows/ai-achievement-coach-flow.ts';
import '@/ai/flows/ai-receipt-analysis-flow.ts';
