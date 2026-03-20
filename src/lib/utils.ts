import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format as formatFns } from "date-fns"
import { algoToInr, formatINR, formatAlgoWithInr } from "./algo-inr"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function microAlgosToAlgos(microAlgos: number) {
  if (typeof microAlgos !== 'number') return 0;
  return microAlgos / 1_000_000;
}

/** Format an ALGO amount showing ₹ INR equivalent: "2.50 ALGO (≈ ₹375)" */
export function formatCurrency(amount: number) {
  return formatAlgoWithInr(amount);
}

/** Format as plain ₹ INR */
export function formatAsINR(algoAmount: number) {
  return formatINR(algoToInr(algoAmount));
}

export { algoToInr, formatINR, formatAlgoWithInr };

/**
 * Converts any Firebase Timestamp | Date | string | number to a plain JS Date.
 * Firebase Timestamps expose a `.toDate()` method; all other types are handled
 * by the standard Date constructor.
 */
export function toDate(val: { toDate(): Date } | Date | string | number | null | undefined): Date {
  if (!val) return new Date(0);
  if (val instanceof Date) return val;
  if (typeof val === 'number') return new Date(val);
  if (typeof val === 'string') return new Date(val);
  if (typeof (val as any).toDate === 'function') return (val as any).toDate();
  return new Date(val as any);
}

export function formatDate(date: any) {
  if (!date) return "";
  const dateObj = toDate(date);
  return formatFns(dateObj, "MMM d, yyyy");
}

export function formatDateFromTimestamp(timestamp: { toDate(): Date } | number | Date | string | null | undefined) {
    if (!timestamp) return "";
    const date = toDate(timestamp);
    if (isNaN(date.getTime())) return "Invalid Date";
    return formatFns(date, "MMM d, yyyy");
}
