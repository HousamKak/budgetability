import { cn, formatCurrency } from "@/lib/utils";
import type { MoneyByCurrency } from "@/lib/currency";
import type { Account } from "@/lib/data-service";
import {
  accountBaseTotal,
  balanceEntries,
} from "./accountMath";

interface WalletBalancesProps {
  account: Account;
  /** Override balances (e.g. a rewound month snapshot); defaults to live. */
  balances?: MoneyByCurrency;
  /** Compact single-line rendering for dense rows. */
  inline?: boolean;
  className?: string;
  amountClassName?: string;
}

/**
 * A wallet's balances, one native amount per held currency, with an ≈ base
 * total when it holds more than one. Colors follow sign per line.
 */
export function WalletBalances({
  account,
  balances,
  inline = false,
  className,
  amountClassName,
}: WalletBalancesProps) {
  const entries = balanceEntries(account, balances);
  const multi = entries.length > 1;
  const total = accountBaseTotal(account, balances);

  if (inline) {
    return (
      <span className={cn("inline-flex flex-wrap items-baseline gap-x-2", className)}>
        {entries.map((e) => (
          <span
            key={e.currency}
            className={cn(
              "font-bold tabular-nums",
              e.amount >= 0 ? "text-green-700" : "text-red-600",
              amountClassName,
            )}
          >
            {formatCurrency(e.amount, e.currency)}
          </span>
        ))}
        {multi && (
          <span className="text-[11px] text-stone-400 tabular-nums">
            ≈ {formatCurrency(total)}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className={className}>
      {entries.map((e) => (
        <p
          key={e.currency}
          className={cn(
            "font-bold leading-tight",
            e.amount >= 0 ? "text-green-700" : "text-red-600",
            amountClassName,
          )}
        >
          {formatCurrency(e.amount, e.currency)}
        </p>
      ))}
      {multi && (
        <p className="text-xs text-stone-400 mt-0.5">
          ≈ {formatCurrency(total)}
        </p>
      )}
    </div>
  );
}
