import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Currency-aware formatting lives in currency.ts; re-exported here because
// most of the app already imports formatCurrency from "@/lib/utils".
export {
  formatCurrency,
  formatCurrencyCompact,
  currencySymbol,
  currencyInputProps,
} from "./currency";

/**
 * Format a number for display (without currency symbol), showing only significant decimals.
 * Use this when the symbol is already in the template string.
 * Examples:
 *   100 -> "100"
 *   100.5 -> "100.5"
 *   100.55 -> "100.55"
 *   100.00 -> "100"
 */
export function formatNumber(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}