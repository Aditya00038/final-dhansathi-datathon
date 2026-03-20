import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIParsedTransaction } from './types'; // Switched to the correct type

const MODEL_NAME = "gemini-1.5-flash";
const TRANSACTION_KEYWORDS_REGEX = /(debited|credited|spent|received|withdrawn|deposited|sent|paid|transferred|transfer)/i;

const BRAND_CATEGORY_RULES: Array<{ pattern: RegExp; brand: string; category: string }> = [
  { pattern: /kfc|kfcsapphire/i, brand: "KFC", category: "Food" },
  { pattern: /swiggy/i, brand: "Swiggy", category: "Food" },
  { pattern: /zomato/i, brand: "Zomato", category: "Food" },
  { pattern: /myntra/i, brand: "Myntra", category: "Groceries" },
  { pattern: /meesho/i, brand: "Meesho", category: "Groceries" },
  { pattern: /blinkit/i, brand: "Blinkit", category: "Groceries" },
  { pattern: /zepto/i, brand: "Zepto", category: "Groceries" },
  { pattern: /bigbasket/i, brand: "BigBasket", category: "Groceries" },
  { pattern: /amazon|flipkart|ajio/i, brand: "Shopping", category: "Shopping" },
  { pattern: /uber|ola/i, brand: "Transport", category: "Transport" },
];

function resolveGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ""
  );
}

// Updated prompt with clearer instructions for ambiguous cases
const promptTemplate = `
You are an expert at parsing bank transaction SMS messages from the user's perspective.
Your ONLY task is to extract transaction details and return them as a valid JSON array.

**Instructions:**
1.  Find all individual transactions in the **Input Text**.
2.  For each transaction, extract: \`amount\` (number), \`date\` (YYYY-MM-DD), \`merchant\` (string), and \`type\`.
3.  **Crucially, if the text contains both 'debited' and 'credited', you MUST interpret it as a 'debit' transaction from the user's account.**
4.  Handle dates like '03Jul25' by converting them to '2025-07-03'.
5.  Output must be a JSON array only. Do not include markdown, explanation, or extra text.

**Input Text:**
{SMS_TEXT}

If no transactions are found, you MUST return an empty array: [].
`;

function parseFlexibleDate(input: string): string | undefined {
  const raw = input.trim();
  const compact = raw.replace(/\s+/g, "");

  const ddMonYear = compact.match(/^(\d{1,2})([A-Za-z]{3})(\d{2}|\d{4})$/);
  if (ddMonYear) {
    const day = ddMonYear[1].padStart(2, "0");
    const mon = ddMonYear[2].toLowerCase();
    const yy = ddMonYear[3];
    const months: Record<string, string> = {
      jan: "01",
      feb: "02",
      mar: "03",
      apr: "04",
      may: "05",
      jun: "06",
      jul: "07",
      aug: "08",
      sep: "09",
      oct: "10",
      nov: "11",
      dec: "12",
    };
    const month = months[mon];
    if (!month) return undefined;
    const year = yy.length === 2 ? `20${yy}` : yy;
    return `${year}-${month}-${day}`;
  }

  const slashOrDash = compact.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
  if (slashOrDash) {
    const day = slashOrDash[1].padStart(2, "0");
    const month = slashOrDash[2].padStart(2, "0");
    const yy = slashOrDash[3];
    const year = yy.length === 2 ? `20${yy}` : yy;
    return `${year}-${month}-${day}`;
  }

  const dt = new Date(raw);
  if (!Number.isNaN(dt.getTime())) {
    return dt.toISOString().slice(0, 10);
  }

  return undefined;
}

function normalizeType(value: unknown): "debit" | "credit" | undefined {
  if (typeof value !== "string") return undefined;
  const lowered = value.toLowerCase();
  if (lowered.includes("debit")) return "debit";
  if (lowered.includes("credit")) return "credit";
  return undefined;
}

function titleCase(input: string): string {
  return input
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function cleanMerchantToken(raw: string): string {
  return raw
    .replace(/[@._-]?\d{2,}$/g, "")
    .replace(/\b(?:via|upi|ref|no|txn|txnid|call|if|not|you|on|from|ac|a\/c)\b.*$/i, "")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toMerchantLabel(rawMerchant: string | undefined): string | undefined {
  if (!rawMerchant) return undefined;
  const cleaned = cleanMerchantToken(rawMerchant);
  if (!cleaned) return undefined;

  for (const rule of BRAND_CATEGORY_RULES) {
    if (rule.pattern.test(cleaned)) {
      return `${rule.brand} (${rule.category})`;
    }
  }

  const generic = titleCase(cleaned.split(" ").slice(0, 2).join(" "));
  return `${generic} (Others)`;
}

function normalizeTransactions(payload: unknown): AIParsedTransaction[] {
  if (!Array.isArray(payload)) return [];

  return payload
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Record<string, unknown>;

      const amountRaw = candidate.amount;
      const amount =
        typeof amountRaw === "number"
          ? amountRaw
          : typeof amountRaw === "string"
            ? Number(amountRaw.replace(/,/g, ""))
            : undefined;

      const merchant = typeof candidate.merchant === "string" ? toMerchantLabel(candidate.merchant.trim()) : undefined;
      const parsedDate =
        typeof candidate.date === "string" ? parseFlexibleDate(candidate.date) : undefined;

      const type = normalizeType(candidate.type);

      const normalized: AIParsedTransaction = {
        amount: Number.isFinite(amount as number) ? (amount as number) : undefined,
        merchant: merchant || undefined,
        date: parsedDate,
        type,
      };

      if (!normalized.amount && !normalized.merchant && !normalized.date && !normalized.type) {
        return null;
      }

      return normalized;
    })
    .filter((t): t is AIParsedTransaction => t !== null);
}

