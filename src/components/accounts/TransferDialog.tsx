import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import type { Account } from "@/lib/data-service";
import { cn } from "@/lib/utils";
import { paperTheme } from "@/styles";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { AccountTypeBadge } from "./AccountTypeBadge";

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  sourceAccount?: Account;
  onTransfer: (
    fromId: string,
    toId: string,
    amount: number,
    note?: string
  ) => void;
}

/**
 * Dialog for transferring money between accounts
 */
export function TransferDialog({
  open,
  onOpenChange,
  accounts,
  sourceAccount,
  onTransfer,
}: TransferDialogProps) {
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setFromAccountId(sourceAccount?.id || "");
      setToAccountId("");
      setAmount("");
      setNote("");
    }
  }, [open, sourceAccount]);

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);
  const transferAmount = parseFloat(amount) || 0;

  const canTransfer =
    fromAccountId &&
    toAccountId &&
    fromAccountId !== toAccountId &&
    transferAmount > 0 &&
    fromAccount &&
    transferAmount <= fromAccount.currentBalance;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canTransfer) {
      onTransfer(fromAccountId, toAccountId, transferAmount, note || undefined);
      onOpenChange(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

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
              "text-xl",
              paperTheme.colors.text.accent,
              paperTheme.fonts.handwriting
            )}
          >
            Transfer Money
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="relative space-y-4 pt-2">
          {/* From Account */}
          <div className="space-y-1.5">
            <Label className={paperTheme.fonts.handwriting}>From Account</Label>
            <Select value={fromAccountId} onValueChange={setFromAccountId}>
              <SelectTrigger
                className={cn(
                  "w-full",
                  paperTheme.colors.borders.amber,
                  paperTheme.colors.background.white
                )}
              >
                <SelectValue placeholder="Select source account">
                  {fromAccount && (
                    <div className="flex items-center gap-2">
                      <AccountTypeBadge
                        type={fromAccount.accountType}
                        showLabel={false}
                        size="sm"
                      />
                      <span>{fromAccount.name}</span>
                      <span className="text-xs text-stone-500">
                        ({formatCurrency(fromAccount.currentBalance)})
                      </span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {accounts
                  .filter((a) => a.id !== toAccountId)
                  .map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <AccountTypeBadge
                          type={account.accountType}
                          showLabel={false}
                          size="sm"
                        />
                        <span>{account.name}</span>
                        <span className="text-xs text-stone-500">
                          ({formatCurrency(account.currentBalance)})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Arrow indicator */}
          <div className="flex justify-center">
            <ArrowRight className="w-5 h-5 text-amber-500" />
          </div>

          {/* To Account */}
          <div className="space-y-1.5">
            <Label className={paperTheme.fonts.handwriting}>To Account</Label>
            <Select value={toAccountId} onValueChange={setToAccountId}>
              <SelectTrigger
                className={cn(
                  "w-full",
                  paperTheme.colors.borders.amber,
                  paperTheme.colors.background.white
                )}
              >
                <SelectValue placeholder="Select destination account">
                  {toAccount && (
                    <div className="flex items-center gap-2">
                      <AccountTypeBadge
                        type={toAccount.accountType}
                        showLabel={false}
                        size="sm"
                      />
                      <span>{toAccount.name}</span>
                      <span className="text-xs text-stone-500">
                        ({formatCurrency(toAccount.currentBalance)})
                      </span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {accounts
                  .filter((a) => a.id !== fromAccountId)
                  .map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <AccountTypeBadge
                          type={account.accountType}
                          showLabel={false}
                          size="sm"
                        />
                        <span>{account.name}</span>
                        <span className="text-xs text-stone-500">
                          ({formatCurrency(account.currentBalance)})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="amount" className={paperTheme.fonts.handwriting}>
              Amount
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
                max={fromAccount?.currentBalance || undefined}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={cn(
                  "w-full pl-7 pr-3 py-2 rounded-lg border text-sm",
                  paperTheme.colors.borders.amber,
                  paperTheme.colors.background.white,
                  "focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                )}
              />
            </div>
            {fromAccount && transferAmount > fromAccount.currentBalance && (
              <p className="text-xs text-red-500">
                Exceeds available balance (
                {formatCurrency(fromAccount.currentBalance)})
              </p>
            )}
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
              placeholder="e.g., Monthly savings transfer"
              className={cn(
                "w-full px-3 py-2 rounded-lg border text-sm",
                paperTheme.colors.borders.amber,
                paperTheme.colors.background.white,
                "focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              )}
            />
          </div>

          {/* Preview */}
          {canTransfer && fromAccount && toAccount && (
            <div
              className={cn(
                "p-3 rounded-lg border",
                paperTheme.colors.borders.amber,
                "bg-amber-50/50"
              )}
            >
              <p className="text-xs text-stone-500 mb-1">After transfer:</p>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="font-medium">{fromAccount.name}:</span>{" "}
                  <span className="text-red-600">
                    {formatCurrency(
                      fromAccount.currentBalance - transferAmount
                    )}
                  </span>
                </p>
                <p>
                  <span className="font-medium">{toAccount.name}:</span>{" "}
                  <span className="text-green-600">
                    {formatCurrency(toAccount.currentBalance + transferAmount)}
                  </span>
                </p>
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
              disabled={!canTransfer}
            >
              Transfer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default TransferDialog;
