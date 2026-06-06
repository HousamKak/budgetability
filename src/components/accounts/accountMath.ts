import type { Account } from "@/lib/data-service";

// A "credit" account is a liability: its balance reduces a combined total
// (net-worth semantics). All other types contribute positively.
export function signedBalance(account: Account): number {
  return account.accountType === "credit"
    ? -account.currentBalance
    : account.currentBalance;
}

// Combined total for a set of accounts, treating credit as a liability.
export function groupTotal(members: Account[]): number {
  return members.reduce((sum, a) => sum + signedBalance(a), 0);
}
