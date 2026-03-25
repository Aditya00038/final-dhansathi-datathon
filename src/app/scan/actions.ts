'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';

export type ParsedReceiptResult = {
  amount: number;
  merchant: string;
  category: 'Food' | 'Shopping' | 'Travel' | 'Bills' | 'Others';
  date: string | null;
};

function resolveGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    ''
  ).trim();
}

function parseJsonFromResponse(text: string): ParsedReceiptResult | null {
  const match = text.match(/```json\s*([\s\S]*?)\s*```|(\{[\s\S]*\})/i);
  if (!match) return null;

  const jsonString = (match[1] || match[2] || '').trim();
  if (!jsonString) return null;

  try {
    const obj = JSON.parse(jsonString) as {
      amount?: unknown;
      merchant?: unknown;
      category?: unknown;
      date?: unknown;
    };

    const amount = typeof obj.amount === 'number'
      ? obj.amount
      : typeof obj.amount === 'string'
        ? normalizeAmountString(obj.amount)
        : NaN;

    const merchant = typeof obj.merchant === 'string' ? obj.merchant.trim() : '';
    const categoryRaw = typeof obj.category === 'string' ? obj.category.trim() : 'Others';
    const category = (['Food', 'Shopping', 'Travel', 'Bills', 'Others'].includes(categoryRaw)
      ? categoryRaw
      : 'Others') as ParsedReceiptResult['category'];

    const dateRaw = typeof obj.date === 'string' ? obj.date.trim() : '';
    const date = dateRaw.length > 0 ? dateRaw : null;

    if (!Number.isFinite(amount) || amount <= 0 || !merchant) return null;

    return {
      amount,
      merchant,
      category,
      date,
    };
  } catch {
    return null;
  }
}

// Simple regex-based receipt parser
function normalizeAmountString(raw: string): number {
  const cleaned = raw.replace(/\s/g, '').replace(/[^\d,.-]/g, '');
  if (!cleaned) return NaN;

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  // If both are present, treat the last occurring symbol as decimal separator.
  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    const decimalSep = lastComma > lastDot ? ',' : '.';
    const thousandsSep = decimalSep === ',' ? '.' : ',';
    const normalized = cleaned.split(thousandsSep).join('').replace(decimalSep, '.');
    return Number(normalized);
  }

  // If only comma exists, treat comma as thousand separator unless it looks like decimal (e.g. 12,50).
  if (hasComma && !hasDot) {
    if (/,-?\d{1,2}$/.test(cleaned) || /,\d{1,2}$/.test(cleaned)) {
      return Number(cleaned.replace(',', '.'));
    }
    return Number(cleaned.replace(/,/g, ''));
  }

  // If only dot exists, treat dot as thousand separator when grouping appears like 1.234 or 12.345.678.
  if (!hasComma && hasDot) {
    if (/^\d{1,3}(?:\.\d{3})+$/.test(cleaned)) {
      return Number(cleaned.replace(/\./g, ''));
    }
    return Number(cleaned);
  }

  return Number(cleaned);
}

