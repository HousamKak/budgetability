import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  Account,
  AccountTransaction,
  BudgetAllocation,
} from "@/lib/data-service";
import { cn, formatCurrency } from "@/lib/utils";
import { paperTheme } from "@/styles";
import { Wallet, Plus, Info, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { AccountBudgetCard } from "./AccountBudgetCard";
import { LinkAccountDialog } from "./LinkAccountDialog";

interface BudgetSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthKey: string;
  budget: number;
  budgetInput: string;
  accounts: Account[];
  allocations: BudgetAllocation[];
  transactions: AccountTransaction[];
  onBudgetInputChange: (value: string) => void;
  onLinkAccount: (accountId: string, amount: number) => void;
  onAdjustAllocation: (accountId: string, newAmount: number) => void;
  onRemoveAllocation: (accountId: string) => void;
}

/**
 * Main budget setup dialog
 * Opens when clicking the budget area in DashboardHeader
 * Contains:
 * - Budget amount input
 * - List of linked accounts with AccountBudgetCard components
 * - Add Account button to link new accounts
 */
export function BudgetSetupDialog({
  open,
  onOpenChange,
  monthKey,
  budget,
  budgetInput,
  accounts,
  allocations,
  transactions,
  onBudgetInputChange,
  onLinkAccount,
  onAdjustAllocation,
  onRemoveAllocation,
}: BudgetSetupDialogProps) {
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [adjustingAccountId, setAdjustingAccountId] = useState<string | null>(
    null
  );
  const [adjustAmount, setAdjustAmount] = useState<string>("");

  // Reset adjustment state when dialog closes
  useEffect(() => {
    if (!open) {
      setAdjustingAccountId(null);
      setAdjustAmount("");
    }
  }, [open]);

  const formatMonth = (key: string) => {
    const [year, month] = key.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  // Calculate total allocated from all accounts
  const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);

  // Calculate difference between budget and allocated
  const difference = budget - totalAllocated;
  const isOverAllocated = difference < 0;
  const isUnderAllocated = difference > 0;

  // Get account and transaction data for each allocation
  const getAllocationData = (allocation: BudgetAllocation) => {
    const account = accounts.find((a) => a.id === allocation.accountId);
    const accountTransactions = transactions.filter(
      (t) =>
        (t.fromAccountId === allocation.accountId ||
          t.toAccountId === allocation.accountId) &&
        t.monthKey === monthKey
    );
    return { account, transactions: accountTransactions };
  };

  // Handle adjustment submission
  const handleAdjustSubmit = () => {
    if (adjustingAccountId) {
      const newAmount = parseFloat(adjustAmount) || 0;
      if (newAmount > 0) {
        onAdjustAllocation(adjustingAccountId, newAmount);
        setAdjustingAccountId(null);
        setAdjustAmount("");
      }
    }
  };

  // Handle opening adjustment mode
  const handleOpenAdjust = (accountId: string, currentAmount: number) => {
    setAdjustingAccountId(accountId);
    setAdjustAmount(currentAmount.toString());
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col",
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

          <DialogHeader className="relative flex-shrink-0">
            <DialogTitle
              className={cn(
                "text-xl flex items-center gap-2",
                paperTheme.colors.text.accent,
                paperTheme.fonts.handwriting
              )}
            >
              <Wallet className="w-5 h-5 text-amber-600" />
              Budget Setup - {formatMonth(monthKey)}
            </DialogTitle>
            <DialogDescription className="text-sm text-stone-500">
              Set your monthly budget and link accounts as funding sources.
            </DialogDescription>
          </DialogHeader>

          <div className="relative flex-1 overflow-y-auto space-y-4 py-2">
            {/* Budget Amount Input */}
            <div className="space-y-2">
              <Label
                htmlFor="budget-amount"
                className={cn("text-sm font-medium", paperTheme.fonts.handwriting)}
              >
                Monthly Budget
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-lg">
                  $
                </span>
                <Input
                  id="budget-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={budgetInput}
                  onChange={(e) => onBudgetInputChange(e.target.value)}
                  placeholder="0.00"
                  className={cn(
                    "pl-8 pr-3 py-3 text-xl font-semibold rounded-xl",
                    paperTheme.colors.borders.amber,
                    "bg-white/70 focus:bg-white",
                    "focus:ring-2 focus:ring-amber-400/50"
                  )}
                />
              </div>
            </div>

            {/* Allocation Summary */}
            <div
              className={cn(
                "p-3 rounded-lg border",
                paperTheme.colors.borders.amber,
                "bg-white/50"
              )}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-stone-600">Total from Accounts</span>
                <span
                  className={cn(
                    "text-lg font-semibold",
                    paperTheme.fonts.handwriting,
                    "text-amber-700"
                  )}
                >
                  {formatCurrency(totalAllocated)}
                </span>
              </div>

              {/* Difference indicator */}
              {budget > 0 && (isOverAllocated || isUnderAllocated) && (
                <div
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-md text-xs",
                    isOverAllocated
                      ? "bg-red-50 text-red-700"
                      : "bg-blue-50 text-blue-700"
                  )}
                >
                  {isOverAllocated ? (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  ) : (
                    <Info className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isOverAllocated
                      ? `Over-allocated by ${formatCurrency(Math.abs(difference))}`
                      : `Budget is ${formatCurrency(difference)} more than allocated sources`}
                  </span>
                </div>
              )}

              {budget > 0 && !isOverAllocated && !isUnderAllocated && (
                <div className="flex items-center gap-2 p-2 rounded-md text-xs bg-green-50 text-green-700">
                  <Info className="w-3.5 h-3.5" />
                  <span>Budget matches allocated sources</span>
                </div>
              )}
            </div>

            {/* Funding Sources Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3
                  className={cn(
                    "text-sm font-medium text-stone-700",
                    paperTheme.fonts.handwriting
                  )}
                >
                  Funding Sources
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-7 text-xs",
                    paperTheme.colors.borders.amber,
                    "hover:bg-amber-50"
                  )}
                  onClick={() => setShowLinkDialog(true)}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Account
                </Button>
              </div>

              {/* Account Cards */}
              {allocations.length === 0 ? (
                <div
                  className={cn(
                    "p-6 rounded-lg text-center",
                    paperTheme.colors.background.white,
                    paperTheme.colors.borders.amber
                  )}
                >
                  <Wallet className="w-8 h-8 text-amber-300 mx-auto mb-2" />
                  <p className="text-sm text-stone-500 mb-3">
                    No accounts linked yet
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-8 text-xs",
                      paperTheme.colors.borders.amber,
                      "hover:bg-amber-50"
                    )}
                    onClick={() => setShowLinkDialog(true)}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Link First Account
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {allocations.map((allocation) => {
                    const { account, transactions: accountTxs } =
                      getAllocationData(allocation);
                    if (!account) return null;

                    // Show inline adjustment form if this account is being adjusted
                    if (adjustingAccountId === account.id) {
                      return (
                        <div
                          key={allocation.id}
                          className={cn(
                            "p-3 rounded-xl",
                            paperTheme.colors.background.white,
                            paperTheme.colors.borders.amber
                          )}
                        >
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                Adjust {account.name}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">
                                  $
                                </span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  max={
                                    account.currentBalance + allocation.amount
                                  }
                                  value={adjustAmount}
                                  onChange={(e) =>
                                    setAdjustAmount(e.target.value)
                                  }
                                  autoFocus
                                  className={cn(
                                    "w-full pl-7 pr-3 py-2 rounded-lg border text-sm",
                                    paperTheme.colors.borders.amber,
                                    "bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                                  )}
                                />
                              </div>
                              <Button
                                size="sm"
                                className="bg-amber-500 hover:bg-amber-600 text-white"
                                onClick={handleAdjustSubmit}
                              >
                                Save
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setAdjustingAccountId(null);
                                  setAdjustAmount("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                            <p className="text-xs text-stone-500">
                              Available: {formatCurrency(account.currentBalance + allocation.amount)}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <AccountBudgetCard
                        key={allocation.id}
                        account={account}
                        allocation={allocation}
                        transactions={accountTxs}
                        totalBudget={budget}
                        onAdjustAllocation={handleOpenAdjust}
                        onRemoveFromBudget={onRemoveAllocation}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="relative flex-shrink-0 pt-3 border-t border-amber-200">
            <Button
              className={cn(
                "w-full",
                "bg-amber-500 hover:bg-amber-600 text-white"
              )}
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link Account Dialog */}
      <LinkAccountDialog
        open={showLinkDialog}
        onOpenChange={setShowLinkDialog}
        accounts={accounts}
        existingAllocations={allocations}
        monthKey={monthKey}
        onLinkAccount={onLinkAccount}
      />
    </>
  );
}

export default BudgetSetupDialog;
