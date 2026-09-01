import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CURRENCIES,
  type CurrencyCode,
  type MoneyByCurrency,
  displayRate,
  formatRate,
  getBaseCurrency,
  rateBetween,
  sumToBase,
  toBase,
} from "@/lib/currency";
import type { Account } from "@/lib/data-service";
import { cn, formatCurrency } from "@/lib/utils";
import { paperTheme } from "@/styles";
import { CategoryIcon } from "@/components/budget/CategoryIcon";
import { balanceEntries, signedBaseBalance } from "./accountMath";

interface TotalsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The accounts as displayed (live, or rewound to a past month). */
  accounts: Account[];
  /** "Total Balance" or "Total · end of August 2026". */
  title: string;
}

/**
 * The full story behind the one-line "≈ $X" total: how much of each currency
 * is held across every wallet, what each is worth in base at today's
 * Settings rates, and the per-wallet breakdown.
 */
export function TotalsDialog({
  open,
  onOpenChange,
  accounts,
  title,
}: TotalsDialogProps) {
  const base = getBaseCurrency();

  // Native totals per currency across all wallets (credit = liability).
  const byCurrency: MoneyByCurrency = {};
  for (const a of accounts) {
    const sign = a.accountType === "credit" ? -1 : 1;
    for (const e of balanceEntries(a)) {
      byCurrency[e.currency] =
        Math.round(((byCurrency[e.currency] ?? 0) + sign * e.amount) * 100) /
        100;
    }
  }
  const currencies = (Object.keys(byCurrency) as CurrencyCode[]).sort(
    (x, y) => Math.abs(toBase(byCurrency[y] ?? 0, y)) - Math.abs(toBase(byCurrency[x] ?? 0, x)),
  );
  const total = sumToBase(byCurrency);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-lg",
          paperTheme.colors.background.cardGradient,
          paperTheme.colors.borders.paper,
        )}
      >
        <div
          className={cn(
            "absolute inset-0 opacity-15 pointer-events-none rounded-2xl",
            paperTheme.effects.paperTexture,
          )}
        />

        <DialogHeader className="relative">
          <DialogTitle
            className={cn(
              "text-xl",
              paperTheme.colors.text.accent,
              paperTheme.fonts.handwriting,
            )}
          >
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-stone-500">
            Everything you hold, by currency and by wallet.
          </DialogDescription>
        </DialogHeader>

        <div className="relative space-y-5 pt-1">
          {/* Grand total */}
          <div
            className={cn(
              "p-4 rounded-xl border text-center",
              paperTheme.colors.borders.amber,
              "bg-white/60",
            )}
          >
            <p className="text-xs text-stone-500">All wallets, in {base}</p>
            <p
              className={cn(
                "text-3xl font-bold",
                paperTheme.fonts.handwriting,
                total >= 0 ? "text-green-700" : "text-red-600",
              )}
            >
              ≈ {formatCurrency(total)}
            </p>
          </div>

          {/* By currency */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
              By currency
            </p>
            <div className="space-y-1.5">
              {currencies.map((code) => {
                const native = byCurrency[code] ?? 0;
                const inBase = toBase(native, code);
                const share =
                  total !== 0 ? Math.round((inBase / total) * 100) : 0;
                const rate = displayRate(code, base, rateBetween(code, base));
                return (
                  <div
                    key={code}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white/70 border border-stone-200"
                  >
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "font-bold tabular-nums",
                          native >= 0 ? "text-green-700" : "text-red-600",
                        )}
                      >
                        {formatCurrency(native, code)}
                      </p>
                      <p className="text-[11px] text-stone-400">
                        {CURRENCIES[code].name}
                        {code !== base &&
                          ` · 1 ${rate.anchor} = ${formatRate(rate.perAnchor)} ${rate.other}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-stone-700 tabular-nums">
                        {code === base ? "" : "≈ "}
                        {formatCurrency(inBase)}
                      </p>
                      <p className="text-[11px] text-stone-400">{share}% of total</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By wallet */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
              By wallet
            </p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {accounts.map((a) => {
                const entries = balanceEntries(a);
                const inBase = signedBaseBalance(a);
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white/70 border border-stone-200"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CategoryIcon
                        name={a.icon || "wallet"}
                        className="w-4 h-4 text-stone-500 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-800 truncate">
                          {a.name}
                          {a.accountType === "credit" && (
                            <span className="ml-1.5 text-[10px] text-red-500 px-1 py-0.5 rounded bg-red-50">
                              liability
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-stone-500 tabular-nums">
                          {entries
                            .map((e) => formatCurrency(e.amount, e.currency))
                            .join(" · ")}
                        </p>
                      </div>
                    </div>
                    <p
                      className={cn(
                        "text-sm font-semibold tabular-nums shrink-0",
                        inBase >= 0 ? "text-stone-700" : "text-red-600",
                      )}
                    >
                      ≈ {formatCurrency(inBase)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-[11px] text-stone-400">
            Conversions use today's Settings rates; credit accounts count as
            liabilities.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TotalsDialog;