function extractAmount(text: string): number {
  const findBestFromMatches = (matches: IterableIterator<RegExpMatchArray>): number => {
    const values: number[] = [];
    for (const m of matches) {
      const raw = (m[1] || '').trim();
      if (!raw) continue;
      const v = normalizeAmountString(raw);
      if (Number.isFinite(v) && v > 0 && v < 1000000) {
        values.push(v);
      }
    }
    return values.length ? Math.max(...values) : 0;
  };

  // First pass: strong payable labels (highest trust for final bill amount).
  const payablePatterns = [
    /(?:cur\.?\s*demand\s*payable|current\s*demand\s*payable|net\s*payable|grand\s*total|total\s*amount|amount\s*payable|bill\s*total)\D{0,35}(?:₹|rs\.?|inr)?\s*([\d][\d,\.\s]{0,20})/gi,
    /(?:payable|total\s*due|amount\s*due)\D{0,25}(?:₹|rs\.?|inr)?\s*([\d][\d,\.\s]{0,20})/gi,
  ];

  for (const pattern of payablePatterns) {
    const best = findBestFromMatches(text.matchAll(pattern));
    if (best > 0) return best;
  }

  const scored: Array<{ value: number; score: number }> = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const maybeFixLikelyOcrPrefixedAmount = (selected: number, allValues: number[]): number => {
    // OCR sometimes prefixes an extra leading digit in totals: 3463 -> 23463.
    if (selected < 10000) return selected;

    const reduced = Number((selected % 10000).toFixed(2));
    const nearby = allValues
      .filter((v) => v > 100 && v < 10000)
      .filter((v) => Math.abs(v - reduced) <= 1.5)
      .sort((a, b) => Math.abs(a - reduced) - Math.abs(b - reduced));

    if (nearby.length > 0) {
      return nearby[0];
    }
    return selected;
  };

  const lineScore = (line: string): number => {
    const lower = line.toLowerCase();
    let score = 0;

    if (/(net\s*payable|current\s*demand\s*payable|grand\s*total|total\s*amount|amount\s*payable|bill\s*total|invoice\s*total)/i.test(lower)) score += 220;
    if (/(\bsum\b|\btotal\b|net\s*amount)/i.test(lower)) score += 140;
    if (/(paid\s*amount|amount\s*paid|payment\s*received|cash\s*received)/i.test(lower)) score += 30;
    if (/(₹|rs\.?|inr|rupees?)/i.test(lower)) score += 30;
    if (/\b(?:\d+)%\b/.test(lower)) score -= 30; // tax rows

    // Strong negative signals for non-final-payable references.
    if (/(asd\s*to\s*be\s*paid|to\s*be\s*paid|ignore\s*if\s*paid|advance|opening\s*balance)/i.test(lower)) score -= 260;
    if (/(bill\s*no|order\s*no|pack\s*no|date|time|qty|unit\s*rate|hsn|gst|tax\s*details|due\s*date)/i.test(lower)) score -= 40;
    if (/(units?|consumption|reading|pres\.?\s*rdg|prev\.?\s*rdg|rate|tax|gst|energy\s*charges|fixed\s*charges|kw|kwh|power\s*factor)/i.test(lower)) score -= 90;

    return score;
  };

  const pushTokensFromLine = (line: string, baseScore: number) => {
    const tokenMatches = line.match(/[\d][\d,\.\s]{0,20}/g) || [];
    for (const rawToken of tokenMatches) {
      const value = normalizeAmountString(rawToken);
      if (!Number.isFinite(value) || value <= 0 || value >= 1000000) continue;
      if (value >= 1900 && value <= 2100) continue; // likely year
      const decimalsBonus = /[.,]\d{2}\b/.test(rawToken) ? 8 : 0;
      const verySmallPenalty = value < 300 ? -20 : 0;
      scored.push({ value, score: baseScore + decimalsBonus + verySmallPenalty });
    }
  };

  for (const line of lines) {
    pushTokensFromLine(line, lineScore(line));
  }

  // Final fallback if OCR collapsed lines.
  if (scored.length === 0) {
    const genericPattern = /\b([\d][\d,\.\s]{1,18})\b/g;
    for (const m of text.matchAll(genericPattern)) {
      const raw = m[1];
      if (!raw) continue;
      const value = normalizeAmountString(raw);
      if (!Number.isFinite(value) || value <= 0 || value >= 1000000) continue;
      if (value >= 1900 && value <= 2100) continue;
      scored.push({ value, score: 0 });
    }
  }

  if (scored.length === 0) return 0;
  scored.sort((a, b) => (b.score - a.score) || (b.value - a.value));
  const best = scored[0].value;
  return maybeFixLikelyOcrPrefixedAmount(best, scored.map((s) => s.value));
}

// Extract merchant name
function extractMerchant(text: string): string {
  const normalizeMerchant = (value: string): string => {
    const cleaned = value.replace(/\s+/g, ' ').replace(/[:|\[\]]/g, ' ').trim();
    if (!cleaned) return '';
    if (cleaned.length < 3 || cleaned.length > 60) return '';
    if (/bill\s*receipt|order\s*no|bill\s*no|pack\s*no|hsn|product|tax\s*details|qty|round\s*off|\bdate\b|\btime\b|due\s*date/i.test(cleaned)) return '';
    if (/^[\d\s\-./]+$/.test(cleaned)) return '';
    if (/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(cleaned)) return '';
    return cleaned;
  };

  // Common merchant indicators
  const merchantPatterns = [
    /([A-Za-z][A-Za-z\s.&-]{2,40})\s+(?:electricity|power|water|gas|telecom|internet)\s*bill/i,
    /(?:consumer\s*name|customer\s*name|merchant|vendor|store|shop|company)\s*[:\-]\s*([A-Za-z\s.&-]{2,50})/i,
    /^(.*?)\b(?:bill\s*receipt|tax\s*invoice|invoice|order\s*no|bill\s*no|date)\b/i,
    /(?:store|shop|restaurant|merchant|vendor|company|at)\s+([A-Za-z\s&-]+?)(?:\n|$|₹|amount)/i,
    /^([A-Za-z\s&-]{3,30})[\s\n]*(?:store|shop|receipt|transaction)/i,
    /(?:paid to|payment to)\s+([A-Za-z\s&-]+?)(?:\n|$|₹)/i,
  ];

  for (const pattern of merchantPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const merchant = normalizeMerchant(match[1]);
      if (merchant) return merchant.substring(0, 50);
    }
  }

  // Fallback: first meaningful line that is not metadata.
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 2);

  for (const line of lines) {
    const merchant = normalizeMerchant(line);
    if (merchant) return merchant.substring(0, 50);
  }

  const lowerText = text.toLowerCase();
  if (/(electricity|power\s*factor|consumed\s*units|tariff|demand\s*payable|due\s*date)/i.test(lowerText)) {
    return 'Electricity Bill';
  }
  if (/(water\s*bill|sewerage)/i.test(lowerText)) {
    return 'Water Bill';
  }
  if (/(gas\s*bill|lpg)/i.test(lowerText)) {
    return 'Gas Bill';
  }

  return 'Utility Bill';
}

