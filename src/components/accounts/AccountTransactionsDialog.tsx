import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Account, AccountTransaction } from "@/lib/data-service";
import { dataService } from "@/lib/data-service";
import { formatNumber } from "@/lib/utils";
import { cn, dialogStyles } from "@/styles";
import {
  ArrowRightLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface AccountTransactionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
  accounts: Account[];
  onDeposit?: (account: Account) => void;
  onTransfer?: (account: Account) => void;
}

function txIsInflow(
  tx: AccountTransaction,
  accountId: string,
): boolean {
  switch (tx.transactionType) {
    case "deposit":
      return true;
    case "expense":
    case "budget_allocation":
    case "savings_contribution":
    case "overdraft_coverage":
      return false;
    case "transfer":
      return tx.toAccountId === accountId;
    default:
      return false;
  }
}

function transactionLabel(
  tx: AccountTransaction,
  accountId: string,
  accounts: Account[],
): string {
  switch (tx.transactionType) {
    case "deposit":
      return "Deposit";
    case "expense":
      return "Expense";
    case "transfer": {
      if (tx.fromAccountId === accountId) {
        const toAcct = accounts.find((a) => a.id === tx.toAccountId);
        return `Transfer to ${toAcct?.name ?? "Unknown"}`;
      }
      const fromAcct = accounts.find((a) => a.id === tx.fromAccountId);
      return `Transfer from ${fromAcct?.name ?? "Unknown"}`;
    }
    case "budget_allocation":
      return "Budget Allocation";
    case "savings_contribution":
      return "Savings Contribution";
    case "overdraft_coverage":
      return "Overdraft Coverage";
    default:
      return tx.transactionType;
  }
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth()).padStart(2, "0");
  return `${y}-${m}`;
}

