import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number as currency, showing only significant decimals.
 * Examples:
 *   100 -> "$100"
 *   100.5 -> "$100.5"
 *   100.55 -> "$100.55"
 *   100.00 -> "$100"
 *   0 -> "$0"
 */
export function formatCurrency(amount: number): string {
  // Format with up to 2 decimal places, then remove trailing zeros
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return formatted;
}

/**
 * Format a number for display (without currency symbol), showing only significant decimals.
 * Use this when the "$" is already in the template string.
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