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
  formatCurrency,
  getBaseCurrency,
  toBase,
} from "@/lib/currency";
import { CurrencyChips } from "./CurrencyChips";
import type { Account } from "@/lib/data-service";
import { cn } from "@/lib/utils";
import { paperTheme } from "@/styles";
import { Calendar, PiggyBank } from "lucide-react";
import { useEffect, useState } from "react";
import { AccountTypeBadge } from "./AccountTypeBadge";

interface AllocateToBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
  currentMonthKey: string;
  currentBudget: number;
  onAllocate: (
    accountId: string,
    monthKey: string,
    amount: number,
    currency: CurrencyCode,
  ) => void;
}

/**
 * Dialog for allocating money from an account to a monthly budget
 */
export function AllocateToBudgetDialog({
  open,
  onOpenChange,
  account,
  currentMonthKey,
  currentBudget,
  onAllocate,
}: AllocateToBudgetDialogProps) {
  const [amount, setAmount] = useState("");
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [currency, setCurrency] = useState<CurrencyCode>("USD");

  useEffect(() => {
    if (open) {
      setAmount("");
      setMonthKey(currentMonthKey);
      setCurrency(account?.currency ?? "USD");
    }
  }, [open, currentMonthKey, account]);

  const allocateAmount = parseFloat(amount) || 0;
  const available = account?.balances[currency] ?? 0;
  const canAllocate = account && allocateAmount > 0 && allocateAmount <= available;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canAllocate && account) {
      onAllocate(account.id, monthKey, allocateAmount, currency);
      onOpenChange(false);
    }
  };

  const formatMonth = (key: string) => {
    const [year, month] = key.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  // Generate month options (current + next 3 months)
  const monthOptions: string[] = [];
  const today = new Date();
  for (let i = 0; i < 4; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    monthOptions.push(key);
  }

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
            <PiggyBank className="w-5 h-5 text-amber-600" />
            Allocate to Budget
          </DialogTitle>
          <DialogDescription className="text-sm text-stone-500">
            Transfer money from your account to your monthly budget.
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
              <p className="text-sm text-stone-500">
                Available: {formatCurrency(available, currency)}
              </p>
            </div>
          </div>

          {/* Month Selection */}
          <div className="space-y-1.5">
            <Label
              className={cn(
                "flex items-center gap-1",
                paperTheme.fonts.handwriting
              )}
            >
              <Calendar className="w-4 h-4" />
              Budget Month
            </Label>
            <select
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              className={cn(
                "w-full px-3 py-2 rounded-lg border text-sm",
                paperTheme.colors.borders.amber,
                paperTheme.colors.background.white,
                "focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              )}
            >
              {monthOptions.map((key) => (
                <option key={key} value={key}>
                  {formatMonth(key)}
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount" className={paperTheme.fonts.handwriting}>
                Allocation Amount
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
                max={available}
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
            {allocateAmount > available && (
              <p className="text-xs text-red-500">Exceeds available balance</p>
            )}
            {currency !== getBaseCurrency() && allocateAmount > 0 && (
              <p className="text-xs text-stone-500">
                ≈ {formatCurrency(toBase(allocateAmount, currency))} added
                to the budget
              </p>
            )}
          </div>

          {/* Quick amounts */}
          <div className="flex gap-2 flex-wrap">
            {CURRENCIES[currency].presets.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant="outline"
                size="sm"
                className={cn("h-7 text-xs", paperTheme.colors.borders.amber)}
                onClick={() => setAmount(preset.toString())}
                disabled={preset > available}
              >
                {formatCurrency(preset, currency)}
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("h-7 text-xs", paperTheme.colors.borders.amber)}
              onClick={() => setAmount(available.toString())}
            >
              All ({formatCurrency(available, currency)})
            </Button>
          </div>

          {/* Preview */}
          {allocateAmount > 0 && allocateAmount <= available && (
            <div
              className={cn(
                "p-3 rounded-lg border space-y-2",
                paperTheme.colors.borders.amber,
                "bg-amber-50/50"
              )}
            >
              <p className="text-xs text-stone-500">After allocation:</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-stone-400">Account Balance</p>
                  <p className="font-medium text-stone-700">
                    {formatCurrency(available - allocateAmount, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-stone-400">
                    {formatMonth(monthKey)} Budget
                  </p>
                  <p className="font-medium text-green-600">
                    {formatCurrency(
                      currentBudget + toBase(allocateAmount, currency),
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Info */}
          <p className="text-xs text-stone-500">
            Money allocated to budget becomes available for spending in that
            month. This is an envelope-style budgeting approach.
          </p>

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
                "bg-amber-500 hover:bg-amber-600 text-white"
              )}
              disabled={!canAllocate}
            >
              Allocate to Budget
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AllocateToBudgetDialog;
