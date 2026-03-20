/**
 * ALGO → INR conversion utilities.
 *
 * The exchange rate is fetched once from CoinGecko's free API and cached for
 * 5 minutes. If the fetch fails, a sensible fallback (₹150) is used so the
 * UI never shows "$0".
 */

const FALLBACK_RATE = 150; // 1 ALGO ≈ ₹150 (fallback)
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

let cachedRate: number | null = null;
let lastFetchTime = 0;

/**
 * Fetch the current 1 ALGO → INR rate.
 * Uses CoinGecko (free, no key required).
 */
export async function fetchAlgoInrRate(): Promise<number> {
  const now = Date.now();
  if (cachedRate !== null && now - lastFetchTime < CACHE_DURATION_MS) {
    return cachedRate;
  }

  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=algorand&vs_currencies=inr",
      { next: { revalidate: 300 } } // ISR-style caching in Next.js
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rate = data?.algorand?.inr;
    if (typeof rate === "number" && rate > 0) {
      cachedRate = rate;
      lastFetchTime = now;
      return rate;
    }
  } catch (err) {
    console.warn("Failed to fetch ALGO/INR rate, using fallback:", err);
  }

  return cachedRate ?? FALLBACK_RATE;
}

/**
 * Returns the cached rate synchronously (for renders).
 * Falls back to FALLBACK_RATE if no fetch has happened yet.
 */
export function getAlgoInrRate(): number {
  return cachedRate ?? FALLBACK_RATE;
}

/** Convert ALGO amount to INR using the cached rate. */
export function algoToInr(algo: number): number {
  return algo * getAlgoInrRate();
}

/** Format an INR amount with the ₹ symbol. */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Format ALGO amount with its INR equivalent: "2.5 ALGO (≈ ₹375)" */
export function formatAlgoWithInr(algo: number): string {
  const inr = algoToInr(algo);
  return `${algo.toFixed(2)} ALGO (≈ ${formatINR(inr)})`;
}
