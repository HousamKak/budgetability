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
import { CURRENCIES, type CurrencyCode, convert } from "@/lib/currency";
import type { Account } from "@/lib/data-service";
import { cn, formatCurrency } from "@/lib/utils";
import { CurrencyChips } from "./CurrencyChips";
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
    note?: string,
    toAmount?: number,
    fromCurrency?: CurrencyCode,
    toCurrency?: CurrencyCode
  ) => void;
}

/**
 * Dialog for transferring money between accounts — or between two currency
 * balances of the SAME wallet (an exchange: LL → $ inside one cash envelope).
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
  const [fromCurrency, setFromCurrency] = useState<CurrencyCode>("USD");
  const [toCurrency, setToCurrency] = useState<CurrencyCode>("USD");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  // Cross-currency: destination-side amount, pre-filled from the rate table
  // but user-editable (street rates differ from the table rate).
  const [toAmountText, setToAmountText] = useState("");
  const [toAmountTouched, setToAmountTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setFromAccountId(sourceAccount?.id || "");
      setToAccountId("");
      setFromCurrency(sourceAccount?.currency ?? "USD");
      setToCurrency("USD");
      setAmount("");
      setNote("");
      setToAmountText("");
      setToAmountTouched(false);
    }
  }, [open, sourceAccount]);

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);
  const transferAmount = parseFloat(amount) || 0;
  const crossCurrency = fromCurrency !== toCurrency;
  const availableFrom = fromAccount?.balances[fromCurrency] ?? 0;

  // Snap the currency selections into each account's held set.
  useEffect(() => {
    if (fromAccount && !fromAccount.currencies.includes(fromCurrency)) {
      setFromCurrency(fromAccount.currency);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromAccountId]);
  useEffect(() => {
    if (toAccount && !toAccount.currencies.includes(toCurrency)) {
      // Default the destination to the source currency when held (a plain
      // move), else the destination wallet's primary (an exchange).
      setToCurrency(
        toAccount.currencies.includes(fromCurrency)
          ? fromCurrency
          : toAccount.currency,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toAccountId, fromCurrency]);

  // Keep the converted amount in sync until the user overrides it.
  useEffect(() => {
    if (!crossCurrency) return;
    if (toAmountTouched) return;
    setToAmountText(
      transferAmount > 0
        ? String(convert(transferAmount, fromCurrency, toCurrency))
        : "",
    );
  }, [crossCurrency, transferAmount, fromCurrency, toCurrency, toAmountTouched]);

  // A new destination or currency pair resets any manual override.
  useEffect(() => {
    setToAmountTouched(false);
  }, [toAccountId, fromAccountId, fromCurrency, toCurrency]);

  const toAmountNum = parseFloat(toAmountText) || 0;
  // Same wallet is allowed when the currencies differ (an exchange).
  const sameAccountNoop = fromAccountId === toAccountId && !crossCurrency;

  const canTransfer =
    fromAccountId &&
    toAccountId &&
    !sameAccountNoop &&
    transferAmount > 0 &&
    fromAccount &&
    transferAmount <= availableFrom &&
    (!crossCurrency || toAmountNum > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canTransfer) {
      onTransfer(
        fromAccountId,
        toAccountId,
        transferAmount,
        note || undefined,
        crossCurrency ? toAmountNum : undefined,
        fromCurrency,
        toCurrency,
      );
      onOpenChange(false);
    }
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
              "text-xl",
              paperTheme.colors.text.accent,
              paperTheme.fonts.handwriting
            )}
          >
            Transfer Money
          </DialogTitle>
          <DialogDescription className="text-sm text-stone-500">
            Move funds between your accounts.
          </DialogDescription>
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
                        ({formatCurrency(availableFrom, fromCurrency)})
                      </span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    <div className="flex items-center gap-2">
                      <AccountTypeBadge
                        type={account.accountType}
                        showLabel={false}
                        size="sm"
                      />
                      <span>{account.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fromAccount && (
              <div className="flex items-center justify-between">
                <CurrencyChips
                  currencies={fromAccount.currencies}
                  value={fromCurrency}
                  onChange={setFromCurrency}
                />
                <span className="text-xs text-stone-400">
                  Available: {formatCurrency(availableFrom, fromCurrency)}
                </span>
              </div>
            )}
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
                        (
                        {formatCurrency(
                          toAccount.balances[toCurrency] ?? 0,
                          toCurrency,
                        )}
                        )
                      </span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {/* The same wallet is a valid destination when exchanging
                    between two of its currencies. */}
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    <div className="flex items-center gap-2">
                      <AccountTypeBadge
                        type={account.accountType}
                        showLabel={false}
                        size="sm"
                      />
                      <span>
                        {account.name}
                        {account.id === fromAccountId ? " (exchange)" : ""}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {toAccount && (
              <CurrencyChips
                currencies={toAccount.currencies}
                value={toCurrency}
                onChange={setToCurrency}
              />
            )}
            {sameAccountNoop && (
              <p className="text-xs text-red-500">
                Pick a different currency to exchange within this account.
              </p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="amount" className={paperTheme.fonts.handwriting}>
              Amount{crossCurrency && fromAccount ? " sent" : ""}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-sm">
                {CURRENCIES[fromCurrency].symbol}
              </span>
              <input
                id="amount"
                type="number"
                step={CURRENCIES[fromCurrency].inputStep}
                min="0.01"
                max={fromAccount ? availableFrom : undefined}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={CURRENCIES[fromCurrency].inputPlaceholder}
                className={cn(
                  "w-full py-2 pr-3 rounded-lg border text-sm",
                  fromCurrency === "USD" ? "pl-7" : "pl-12",
                  paperTheme.colors.borders.amber,
                  paperTheme.colors.background.white,
                  "focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                )}
              />
            </div>
            {fromAccount && transferAmount > availableFrom && (
              <p className="text-xs text-red-500">
                Exceeds available balance (
                {formatCurrency(availableFrom, fromCurrency)})
              </p>
            )}
          </div>

          {/* Cross-currency: destination-side amount (editable) */}
          {crossCurrency && fromAccount && toAccount && (
            <div className="space-y-1.5">
              <Label
                htmlFor="to-amount"
                className={paperTheme.fonts.handwriting}
              >
                Amount received ({toCurrency})
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-sm">
                  {CURRENCIES[toCurrency].symbol}
                </span>
                <input
                  id="to-amount"
                  type="number"
                  step={CURRENCIES[toCurrency].inputStep}
                  min="0.01"
                  value={toAmountText}
                  onChange={(e) => {
                    setToAmountTouched(true);
                    setToAmountText(e.target.value);
                  }}
                  placeholder={CURRENCIES[toCurrency].inputPlaceholder}
                  className={cn(
                    "w-full py-2 pr-3 rounded-lg border text-sm",
                    toCurrency === "USD" ? "pl-7" : "pl-12",
                    paperTheme.colors.borders.amber,
                    paperTheme.colors.background.white,
                    "focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                  )}
                />
              </div>
              <p className="text-xs text-stone-500">
                Pre-filled from your exchange rate — adjust it to what the
                exchange actually gives you.
                {transferAmount > 0 && toAmountNum > 0 && (
                  <>
                    {" "}
                    Effective rate:{" "}
                    {formatCurrency(transferAmount, fromCurrency)} ={" "}
                    {formatCurrency(toAmountNum, toCurrency)}
                  </>
                )}
              </p>
            </div>
          )}

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
                  <span className="font-medium">
                    {fromAccount.name} ({fromCurrency}):
                  </span>{" "}
                  <span className="text-red-600">
                    {formatCurrency(availableFrom - transferAmount, fromCurrency)}
                  </span>
                </p>
                <p>
                  <span className="font-medium">
                    {toAccount.name} ({toCurrency}):
                  </span>{" "}
                  <span className="text-green-600">
                    {formatCurrency(
                      (toAccount.balances[toCurrency] ?? 0) +
                        (crossCurrency ? toAmountNum : transferAmount) -
                        // In-wallet exchange: the same map also lost the
                        // source amount when currencies share a wallet.
                        (fromAccountId === toAccountId &&
                        toCurrency === fromCurrency
                          ? transferAmount
                          : 0),
                      toCurrency,
                    )}
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
