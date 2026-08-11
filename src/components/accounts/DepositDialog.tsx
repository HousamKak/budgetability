import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CURRENCIES, type CurrencyCode } from "@/lib/currency";
import type { Account } from "@/lib/data-service";
import { cn, formatCurrency } from "@/lib/utils";
import { CurrencyChips } from "./CurrencyChips";
import { WalletBalances } from "./WalletBalances";
import { paperTheme } from "@/styles";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { AccountTypeBadge } from "./AccountTypeBadge";

interface DepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
  onDeposit: (
    accountId: string,
    amount: number,
    note?: string,
    inForecast?: boolean,
    currency?: CurrencyCode,
  ) => void;
}

/**
 * Dialog for depositing money to an account
 */
export function DepositDialog({
  open,
  onOpenChange,
  account,
  onDeposit,
}: DepositDialogProps) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [inForecast, setInForecast] = useState(false);
  const [currency, setCurrency] = useState<CurrencyCode>("USD");

  useEffect(() => {
    if (open) {
      setAmount("");
      setNote("");
      // Opt-in every time: nothing reaches the forecast unless marked here.
      setInForecast(false);
      setCurrency(account?.currency ?? "USD");
    }
  }, [open, account]);

  const depositAmount = parseFloat(amount) || 0;
  const canDeposit = account && depositAmount > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canDeposit && account) {
      onDeposit(
        account.id,
        depositAmount,
        note || undefined,
        inForecast,
        currency,
      );
      onOpenChange(false);
    }
  };

  if (!account) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-md",
          paperTheme.colors.background.cardGradient,
          paperTheme.colors.borders.paper
        )}
      >
        <div
          className={cn(
            "absolute inset-0 opacity-15 pointer-events-none rounded-2xl",
            paperTheme.effects.paperTexture
          )}
        />

        <DialogHeader className="relative">
          <DialogTitle
            className={cn(
              "text-xl flex items-center gap-2",
              paperTheme.colors.text.accent,
              paperTheme.fonts.handwriting
            )}
          >
            <ArrowUpRight className="w-5 h-5 text-green-600" />
            Deposit to {account.name}
          </DialogTitle>
          <DialogDescription className="text-sm text-stone-500">
            Add money to this account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="relative space-y-4 pt-2">
          {/* Account info */}
          <div
            className={cn(
              "p-3 rounded-lg border flex items-center gap-3",
              paperTheme.colors.borders.amber,
              "bg-white/50"
            )}
          >
            <AccountTypeBadge
              type={account.accountType}
              showLabel={false}
              size="lg"
            />
            <div>
              <p className={cn("font-medium", paperTheme.fonts.handwriting)}>
                {account.name}
              </p>
              <WalletBalances
                account={account}
                inline
                amountClassName="text-sm"
              />
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount" className={paperTheme.fonts.handwriting}>
                Deposit Amount
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
                id="amount"
                type="number"
                step={CURRENCIES[currency].inputStep}
                min={CURRENCIES[currency].inputStep}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={CURRENCIES[currency].inputPlaceholder}
                autoFocus
                className={cn(
                  "w-full py-2 pr-3 rounded-lg border text-sm",
                  currency === "USD" ? "pl-7" : "pl-12",
                  paperTheme.colors.borders.amber,
                  paperTheme.colors.background.white,
                  "focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                )}
              />
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="note" className={paperTheme.fonts.handwriting}>
              Note (optional)
            </Label>
            <input
              id="note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Paycheck, Gift, etc."
              className={cn(
                "w-full px-3 py-2 rounded-lg border text-sm",
                paperTheme.colors.borders.amber,
                paperTheme.colors.background.white,
                "focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              )}
            />
          </div>

          {/* Forecast link */}
          <label
            className={cn(
              "flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors",
              inForecast
                ? "border-sky-400 bg-sky-50/70"
                : "border-stone-200 bg-white/50 hover:border-sky-300",
            )}
          >
            <input
              type="checkbox"
              checked={inForecast}
              onChange={(e) => setInForecast(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-sky-500 cursor-pointer"
            />
            <span className="flex-1">
              <span
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium",
                  inForecast ? "text-sky-800" : "text-stone-600",
                )}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Show in Forecast
              </span>
              <span className="block text-xs text-stone-500 mt-0.5">
                Adds this income to the forecast as an inflow this month.
              </span>
            </span>
          </label>

          {/* Preview */}
          {depositAmount > 0 && (
            <div
              className={cn(
                "p-3 rounded-lg border",
                paperTheme.colors.borders.amber,
                "bg-green-50/50"
              )}
            >
              <p className="text-xs text-stone-500 mb-1">After deposit:</p>
              <p className="text-lg font-bold text-green-600">
                {formatCurrency(
                  (account.balances[currency] ?? 0) + depositAmount,
                  currency,
                )}
              </p>
              <p className="text-xs text-green-600">
                +{formatCurrency(depositAmount, currency)}
              </p>
            </div>
          )}

          {/* Actions */}
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
              className={cn(
                "flex-1",
                "bg-green-500 hover:bg-green-600 text-white"
              )}
              disabled={!canDeposit}
            >
              Deposit
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default DepositDialog;
