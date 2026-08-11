import { toBase } from "@/lib/currency";
import type { Account } from "@/lib/data-service";

// A "credit" account is a liability: its balance reduces a combined total
// (net-worth semantics). All other types contribute positively.
// Native to the account's own currency.
export function signedBalance(account: Account): number {
  return account.accountType === "credit"
    ? -account.currentBalance
    : account.currentBalance;
}

// signedBalance converted into the user's base currency.
export function signedBalanceBase(account: Account): number {
  return toBase(signedBalance(account), account.currency);
}

// Combined total for a set of accounts, treating credit as a liability.
// Accounts may be denominated differently, so the total is in base currency.
export function groupTotal(members: Account[]): number {
  return members.reduce((sum, a) => sum + signedBalanceBase(a), 0);
}

// True when every member shares one currency (display can then stay native
// and skip the ≈ conversion marker).
export function singleCurrency(
  members: Account[],
): Account["currency"] | null {
  if (members.length === 0) return null;
  const first = members[0].currency;
  return members.every((m) => m.currency === first) ? first : null;
}