// Categorize transaction
function categorizeTransaction(text: string, merchant: string): ParsedReceiptResult['category'] {
  const lowerText = (text + ' ' + merchant).toLowerCase();

  if (/food|restaurant|cafe|pizza|burger|grocery|supermarket|bakery|snack|lunch|dinner|breakfast/i.test(lowerText)) {
    return 'Food';
  }
  if (/shop|store|mall|clothing|apparel|cloth|dress|shoes|amazon|flipkart|myntra|nike|adidas/i.test(lowerText)) {
    return 'Shopping';
  }
  if (/taxi|uber|ola|travel|flight|hotel|train|bus|transport|metro|ride|booking/i.test(lowerText)) {
    return 'Travel';
  }
  if (/bill|pay|utility|electric|water|internet|phone|mobile|subscription|gas|fuel/i.test(lowerText)) {
    return 'Bills';
  }

  return 'Others';
}

// Extract date
function extractDate(text: string): string | null {
  const datePatterns = [
    /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/,
    /(\d{4})[/-](\d{1,2})[/-](\d{1,2})/,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      let day, month, year;
      if (match[3].length === 4) {
        day = match[1];
        month = match[2];
        year = match[3];
      } else {
        year = match[3];
        month = match[2];
        day = match[1];
      }

      const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    }
  }

  return null;
}

export async function parseReceiptTextAction(cleanedText: string): Promise<{ success: boolean; data?: ParsedReceiptResult; error?: string; }> {
  try {
    if (!cleanedText || cleanedText.trim().length < 8) {
      return { success: false, error: 'Receipt text is too short to parse.' };
    }

    const apiKey = resolveGeminiApiKey();
    if (apiKey) {
      try {
        const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `Extract the following fields from this receipt text and return ONLY valid JSON:
{
  "amount": <number>,
  "merchant": "<string>",
  "date": "<YYYY-MM-DD or null>",
  "category": "<Food|Shopping|Travel|Bills|Others>"
}

Rules:
- amount must be numeric and > 0
- prioritize final payable/total amount and avoid item-level rate, unit count, tax rows, and cash received/tendered values
- if OCR appears to add a leading digit (example: 3463 seen as 23463), prefer the context-consistent payable total
- merchant must be concise and cleaned
- if date not found, return null
- category must be one of the allowed values above

Receipt text:
${cleanedText}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const aiParsed = parseJsonFromResponse(text);
        if (aiParsed) {
          return { success: true, data: aiParsed };
        }
      } catch (geminiError) {
        console.warn('Gemini parse failed, falling back to regex parser:', geminiError);
      }
    }

    const amount = extractAmount(cleanedText);
    if (amount <= 0) {
      return {
        success: false,
        error: apiKey
          ? 'Could not parse receipt amount.'
          : 'Gemini API key not found and fallback parser could not detect amount.',
      };
    }

    const merchant = extractMerchant(cleanedText);

    const category = categorizeTransaction(cleanedText, merchant);
    const date = extractDate(cleanedText);

    const parsed: ParsedReceiptResult = {
      amount,
      merchant,
      category,
      date,
    };

    return { success: true, data: parsed };
  } catch (error: any) {
    console.error('parseReceiptTextAction error:', error);
    return { success: false, error: error?.message || 'Unknown server error while parsing receipt text.' };
  }
}
