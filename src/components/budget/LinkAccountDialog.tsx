import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Account, BudgetAllocation } from "@/lib/data-service";
import { cn, formatCurrency } from "@/lib/utils";
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
  onLinkAccount: (accountId: string, amount: number) => void;
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

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedAccountId(null);
      setAmount("");
    }
  }, [open]);

  // Filter out accounts that are already linked to this month's budget
  const linkedAccountIds = new Set(existingAllocations.map((a) => a.accountId));
  const availableAccounts = accounts.filter(
    (a) => !linkedAccountIds.has(a.id)
  );

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const allocationAmount = parseFloat(amount) || 0;

  // Validate form
  const canSubmit =
    selectedAccountId &&
    allocationAmount > 0 &&
    selectedAccount &&
    allocationAmount <= selectedAccount.currentBalance;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit && selectedAccountId) {
      onLinkAccount(selectedAccountId, allocationAmount);
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
                          Available: {formatCurrency(account.currentBalance)}
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
              <Label htmlFor="amount" className={paperTheme.fonts.handwriting}>
                Allocation Amount
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">
                  $
                </span>
                <input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedAccount.currentBalance}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  className={cn(
                    "w-full pl-7 pr-3 py-2 rounded-lg border text-sm",
                    paperTheme.colors.borders.amber,
                    paperTheme.colors.background.white,
                    "focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                  )}
                />
              </div>
              {allocationAmount > selectedAccount.currentBalance && (
                <p className="text-xs text-red-500">
                  Exceeds available balance
                </p>
              )}

              {/* Quick amounts */}
              <div className="flex gap-2 flex-wrap pt-1">
                {[100, 250, 500, 1000].map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn("h-7 text-xs", paperTheme.colors.borders.amber)}
                    onClick={() => setAmount(preset.toString())}
                    disabled={preset > selectedAccount.currentBalance}
                  >
                    ${preset}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn("h-7 text-xs", paperTheme.colors.borders.amber)}
                  onClick={() =>
                    setAmount(selectedAccount.currentBalance.toString())
                  }
                >
                  All ({formatCurrency(selectedAccount.currentBalance)})
                </Button>
              </div>
            </div>
          )}

          {/* Preview */}
          {selectedAccount &&
            allocationAmount > 0 &&
            allocationAmount <= selectedAccount.currentBalance && (
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
                      {formatCurrency(
                        selectedAccount.currentBalance - allocationAmount
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-400">Added to Budget</p>
                    <p className="font-medium text-green-600">
                      +{formatCurrency(allocationAmount)}
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
