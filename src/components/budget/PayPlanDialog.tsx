import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  CURRENCIES,
  type CurrencyCode,
  convertAt,
  getBaseCurrency,
  rateBetween,
} from "@/lib/currency";
import type { Account, PlanItem } from "@/lib/data-service";
import { cn, formatCurrency } from "@/lib/utils";
import { paperTheme } from "@/styles";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { CurrencyChips } from "@/components/accounts/CurrencyChips";
import { RateOverride } from "@/components/accounts/RateOverride";

interface PayPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PlanItem | null;
  account: Account | null;
  /**
   * Confirm payment: what actually left the wallet (native amount in
   * `currency`) and the rate used to value it in base.
   */
  onConfirm: (
    plan: PlanItem,
    currency: CurrencyCode,
    nativeAmount: number,
    exchangeRate: number | null,
  ) => void;
}

/**
 * "Mark as paid" for a wallet that holds several currencies: which balance
 * did the money leave, and how much? The plan's base amount is only a
 * prefill — the expense records what was really paid.
 */
export function PayPlanDialog({
  open,
  onOpenChange,
  plan,
  account,
  onConfirm,
}: PayPlanDialogProps) {
  const base = getBaseCurrency();
  const [currency, setCurrency] = useState<CurrencyCode>(base);
  const [amount, setAmount] = useState("");
  const [rateOverride, setRateOverride] = useState<number | null>(null);

  // Default to the base currency when the wallet holds it, else primary.
  useEffect(() => {
    if (!open || !plan || !account) return;
    const initial = account.currencies.includes(base) ? base : account.currency;
    setCurrency(initial);
    setRateOverride(null);
  }, [open, plan, account, base]);

  const effectiveRate = rateOverride ?? rateBetween(currency, base);

  // Prefill the native amount from the plan whenever currency/rate changes.
  useEffect(() => {
    if (!open || !plan) return;
    const native =
      currency === base
        ? plan.amount
        : effectiveRate > 0
          ? Math.round((plan.amount / effectiveRate) * 100) / 100
          : plan.amount;
    setAmount(String(native));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plan, currency, effectiveRate]);

  useEffect(() => {
    setRateOverride(null);
  }, [currency]);

  if (!plan || !account) return null;

  const native = parseFloat(amount) || 0;
  const available = account.balances[currency] ?? 0;
  const baseValue = currency === base ? native : convertAt(native, effectiveRate);
  const canPay = native > 0 && native <= available;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-md",
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
              "text-xl flex items-center gap-2",
              paperTheme.colors.text.accent,
              paperTheme.fonts.handwriting,
            )}
          >
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Pay {plan.note || plan.category || "plan"}
          </DialogTitle>
          <DialogDescription className="text-sm text-stone-500">
            Planned at {formatCurrency(plan.amount)} from {account.name}. Which
            balance did you actually pay with?
          </DialogDescription>
        </DialogHeader>

        <form
          className="relative space-y-4 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canPay) return;
            onConfirm(plan, currency, native, currency === base ? null : rateOverride);
            onOpenChange(false);
          }}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="pay-amount" className={paperTheme.fonts.handwriting}>
                Paid with
              </Label>
              <CurrencyChips
                currencies={account.currencies}
                value={currency}
                onChange={setCurrency}
              />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-sm">
                {CURRENCIES[currency].symbol}
              </span>
              <input
                id="pay-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
                className={cn(
                  "w-full py-2 pr-3 rounded-lg border text-sm",
                  currency === "USD" ? "pl-7" : "pl-12",
                  paperTheme.colors.borders.amber,
                  paperTheme.colors.background.white,
                  "focus:outline-none focus:ring-2 focus:ring-amber-400/50",
                )}
              />
            </div>
            <p className="text-xs text-stone-400">
              Available: {formatCurrency(available, currency)}
            </p>
            {native > available && (
              <p className="text-xs text-red-500">Exceeds available balance</p>
            )}
            {currency !== base && (
              <div className="space-y-1 pt-1">
                <RateOverride
                  from={currency}
                  to={base}
                  rate={rateOverride}
                  onChange={setRateOverride}
                />
                <p className="text-xs text-stone-500">
                  ≈ {formatCurrency(baseValue)} on the budget
                  {Math.abs(baseValue - plan.amount) >= 0.01 &&
                    ` (planned ${formatCurrency(plan.amount)})`}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className={cn("flex-1", "bg-green-500 hover:bg-green-600 text-white")}
              disabled={!canPay}
            >
              Mark as paid
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default PayPlanDialog;
