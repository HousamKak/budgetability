import {
  type CurrencyCode,
  type MoneyByCurrency,
  sumToBase,
  toBase,
} from "@/lib/currency";
import type { Account } from "@/lib/data-service";

// One display line of a wallet: a currency it holds and that balance.
export type BalanceEntry = { currency: CurrencyCode; amount: number };

// Every currency the wallet holds (primary first, zeros included — the
// wallet's shape stays visible), plus any stray balance outside the declared
// set (e.g. after the set was edited).
export function balanceEntries(
  account: Account,
  balances?: MoneyByCurrency,
): BalanceEntry[] {
  const source = balances ?? account.balances;
  const codes = [
    account.currency,
    ...account.currencies.filter((c) => c !== account.currency),
    ...(Object.keys(source) as CurrencyCode[]).filter(
      (c) => !account.currencies.includes(c),
    ),
  ];
  return codes.map((currency) => ({
    currency,
    amount: source[currency] ?? 0,
  }));
}

// True when the wallet holds more than one currency (or has stray balances).
export function isMultiCurrency(account: Account): boolean {
  return balanceEntries(account).length > 1;
}

// Total value of the wallet in the base currency.
export function accountBaseTotal(
  account: Account,
  balances?: MoneyByCurrency,
): number {
  return sumToBase(balances ?? account.balances);
}

// A "credit" account is a liability: its value reduces a combined total
// (net-worth semantics). All other types contribute positively. Base currency.
export function signedBaseBalance(account: Account): number {
  const total = accountBaseTotal(account);
  return account.accountType === "credit" ? -total : total;
}

// Combined base-currency total for a set of wallets, credit as liability.
export function groupTotal(members: Account[]): number {
  return members.reduce((sum, a) => sum + signedBaseBalance(a), 0);
}

// Convert a per-currency map to base (helper re-export for components).
export function moneyToBase(amounts: MoneyByCurrency): number {
  return sumToBase(amounts);
}

// Base value of one entry (for magnitude bars and comparisons).
export function entryBaseValue(entry: BalanceEntry): number {
  return toBase(entry.amount, entry.currency);
}