function dedupeTransactions(items: AIParsedTransaction[]): AIParsedTransaction[] {
  const seen = new Set<string>();
  const output: AIParsedTransaction[] = [];

  for (const tx of items) {
    const key = `${tx.amount ?? ""}|${tx.date ?? ""}|${(tx.merchant ?? "").toLowerCase()}|${tx.type ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(tx);
  }

  return output;
}

function splitIntoTransactionChunks(sms: string): string[] {
  const text = sms.replace(/\s+/g, " ").trim();
  if (!text) return [];

  const startPattern = /(?:INR|Rs\.?|₹)\s*[0-9,]+(?:\.\d{1,2})?\s*(?:debited|credited|spent|received|withdrawn|deposited|sent|paid|transferred|transfer)\b|(?:sent|paid|transferred|transfer)\s+(?:INR|Rs\.?|₹)\s*[0-9,]+(?:\.\d{1,2})?/gi;
  const starts: number[] = [];

  let match: RegExpExecArray | null;
  while ((match = startPattern.exec(text)) !== null) {
    starts.push(match.index);
  }

  if (starts.length === 0) {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  const chunks: string[] = [];
  for (let i = 0; i < starts.length; i += 1) {
    const begin = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : text.length;
    const part = text.slice(begin, end).trim();
    if (part) chunks.push(part);
  }

  return chunks;
}

function extractTransactionFromChunk(chunk: string): AIParsedTransaction | null {
  const lowered = chunk.toLowerCase();
  if (!TRANSACTION_KEYWORDS_REGEX.test(lowered)) {
    return null;
  }

  const amountMatch = chunk.match(/(?:INR|Rs\.?|₹)\s*([0-9,]+(?:\.\d{1,2})?)/i);
  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : undefined;

  const dateMatch = chunk.match(/\b(\d{1,2}[A-Za-z]{3}\d{2,4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\b/);
  const date = dateMatch ? parseFlexibleDate(dateMatch[1]) : undefined;

  // Keep user's perspective: debited + credited in same line is still debit.
  const type: "debit" | "credit" | undefined =
    /(debited|spent|withdrawn|sent|paid|transferred|transfer)/.test(lowered) ? "debit" :
    /(credited|received|deposited)/.test(lowered) ? "credit" :
    undefined;

  const toMerchant = chunk.match(/\bto\s+([^\s]+(?:\s+[^\s]+){0,3}?)(?=\s+(?:via|on|ref|call|if|not)\b|$)/i)?.[1];
  const atMerchant = chunk.match(/\bat\s+([^\s]+(?:\s+[^\s]+){0,3}?)(?=\s+(?:via|on|ref|call|if|not)\b|$)/i)?.[1];
  const fromMerchant = chunk.match(/\bfrom\s+([^\s]+(?:\s+[^\s]+){0,3}?)(?=\s+(?:via|on|ref|call|if|not|to)\b|$)/i)?.[1];

  let merchantRaw: string | undefined;
  if (type === "debit") {
    merchantRaw = toMerchant || atMerchant || fromMerchant;
  } else {
    merchantRaw = fromMerchant || toMerchant || atMerchant;
  }
  const merchant = toMerchantLabel(merchantRaw);

  if (!amount && !merchant && !date && !type) {
    return null;
  }

  return { amount, merchant, date, type };
}

function extractWithRegexFallback(sms: string): AIParsedTransaction[] {
  const results: AIParsedTransaction[] = [];

  const chunks = splitIntoTransactionChunks(sms);
  for (const chunk of chunks) {
    const tx = extractTransactionFromChunk(chunk);
    if (tx) results.push(tx);
  }

  return dedupeTransactions(results);
}

export async function extractTransactionsFromSms(sms: string): Promise<AIParsedTransaction[]> {
  const apiKey = resolveGeminiApiKey();

  if (!apiKey) {
    console.warn("No Gemini API key found (checked GEMINI_API_KEY, GOOGLE_GENAI_API_KEY, GOOGLE_API_KEY). Falling back to regex parser.");
    return extractWithRegexFallback(sms);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const prompt = promptTemplate.replace("{SMS_TEXT}", sms);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("Raw AI Response:", text);

    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```|(\[[\s\S]*\])/i);

    if (jsonMatch) {
      const jsonString = (jsonMatch[1] || jsonMatch[2] || "").trim();
      if (jsonString) {
        try {
          const parsed = JSON.parse(jsonString);
          const normalized = normalizeTransactions(parsed);
          const fallback = extractWithRegexFallback(sms);
          return dedupeTransactions([...normalized, ...fallback]);
        } catch (e) {
          console.error("Failed to parse extracted JSON:", e, "\nJSON String that failed:", jsonString);
          return extractWithRegexFallback(sms);
        }
      }
    }
    
    console.warn("No valid JSON array found in AI response. Falling back to regex parser.");
    return extractWithRegexFallback(sms);

  } catch (error) {
    console.error(
      "Error during Gemini content generation. Falling back to regex parser.",
      error
    );
    return extractWithRegexFallback(sms);
  }
}
