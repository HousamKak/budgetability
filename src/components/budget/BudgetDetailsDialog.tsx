import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Account } from "@/lib/data-service";
import { formatNumber } from "@/lib/utils";
import { cn, dialogStyles } from "@/styles";

interface BudgetDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthLabel: string;
  budget: number;
  totalSpent: number;
  totalPlanned: number;
  accounts: Account[];
  spendingByAccount: Map<string, number>;
}

export function BudgetDetailsDialog({
  open,
  onOpenChange,
  monthLabel,
  budget,
  totalSpent,
  totalPlanned,
  accounts,
  spendingByAccount,
}: BudgetDetailsDialogProps) {
  const leftNow = Math.max(0, budget - totalSpent);
  const leftAfterPlanned = budget - totalSpent - totalPlanned;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{monthLabel} Budget Details</DialogTitle>
          <DialogDescription>
            Budget and account details for {monthLabel}.
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
            <div className="relative min-h-[480px] p-4">
              {/* Title */}
              <div className="text-center mb-6 relative z-10">
                <h2 className="text-2xl font-bold text-stone-700 handwriting mb-1">
                  {monthLabel}
                </h2>
                <p className="text-sm text-stone-500 handwriting">
                  Budget & Account Overview
                </p>
              </div>

              {/* Book binding spine */}
              <div className="absolute left-1/2 top-24 bottom-0 w-2 bg-stone-400/20 transform -translate-x-1/2 shadow-inner rounded-full"></div>

              {/* Two-page layout */}
              <div className="grid grid-cols-2 gap-12 min-h-[360px]">
                {/* Left page - Budget Breakdown */}
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
                      Budget Breakdown
                    </h3>

                    <div className="space-y-4">
                      {/* Budget */}
                      <div>
                        <p className="text-xs text-stone-500 handwriting">
                          Monthly Budget
                        </p>
                        <p className="text-2xl font-bold text-stone-800 handwriting">
                          ${formatNumber(budget)}
                        </p>
                      </div>

                      {/* Spent & Planned */}
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-amber-200/50">
                        <div>
                          <p className="text-xs text-stone-500 handwriting">
                            Spent
                          </p>
                          <p className="text-lg font-bold text-red-600 handwriting">
                            ${formatNumber(totalSpent)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-stone-500 handwriting">
                            Planned
                          </p>
                          <p className="text-lg font-bold text-blue-600 handwriting">
                            ${formatNumber(totalPlanned)}
                          </p>
                        </div>
                      </div>

                      {/* Remaining */}
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-amber-200/50">
                        <div>
                          <p className="text-xs text-stone-500 handwriting">
                            Left Now
                          </p>
                          <p
                            className={cn(
                              "text-lg font-bold handwriting",
                              leftNow > 0 ? "text-emerald-600" : "text-red-600",
                            )}
                          >
                            ${formatNumber(leftNow)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-stone-500 handwriting">
                            Left After Plans
                          </p>
                          <p
                            className={cn(
                              "text-lg font-bold handwriting",
                              leftAfterPlanned >= 0
                                ? "text-emerald-600"
                                : "text-red-600",
                            )}
                          >
                            ${formatNumber(leftAfterPlanned)}
                          </p>
                        </div>
                      </div>

                      {/* Spending by account */}
                      {spendingByAccount.size > 0 && (
                        <div className="pt-3 border-t border-amber-200/50">
                          <p className="text-xs text-stone-500 handwriting mb-2">
                            Spending by Account
                          </p>
                          <div className="space-y-1.5">
                            {Array.from(spendingByAccount.entries()).map(
                              ([acctId, spent]) => {
                                const acct = accounts.find(
                                  (a) => a.id === acctId,
                                );
                                if (!acct) return null;
                                const pct =
                                  totalSpent > 0
                                    ? Math.round((spent / totalSpent) * 100)
                                    : 0;
                                return (
                                  <div
                                    key={acctId}
                                    className="flex items-center gap-2"
                                  >
                                    <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                    <span className="text-sm text-stone-600 handwriting truncate flex-1">
                                      {acct.name}
                                    </span>
                                    <span className="text-sm font-bold text-red-600 handwriting">
                                      ${formatNumber(spent)}
                                    </span>
                                    <span className="text-xs text-stone-400 handwriting">
                                      ({pct}%)
                                    </span>
                                  </div>
                                );
                              },
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right page - Account Balances */}
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
                      Account Balances
                    </h3>

                    {accounts.length > 0 ? (
                      <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2 book-scroll">
                        {accounts.map((acct) => {
                          const spent = spendingByAccount.get(acct.id) || 0;
                          return (
                            <div
                              key={acct.id}
                              className="py-2 border-b border-stone-200/30 last:border-0"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="handwriting text-sm font-bold text-stone-700">
                                    {acct.name}
                                    {acct.isDefault && (
                                      <span className="text-amber-500 ml-1 text-xs">
                                        ★
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-stone-400 handwriting capitalize">
                                    {acct.accountType}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p
                                    className={cn(
                                      "text-lg font-bold handwriting",
                                      acct.currentBalance >= 0
                                        ? "text-green-700"
                                        : "text-red-600",
                                    )}
                                  >
                                    ${formatNumber(acct.currentBalance)}
                                  </p>
                                  {spent > 0 && (
                                    <p className="text-xs text-red-500 handwriting">
                                      -{formatNumber(spent)} this month
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Total */}
                        <div className="pt-2 mt-1">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-stone-600 handwriting">
                              Total
                            </span>
                            <span
                              className={cn(
                                "text-xl font-bold handwriting",
                                accounts.reduce(
                                  (sum, a) => sum + a.currentBalance,
                                  0,
                                ) >= 0
                                  ? "text-green-700"
                                  : "text-red-600",
                              )}
                            >
                              $
                              {formatNumber(
                                accounts.reduce(
                                  (sum, a) => sum + a.currentBalance,
                                  0,
                                ),
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-16 text-stone-400">
                        <div className="text-3xl mb-2">📝</div>
                        <p className="handwriting">No accounts yet</p>
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
