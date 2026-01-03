import { Button } from "@/components/ui/button";
import type {
  Account,
  AccountTransaction,
  BudgetAllocation,
} from "@/lib/data-service";
import { cn, formatCurrency } from "@/lib/utils";
import { paperTheme } from "@/styles";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  PiggyBank,
  ArrowRightLeft,
} from "lucide-react";
import { useState } from "react";
import { AccountTypeBadge } from "../accounts/AccountTypeBadge";

interface AccountBudgetCardProps {
  account: Account;
  allocation: BudgetAllocation;
  transactions: AccountTransaction[];
  totalBudget: number;
  onAdjustAllocation?: (accountId: string, currentAmount: number) => void;
  onRemoveFromBudget?: (accountId: string) => void;
}

/**
 * Expandable card showing account contribution to monthly budget
 * Collapsed: Account name, type, allocation amount, % of budget
 * Expanded: Full details including transactions, balance, actions
 */
export function AccountBudgetCard({
  account,
  allocation,
  transactions,
  totalBudget,
  onAdjustAllocation,
  onRemoveFromBudget,
}: AccountBudgetCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  // Calculate percentage of total budget this account contributes
  const percentage =
    totalBudget > 0 ? Math.round((allocation.amount / totalBudget) * 100) : 0;

  // Get transaction icon and styling based on type
  const getTransactionDetails = (tx: AccountTransaction) => {
    const isOutgoing = tx.fromAccountId === account.id;
    const typeLabels: Record<string, string> = {
      deposit: "Deposit",
      transfer: "Transfer",
      budget_allocation: "Budget Allocation",
      savings_contribution: "Savings",
      overdraft_coverage: "Overdraft",
    };

    const icons: Record<string, React.ReactNode> = {
      deposit: <ArrowDownLeft className="w-3 h-3 text-green-600" />,
      transfer: <ArrowRightLeft className="w-3 h-3 text-blue-600" />,
      budget_allocation: <PiggyBank className="w-3 h-3 text-amber-600" />,
      savings_contribution: <PiggyBank className="w-3 h-3 text-purple-600" />,
      overdraft_coverage: <ArrowUpRight className="w-3 h-3 text-red-600" />,
    };

    return {
      label: typeLabels[tx.transactionType] || tx.transactionType,
      icon: icons[tx.transactionType] || <ArrowRightLeft className="w-3 h-3" />,
      isOutgoing,
    };
  };

  // Get recent transactions (up to 5)
  const recentTransactions = transactions.slice(0, 5);

  return (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden transition-all duration-200",
        paperTheme.colors.background.white,
        paperTheme.colors.borders.amber,
        isExpanded ? paperTheme.effects.shadow.md : paperTheme.effects.shadow.sm
      )}
    >
      {/* Collapsed Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full p-3 flex items-center justify-between cursor-pointer",
          "hover:bg-amber-50/50 transition-colors duration-150"
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
                paperTheme.fonts.handwriting,
                paperTheme.colors.text.primary
              )}
            >
              {account.name}
            </p>
            <p className="text-xs text-stone-500">
              {formatCurrency(allocation.amount)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Percentage badge */}
          <div
            className={cn(
              "px-2 py-0.5 rounded-full text-xs font-medium",
              "bg-amber-100 text-amber-700"
            )}
          >
            {percentage}%
          </div>

          {/* Expand/Collapse indicator */}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-stone-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-stone-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-amber-100">
          {/* Allocation Details */}
          <div className="py-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-stone-500">Allocated Amount</span>
              <span
                className={cn(
                  "text-sm font-semibold",
                  paperTheme.fonts.handwriting,
                  "text-amber-700"
                )}
              >
                {formatCurrency(allocation.amount)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-stone-500">Account Balance</span>
              <span
                className={cn(
                  "text-sm font-semibold",
                  paperTheme.fonts.handwriting,
                  account.currentBalance >= 0 ? "text-green-600" : "text-red-600"
                )}
              >
                {formatCurrency(account.currentBalance)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-stone-500">% of Total Budget</span>
              <span className="text-sm font-medium text-stone-700">
                {percentage}%
              </span>
            </div>
          </div>

          {/* Recent Transactions */}
          {recentTransactions.length > 0 && (
            <div className="border-t border-amber-100 pt-3">
              <p className="text-xs font-medium text-stone-500 mb-2">
                Recent Transactions
              </p>
              <div className="space-y-1.5">
                {recentTransactions.map((tx) => {
                  const details = getTransactionDetails(tx);
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between text-xs py-1 px-2 rounded bg-stone-50"
                    >
                      <div className="flex items-center gap-2">
                        {details.icon}
                        <span className="text-stone-600">{details.label}</span>
                        {tx.note && (
                          <span className="text-stone-400 truncate max-w-[100px]">
                            - {tx.note}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "font-medium",
                            details.isOutgoing ? "text-red-600" : "text-green-600"
                          )}
                        >
                          {details.isOutgoing ? "-" : "+"}
                          {formatCurrency(tx.amount)}
                        </span>
                        <span className="text-stone-400">
                          {formatDate(tx.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-3 border-t border-amber-100 mt-3">
            {onAdjustAllocation && (
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "flex-1 h-8 text-xs",
                  paperTheme.colors.borders.amber,
                  "hover:bg-amber-50"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onAdjustAllocation(account.id, allocation.amount);
                }}
              >
                <Pencil className="w-3 h-3 mr-1" />
                Adjust Amount
              </Button>
            )}
            {onRemoveFromBudget && (
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "flex-1 h-8 text-xs",
                  "border-red-200 hover:bg-red-50 text-red-600 hover:text-red-700"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFromBudget(account.id);
                }}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Remove
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AccountBudgetCard;
