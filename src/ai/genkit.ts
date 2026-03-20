import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

const hasApiKey = !!(process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash',
});

export const isAIConfigured = hasApiKey;
