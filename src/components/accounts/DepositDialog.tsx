import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Account } from "@/lib/data-service";
import { cn } from "@/lib/utils";
import { paperTheme } from "@/styles";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { AccountTypeBadge } from "./AccountTypeBadge";

interface DepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
  onDeposit: (accountId: string, amount: number, note?: string) => void;
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

  useEffect(() => {
    if (open) {
      setAmount("");
      setNote("");
    }
  }, [open]);

  const depositAmount = parseFloat(amount) || 0;
  const canDeposit = account && depositAmount > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canDeposit && account) {
      onDeposit(account.id, depositAmount, note || undefined);
      onOpenChange(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
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
              <p className="text-sm text-stone-500">
                Current: {formatCurrency(account.currentBalance)}
              </p>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="amount" className={paperTheme.fonts.handwriting}>
              Deposit Amount
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
                {formatCurrency(account.currentBalance + depositAmount)}
              </p>
              <p className="text-xs text-green-600">
                +{formatCurrency(depositAmount)}
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
