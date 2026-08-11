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
  getBaseCurrency,
  toBase,
} from "@/lib/currency";
import type { Account, BudgetAllocation } from "@/lib/data-service";
import { cn, formatCurrency } from "@/lib/utils";
import { CurrencyChips } from "@/components/accounts/CurrencyChips";
import { paperTheme } from "@/styles";
import { PiggyBank, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { AccountTypeBadge } from "../accounts/AccountTypeBadge";

interface LinkAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  existingAllocations: BudgetAllocation[];
  monthKey: string;
  onLinkAccount: (
    accountId: string,
    amount: number,
    currency: CurrencyCode,
  ) => void;
}

/**
 * Dialog for linking an account to the monthly budget
 * Shows available accounts (excluding already linked ones)
 * Allows user to specify allocation amount
 */
export function LinkAccountDialog({
  open,
  onOpenChange,
  accounts,
  existingAllocations,
  monthKey,
  onLinkAccount,
}: LinkAccountDialogProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null
  );
  const [amount, setAmount] = useState<string>("");
  const [currency, setCurrency] = useState<CurrencyCode>("USD");

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedAccountId(null);
      setAmount("");
      setCurrency("USD");
    }
  }, [open]);

  // Filter out accounts that are already linked to this month's budget
  const linkedAccountIds = new Set(existingAllocations.map((a) => a.accountId));
  const availableAccounts = accounts.filter(
    (a) => !linkedAccountIds.has(a.id)
  );

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  // Keep the chosen currency inside the wallet's held set.
  useEffect(() => {
    if (selectedAccount && !selectedAccount.currencies.includes(currency)) {
      setCurrency(selectedAccount.currency);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId]);

  const allocationAmount = parseFloat(amount) || 0;
  const available = selectedAccount?.balances[currency] ?? 0;

  // Validate form
  const canSubmit =
    selectedAccountId &&
    allocationAmount > 0 &&
    selectedAccount &&
    allocationAmount <= available;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit && selectedAccountId) {
      onLinkAccount(selectedAccountId, allocationAmount, currency);
      onOpenChange(false);
    }
  };

  const formatMonth = (key: string) => {
    const [year, month] = key.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

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
            Add Funding Source
          </DialogTitle>
          <DialogDescription className="text-sm text-stone-500">
            Select an account to fund your {formatMonth(monthKey)} budget.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="relative space-y-4 pt-2">
          {/* Account Selection */}
          <div className="space-y-2">
            <Label className={paperTheme.fonts.handwriting}>
              Select Account
            </Label>

            {availableAccounts.length === 0 ? (
              <div
                className={cn(
                  "p-4 rounded-lg text-center",
                  paperTheme.colors.background.white,
                  paperTheme.colors.borders.amber
                )}
              >
                <p className="text-sm text-stone-500">
                  All accounts are already linked to this month's budget.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {availableAccounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => setSelectedAccountId(account.id)}
                    className={cn(
                      "w-full p-3 rounded-lg border flex items-center justify-between cursor-pointer",
                      "transition-all duration-150",
                      selectedAccountId === account.id
                        ? "border-amber-400 bg-amber-50"
                        : "border-amber-200 bg-white/50 hover:bg-amber-50/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <AccountTypeBadge
                        type={account.accountType}
                        showLabel={false}
                        size="md"
                      />
                      <div className="text-left">
                        <p
                          className={cn(
                            "font-medium text-sm",
                            paperTheme.fonts.handwriting
                          )}
                        >
                          {account.name}
                        </p>
                        <p className="text-xs text-stone-500">
                          {account.currencies
                            .map((c) =>
                              formatCurrency(account.balances[c] ?? 0, c),
                            )
                            .join(" · ")}
                        </p>
                      </div>
                    </div>
                    {selectedAccountId === account.id && (
                      <Check className="w-5 h-5 text-amber-600" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Amount Input - Only show when account is selected */}
          {selectedAccountId && selectedAccount && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="amount" className={paperTheme.fonts.handwriting}>
                  Allocation Amount
                </Label>
                <CurrencyChips
                  currencies={selectedAccount.currencies}
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
              {allocationAmount > available && (
                <p className="text-xs text-red-500">
                  Exceeds available balance
                </p>
              )}
              {currency !== getBaseCurrency() && allocationAmount > 0 && (
                <p className="text-xs text-stone-500">
                  ≈ {formatCurrency(toBase(allocationAmount, currency))} added
                  to the budget
                </p>
              )}

              {/* Quick amounts */}
              <div className="flex gap-2 flex-wrap pt-1">
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
            </div>
          )}

          {/* Preview */}
          {selectedAccount &&
            allocationAmount > 0 &&
            allocationAmount <= available && (
              <div
                className={cn(
                  "p-3 rounded-lg border space-y-2",
                  paperTheme.colors.borders.amber,
                  "bg-amber-50/50"
                )}
              >
                <p className="text-xs text-stone-500">After linking:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-stone-400">Account Balance</p>
                    <p className="font-medium text-stone-700">
                      {formatCurrency(available - allocationAmount, currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-400">Added to Budget</p>
                    <p className="font-medium text-green-600">
                      +{formatCurrency(toBase(allocationAmount, currency))}
                    </p>
                  </div>
                </div>
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
                "bg-amber-500 hover:bg-amber-600 text-white"
              )}
              disabled={!canSubmit}
            >
              Add to Budget
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default LinkAccountDialog;
