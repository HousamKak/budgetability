import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
  onAllocate: (accountId: string, monthKey: string, amount: number) => void;
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

  useEffect(() => {
    if (open) {
      setAmount("");
      setMonthKey(currentMonthKey);
    }
  }, [open, currentMonthKey]);

  const allocateAmount = parseFloat(amount) || 0;
  const canAllocate =
    account && allocateAmount > 0 && allocateAmount <= account.currentBalance;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canAllocate && account) {
      onAllocate(account.id, monthKey, allocateAmount);
      onOpenChange(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
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
        aria-describedby={undefined}
      >
        <div
          className={cn(
            "absolute inset-0 opacity-15 pointer-events-none rounded-lg",
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
                Available: {formatCurrency(account.currentBalance)}
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
                max={account.currentBalance}
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
            {allocateAmount > account.currentBalance && (
              <p className="text-xs text-red-500">Exceeds available balance</p>
            )}
          </div>

          {/* Quick amounts */}
          <div className="flex gap-2 flex-wrap">
            {[100, 250, 500, 1000].map((preset) => (
              <Button
                key={preset}
                type="button"
                variant="outline"
                size="sm"
                className={cn("h-7 text-xs", paperTheme.colors.borders.amber)}
                onClick={() => setAmount(preset.toString())}
                disabled={preset > account.currentBalance}
              >
                ${preset}
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("h-7 text-xs", paperTheme.colors.borders.amber)}
              onClick={() => setAmount(account.currentBalance.toString())}
            >
              All ({formatCurrency(account.currentBalance)})
            </Button>
          </div>

          {/* Preview */}
          {allocateAmount > 0 && allocateAmount <= account.currentBalance && (
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
                    {formatCurrency(account.currentBalance - allocateAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-stone-400">
                    {formatMonth(monthKey)} Budget
                  </p>
                  <p className="font-medium text-green-600">
                    {formatCurrency(currentBudget + allocateAmount)}
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