export function AccountTransactionsDialog({
  open,
  onOpenChange,
  account,
  accounts,
  onDeposit,
  onTransfer,
}: AccountTransactionsDialogProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [allTransactions, setAllTransactions] = useState<AccountTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  // Reload when dialog opens, account changes, or account balance updates
  // (balance update means a deposit/transfer happened)
  useEffect(() => {
    if (open && account) {
      loadTransactions();
    }
  }, [open, account?.id, account?.currentBalance]);

  async function loadTransactions() {
    if (!account) return;
    setLoading(true);
    try {
      const txs = await dataService.getAccountTransactions(account.id);
      setAllTransactions(txs);
    } catch (error) {
      console.error("Failed to load transactions:", error);
    } finally {
      setLoading(false);
    }
  }

  const currentMonthKey = `${year}-${String(month).padStart(2, "0")}`;
  const monthLabel = `${MONTH_NAMES[month]} ${year}`;

  // Split transactions: before this month vs this month
  const { priorTxs, monthTxs } = useMemo(() => {
    if (!account) return { priorTxs: [], monthTxs: [] };

    const prior: AccountTransaction[] = [];
    const current: AccountTransaction[] = [];

    for (const tx of allTransactions) {
      const txKey = getMonthKey(tx.createdAt);
      if (txKey < currentMonthKey) {
        prior.push(tx);
      } else if (txKey === currentMonthKey) {
        current.push(tx);
      }
    }

    // Sort current month newest first for display
    current.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return { priorTxs: prior, monthTxs: current };
  }, [allTransactions, currentMonthKey, account]);

  // Compute opening balance = initialBalance + net of all prior transactions
  const openingBalance = useMemo(() => {
    if (!account) return 0;
    let balance = account.initialBalance;
    for (const tx of priorTxs) {
      if (txIsInflow(tx, account.id)) {
        balance += tx.amount;
      } else {
        balance -= tx.amount;
      }
    }
    return balance;
  }, [account, priorTxs]);

  // Monthly totals
  const { monthIn, monthOut } = useMemo(() => {
    if (!account) return { monthIn: 0, monthOut: 0 };
    let inflow = 0;
    let outflow = 0;
    for (const tx of monthTxs) {
      if (txIsInflow(tx, account.id)) {
        inflow += tx.amount;
      } else {
        outflow += tx.amount;
      }
    }
    return { monthIn: inflow, monthOut: outflow };
  }, [account, monthTxs]);

  const closingBalance = openingBalance + monthIn - monthOut;

  function gotoPrev() {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  }

  function gotoNext() {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  }

  if (!account) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{account.name} Transactions</DialogTitle>
          <DialogDescription>
            View all transactions for {account.name}.
          </DialogDescription>
        </DialogHeader>
        <div className={cn(dialogStyles.paperDialog)}>
          {/* Paper texture overlay */}
          <div className={dialogStyles.paperTexture}></div>

          {/* Yellow transparent tape */}
          <div className={dialogStyles.yellowTape}></div>

          {/* Torn edge effect */}
          <div className={dialogStyles.tornEdge}></div>

          <div className={dialogStyles.contentWrapper}>
            <div className="relative min-h-[520px] p-4">
              {/* Title + Month Navigation */}
              <div className="text-center mb-6 relative z-10">
                <h2 className="text-2xl font-bold text-stone-700 handwriting mb-2">
                  {account.name}
                </h2>
                <div className="flex items-center justify-center gap-3">
                  <Button
                    variant="ghost"
                    onClick={gotoPrev}
                    className="rounded-xl bg-white/80 hover:bg-white border border-amber-200/50 h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-lg font-bold text-stone-700 handwriting min-w-[180px]">
                    {monthLabel}
                  </span>
                  <Button
                    variant="ghost"
                    onClick={gotoNext}
                    className="rounded-xl bg-white/80 hover:bg-white border border-amber-200/50 h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Book binding spine */}
              <div className="absolute left-1/2 top-28 bottom-0 w-2 bg-stone-400/20 transform -translate-x-1/2 shadow-inner rounded-full"></div>

              {/* Two-page layout */}
              <div className="grid grid-cols-2 gap-12 min-h-[380px]">
                {/* Left page - Monthly Summary */}
                <div className="relative bg-gradient-to-br from-amber-50 via-white to-amber-100 rounded-l-lg border-r border-stone-200/50 shadow-inner p-6">
                  <div className="absolute left-4 top-0 bottom-0 flex flex-col justify-evenly">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-stone-300/30"
                      ></div>
                    ))}
                  </div>

                  <div className="ml-6">
                    <h3 className="text-xl font-bold text-amber-700 handwriting mb-4 border-b border-amber-300/50 pb-2">
                      Monthly Summary
                    </h3>

                    {loading ? (
                      <div className="flex justify-center py-16">
                        <RefreshCw className="w-6 h-6 text-amber-500 animate-spin" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Opening / Closing */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-stone-500 handwriting">
                              Opening Balance
                            </p>
                            <p className="text-lg font-bold text-stone-700 handwriting">
                              ${formatNumber(openingBalance)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-stone-500 handwriting">
                              Closing Balance
                            </p>
                            <p
                              className={cn(
                                "text-lg font-bold handwriting",
                                closingBalance >= 0
                                  ? "text-green-700"
                                  : "text-red-600",
                              )}
                            >
                              ${formatNumber(closingBalance)}
                            </p>
                          </div>
                        </div>

                        {/* Inflows / Outflows */}
                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-amber-200/50">
                          <div>
                            <p className="text-xs text-stone-500 handwriting">
                              Money In
                            </p>
                            <p className="text-lg font-bold text-green-600 handwriting">
                              +${formatNumber(monthIn)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-stone-500 handwriting">
                              Money Out
                            </p>
                            <p className="text-lg font-bold text-red-600 handwriting">
                              -${formatNumber(monthOut)}
                            </p>
                          </div>
                        </div>

                        {/* Net change */}
                        <div className="pt-3 border-t border-amber-200/50">
                          <p className="text-xs text-stone-500 handwriting">
                            Net Change
                          </p>
                          <p
                            className={cn(
                              "text-xl font-bold handwriting",
                              monthIn - monthOut >= 0
                                ? "text-green-600"
                                : "text-red-600",
                            )}
                          >
                            {monthIn - monthOut >= 0 ? "+" : ""}$
                            {formatNumber(monthIn - monthOut)}
                          </p>
                        </div>

                        {/* Transactions count */}
                        <div className="pt-3 border-t border-amber-200/50">
                          <p className="text-xs text-stone-500 handwriting">
                            Transactions
                          </p>
                          <p className="text-lg font-bold text-stone-700 handwriting">
                            {monthTxs.length}
                          </p>
                        </div>

                        {/* Quick actions */}
                        <div className="flex gap-2 pt-3 border-t border-amber-200/50">
                          {onDeposit && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs border-amber-300 hover:bg-amber-50"
                              onClick={() => onDeposit(account)}
                            >
                              <ArrowUpRight className="w-3 h-3 mr-1" />
                              Deposit
                            </Button>
                          )}
                          {onTransfer && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs border-amber-300 hover:bg-amber-50"
                              onClick={() => onTransfer(account)}
                            >
                              <ArrowRightLeft className="w-3 h-3 mr-1" />
                              Transfer
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right page - Transactions list */}
                <div className="relative bg-gradient-to-br from-stone-50 via-white to-stone-100 rounded-r-lg shadow-inner p-6">
                  <div className="absolute right-4 top-0 bottom-0 flex flex-col justify-evenly">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-stone-300/30"
                      ></div>
                    ))}
                  </div>

                  <div className="mr-6">
                    <h3 className="text-xl font-bold text-stone-700 handwriting mb-4 border-b border-stone-300/50 pb-2">
                      Transactions
                    </h3>

                    {loading ? (
                      <div className="flex justify-center py-16">
                        <RefreshCw className="w-6 h-6 text-amber-500 animate-spin" />
                      </div>
                    ) : monthTxs.length > 0 ? (
                      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 book-scroll">
                        {monthTxs.map((tx) => {
                          const isInflow = txIsInflow(tx, account.id);
                          const label = transactionLabel(tx, account.id, accounts);
                          return (
                            <div
                              key={tx.id}
                              className="py-1.5 border-b border-stone-200/30 last:border-0"
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="handwriting text-sm leading-tight">
                                    <span
                                      className={cn(
                                        "font-bold",
                                        isInflow
                                          ? "text-green-600"
                                          : "text-red-600",
                                      )}
                                    >
                                      {isInflow ? "+" : "-"}$
                                      {formatNumber(tx.amount)}
                                    </span>
                                    <span className="text-xs text-stone-500 ml-2">
                                      {label}
                                    </span>
                                  </div>
                                  {tx.note && (
                                    <div className="text-xs text-stone-400 handwriting mt-0.5">
                                      {tx.note}
                                    </div>
                                  )}
                                </div>
                                <div className="text-xs text-stone-400 handwriting ml-2 shrink-0">
                                  {new Date(tx.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-16 text-stone-400">
                        <div className="text-3xl mb-2">📝</div>
                        <p className="handwriting">
                          No transactions in {MONTH_NAMES[month]}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-center items-center mt-6 pt-4 border-t border-stone-200/50">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="handwriting text-stone-600 border-stone-300 hover:bg-stone-50 cursor-pointer"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
