import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIParsedTransaction } from './types'; // Switched to the correct type

const API_KEY = process.env.GOOGLE_GENAI_API_KEY as string;

if (!API_KEY) {
  throw new Error("The GOOGLE_GENAI_API_KEY environment variable is not set. The AI Parser cannot function.");
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// Updated prompt with clearer instructions for ambiguous cases
const promptTemplate = `
You are an expert at parsing bank transaction SMS messages from the user's perspective.
Your ONLY task is to extract transaction details and return them as a valid JSON array.

**Instructions:**
1.  Find all individual transactions in the **Input Text**.
2.  For each transaction, extract: \`amount\` (number), \`date\` (YYYY-MM-DD), \`merchant\` (string), and \`type\`.
3.  **Crucially, if the text contains both 'debited' and 'credited', you MUST interpret it as a 'debit' transaction from the user's account.**
4.  Handle dates like '03Jul25' by converting them to '2025-07-03'.
5.  Your entire response MUST be only the JSON array. Do not include any other text, explanation, or markdown formatting.

**Input Text:**
{SMS_TEXT}

If no transactions are found, you MUST return an empty array: [].
`;

export async function extractTransactionsFromSms(sms: string): Promise<AIParsedTransaction[]> {
  if (!API_KEY) {
    return [];
  }

  try {
    const prompt = promptTemplate.replace("{SMS_TEXT}", sms);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("Raw AI Response:", text);

    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```|(\[[\s\S]*\])/);

    if (jsonMatch) {
      const jsonString = (jsonMatch[1] || jsonMatch[2] || "").trim();
      if (jsonString) {
        try {
          return JSON.parse(jsonString);
        } catch (e) {
          console.error("Failed to parse extracted JSON:", e, "\nJSON String that failed:", jsonString);
          return [];
        }
      }
    }
    
    console.warn("No valid JSON array found in AI response. Returning empty array.");
    return [];

  } catch (error) {
    console.error(
      "Fatal Error during AI content generation. This is likely an issue with the API key or service availability.",
      error
    );
    return [];
  }
}
