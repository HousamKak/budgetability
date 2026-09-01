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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CURRENCIES,
  type CurrencyCode,
  convert,
  convertAt,
  getBaseCurrency,
  rateBetween,
} from "@/lib/currency";
import { CurrencyChips } from "@/components/accounts/CurrencyChips";
import { RateOverride } from "@/components/accounts/RateOverride";
import type { Account, SavingsGoal } from "@/lib/data-service";
import { dataService } from "@/lib/data-service";
import { cn, formatCurrency } from "@/lib/utils";
import { paperTheme } from "@/styles";
import { ArrowRight, PiggyBank, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

interface ContributeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: SavingsGoal | null;
  onContribute: (
    goalId: string,
    accountId: string,
    amount: number,
    note?: string,
    currency?: CurrencyCode,
    exchangeRate?: number
  ) => void;
}

/**
 * Dialog for contributing money from an account to a savings goal
 */
export function ContributeDialog({
  open,
  onOpenChange,
  goal,
  onContribute,
}: ContributeDialogProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  // Per-transaction exchange-rate override (base per 1 `currency`).
  const [rateOverride, setRateOverride] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadAccounts();
      setAmount("");
      setNote("");
      setSelectedAccountId("");
      setCurrency("USD");
      setRateOverride(null);
    }
  }, [open]);

  useEffect(() => {
    setRateOverride(null);
  }, [currency]);

  const loadAccounts = async () => {
    try {
      const data = await dataService.getAccounts();
      setAccounts(data);
      // Pre-select default account if available
      const defaultAccount = data.find((a) => a.isDefault);
      if (defaultAccount) {
        setSelectedAccountId(defaultAccount.id);
      } else if (data.length > 0) {
        setSelectedAccountId(data[0].id);
      }
    } catch (error) {
      console.error("Failed to load accounts:", error);
    }
  };

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  // Keep the chosen currency inside the wallet's held set.
  useEffect(() => {
    if (selectedAccount && !selectedAccount.currencies.includes(currency)) {
      setCurrency(selectedAccount.currency);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId]);

  const amountNum = parseFloat(amount) || 0;
  const remaining = goal ? goal.targetAmount - goal.currentAmount : 0;
  const available = selectedAccount?.balances[currency] ?? 0;
  const canContribute = selectedAccount && amountNum > 0 && amountNum <= available;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal || !selectedAccountId || amountNum <= 0) return;

    setLoading(true);
    try {
      await onContribute(
        goal.id,
        selectedAccountId,
        amountNum,
        note || undefined,
        currency,
        rateOverride ?? undefined
      );
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to contribute:", error);
    } finally {
      setLoading(false);
    }
  };

  // Contribution-scale quick amounts in the chosen currency.
  const quickAmounts = CURRENCIES[currency].presets.map((p) => p / 10);
  // Rate in force for this contribution (base per 1 `currency`).
  const effectiveRate = rateOverride ?? rateBetween(currency, getBaseCurrency());
  const toBaseAt = (n: number) => convertAt(n, effectiveRate);
  // How much of the goal remains, expressed in the chosen currency.
  const remainingNative =
    effectiveRate > 0
      ? Math.round((remaining / effectiveRate) * 100) / 100
      : convert(remaining, getBaseCurrency(), currency);

  if (!goal) return null;

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
            <PiggyBank className="w-5 h-5" />
            Contribute to "{goal.name}"
          </DialogTitle>
          <DialogDescription className="text-sm text-stone-500">
            Add money from an account to your savings goal.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="relative space-y-4 pt-2">
          {/* Goal Progress */}
          <div
            className={cn("p-3 rounded-lg", paperTheme.colors.background.white)}
          >
            <div className="flex justify-between text-sm mb-1">
              <span className="text-stone-500">Current Progress</span>
              <span
                className={cn("font-medium", paperTheme.colors.text.accent)}
              >
                {Math.round((goal.currentAmount / goal.targetAmount) * 100)}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Remaining</span>
              <span className={cn("font-bold", paperTheme.fonts.handwriting)}>
                {formatCurrency(remaining)}
              </span>
            </div>
          </div>

          {/* Account Selection */}
          <div className="space-y-1.5">
            <Label className={paperTheme.fonts.handwriting}>From Account</Label>
            {accounts.length === 0 ? (
              <div className="text-sm text-stone-500 p-3 border rounded-lg border-dashed">
                No accounts available. Create an account first.
              </div>
            ) : (
              <Select
                value={selectedAccountId}
                onValueChange={setSelectedAccountId}
              >
                <SelectTrigger
                  className={cn(
                    paperTheme.colors.borders.amber,
                    paperTheme.colors.background.white
                  )}
                >
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-stone-400" />
                        <span>{account.name}</span>
                        <span className="text-stone-400 ml-auto">
                          {account.currencies
                            .map((c) =>
                              formatCurrency(account.balances[c] ?? 0, c),
                            )
                            .join(" · ")}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="contribute-amount"
                className={paperTheme.fonts.handwriting}
              >
                Amount
              </Label>
              {selectedAccount && (
                <CurrencyChips
                  currencies={selectedAccount.currencies}
                  value={currency}
                  onChange={setCurrency}
                />
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-sm">
                {CURRENCIES[currency].symbol}
              </span>
              <input
                id="contribute-amount"
                type="number"
                step={CURRENCIES[currency].inputStep}
                min={CURRENCIES[currency].inputStep}
                max={available}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={CURRENCIES[currency].inputPlaceholder}
                required
                className={cn(
                  "w-full py-2 pr-3 rounded-lg border text-sm",
                  currency === "USD" ? "pl-7" : "pl-12",
                  paperTheme.colors.borders.amber,
                  paperTheme.colors.background.white,
                  "focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                )}
              />
            </div>
            {currency !== getBaseCurrency() && (
              <div className="space-y-1 pt-1">
                <RateOverride
                  from={currency}
                  to={getBaseCurrency()}
                  rate={rateOverride}
                  onChange={setRateOverride}
                />
                {amountNum > 0 && (
                  <p className="text-xs text-stone-500">
                    ≈ {formatCurrency(toBaseAt(amountNum))} toward the goal
                  </p>
                )}
              </div>
            )}

            {/* Quick amounts */}
            <div className="flex gap-2 mt-2">
              {quickAmounts.map((quick) => (
                <Button
                  key={quick}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setAmount(quick.toString())}
                  disabled={!selectedAccount || quick > available}
                >
                  {formatCurrency(quick, currency)}
                </Button>
              ))}
              {remainingNative > 0 &&
                selectedAccount &&
                remainingNative <= available && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs bg-green-50 border-green-200 hover:bg-green-100"
                    onClick={() => setAmount(remainingNative.toFixed(2))}
                  >
                    Fill
                  </Button>
                )}
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label
              htmlFor="contribute-note"
              className={paperTheme.fonts.handwriting}
            >
              Note (optional)
            </Label>
            <input
              id="contribute-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Birthday bonus"
              className={cn(
                "w-full px-3 py-2 rounded-lg border text-sm",
                paperTheme.colors.borders.amber,
                paperTheme.colors.background.white,
                "focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              )}
            />
          </div>

          {/* Preview */}
          {selectedAccount && amountNum > 0 && (
            <div
              className={cn(
                "p-3 rounded-lg border",
                paperTheme.colors.borders.amber,
                paperTheme.colors.background.white
              )}
            >
              <div className="flex items-center gap-2 text-sm text-stone-600">
                <div className="flex-1 text-center">
                  <p className="text-xs text-stone-400">
                    {selectedAccount.name} ({currency})
                  </p>
                  <p className="font-medium">
                    {formatCurrency(available, currency)}
                  </p>
                  <p className="text-xs text-stone-400">
                    → {formatCurrency(available - amountNum, currency)}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-500" />
                <div className="flex-1 text-center">
                  <p className="text-xs text-stone-400">{goal.name}</p>
                  <p className="font-medium">
                    {formatCurrency(goal.currentAmount)}
                  </p>
                  <p className="text-xs text-green-600">
                    →{" "}
                    {formatCurrency(goal.currentAmount + toBaseAt(amountNum))}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Warning if exceeds balance */}
          {selectedAccount && amountNum > available && (
            <p className="text-xs text-red-500">
              Amount exceeds available balance (
              {formatCurrency(available, currency)})
            </p>
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
                "bg-amber-500 hover:bg-amber-600 text-white"
              )}
              disabled={!canContribute || loading || accounts.length === 0}
            >
              {loading ? "Contributing..." : "Contribute"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ContributeDialog;
