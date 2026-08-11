import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  Account,
  AccountGroup,
  AccountTransaction,
} from "@/lib/data-service";
import { dataService } from "@/lib/data-service";
import { cn, formatCurrency } from "@/lib/utils";
import { dialogStyles } from "@/styles";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CategoryIcon } from "@/components/budget/CategoryIcon";
import {
  groupTotal,
  signedBalance,
  signedBalanceBase,
  singleCurrency,
} from "./accountMath";

interface GroupSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: AccountGroup | null;
  members: Account[];
  accounts: Account[];
}

type MergedTx = AccountTransaction & {
  // direction relative to the whole group
  groupDirection: "in" | "out" | "internal";
};

function classifyForGroup(
  tx: AccountTransaction,
  memberIds: Set<string>,
): MergedTx["groupDirection"] {
  const fromMember = !!tx.fromAccountId && memberIds.has(tx.fromAccountId);
  const toMember = !!tx.toAccountId && memberIds.has(tx.toAccountId);
  // Money moving between two members of the same group nets to zero.
  if (fromMember && toMember) return "internal";
  if (toMember) return "in";
  if (fromMember) return "out";
  return "internal";
}

function txLabelForGroup(
  tx: AccountTransaction,
  accounts: Account[],
): string {
  const from = accounts.find((a) => a.id === tx.fromAccountId);
  const to = accounts.find((a) => a.id === tx.toAccountId);
  switch (tx.transactionType) {
    case "deposit":
      return `Deposit → ${to?.name ?? "Unknown"}`;
    case "expense":
      return to ? `Refund → ${to.name}` : `Expense ← ${from?.name ?? ""}`;
    case "transfer":
      return `Transfer ${from?.name ?? "?"} → ${to?.name ?? "?"}`;
    case "budget_allocation":
      return to ? "Allocation Refund" : "Budget Allocation";
    case "savings_contribution":
      return to ? "Savings Refund" : "Savings Contribution";
    case "overdraft_coverage":
      return "Overdraft Coverage";
    default:
      return tx.transactionType;
  }
}

/**
 * Combined status for a mother account: total balance, per-member breakdown,
 * and a merged transaction feed across all member accounts.
 */
export function GroupSummaryDialog({
  open,
  onOpenChange,
  group,
  members,
  accounts,
}: GroupSummaryDialogProps) {
  const [txs, setTxs] = useState<MergedTx[]>([]);
  const [loading, setLoading] = useState(false);

  const memberIds = useMemo(
    () => new Set(members.map((m) => m.id)),
    [members],
  );

  useEffect(() => {
    if (open && group) {
      loadTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group?.id, members.map((m) => m.id).join(",")]);

  async function loadTransactions() {
    setLoading(true);
    try {
      const perMember = await Promise.all(
        members.map((m) => dataService.getAccountTransactions(m.id)),
      );
      // Merge + dedupe by id (a transfer between two members appears twice)
      const byId = new Map<string, AccountTransaction>();
      for (const list of perMember) {
        for (const tx of list) byId.set(tx.id, tx);
      }
      const merged: MergedTx[] = Array.from(byId.values())
        .map((tx) => ({
          ...tx,
          groupDirection: classifyForGroup(tx, memberIds),
        }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setTxs(merged);
    } catch (error) {
      console.error("Failed to load group transactions:", error);
    } finally {
      setLoading(false);
    }
  }

  // Mixed-currency groups total in base (marked ≈); single-currency groups
  // stay native and exact.
  const sameCurrency = singleCurrency(members);
  const combined = sameCurrency
    ? members.reduce((sum, m) => sum + signedBalance(m), 0)
    : groupTotal(members);
  const maxAbs = Math.max(
    1,
    ...members.map((m) => Math.abs(signedBalanceBase(m))),
  );
  const accent = group?.color || "#f59e0b";

  if (!group) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{group.name} — Combined Status</DialogTitle>
          <DialogDescription>
            Combined balance and transactions across {group.name}.
          </DialogDescription>
        </DialogHeader>
        <div className={cn(dialogStyles.paperDialog)}>
          <div className={dialogStyles.paperTexture}></div>
          <div className={dialogStyles.yellowTape}></div>
          <div className={dialogStyles.tornEdge}></div>

          <div className={dialogStyles.contentWrapper}>
            <div className="relative p-4 min-h-[480px]">
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: accent + "22" }}
                >
                  <CategoryIcon
                    name={group.icon || "layers"}
                    className="w-7 h-7"
                    style={{ color: accent }}
                  />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-stone-700 handwriting leading-tight">
                    {group.name}
                  </h2>
                  <p className="text-xs text-stone-500">
                    Combined across {members.length}{" "}
                    {members.length === 1 ? "account" : "accounts"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-stone-500 handwriting">
                    Total Balance
                  </p>
                  <p
                    className={cn(
                      "text-3xl font-bold handwriting",
                      combined >= 0 ? "text-green-700" : "text-red-600",
                    )}
                  >
                    {sameCurrency
                      ? formatCurrency(combined, sameCurrency)
                      : `≈ ${formatCurrency(combined)}`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Per-member breakdown */}
                <div>
                  <h3 className="text-lg font-bold text-amber-700 handwriting mb-3 border-b border-amber-300/50 pb-2">
                    Accounts
                  </h3>
                  {members.length === 0 ? (
                    <p className="text-sm text-stone-400 py-6 text-center handwriting">
                      No accounts in this group yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {members.map((m) => {
                        const signed = signedBalance(m);
                        const isLiability = m.accountType === "credit";
                        const pct =
                          (Math.abs(signedBalanceBase(m)) / maxAbs) * 100;
                        return (
                          <div key={m.id} className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {m.icon && (
                                  <CategoryIcon
                                    name={m.icon}
                                    className="w-4 h-4 text-stone-500 shrink-0"
                                  />
                                )}
                                <span className="text-sm text-stone-700 handwriting truncate">
                                  {m.name}
                                </span>
                                {isLiability && (
                                  <span className="text-[10px] text-red-500 px-1.5 py-0.5 rounded bg-red-50 shrink-0">
                                    liability
                                  </span>
                                )}
                              </div>
                              <span
                                className={cn(
                                  "text-sm font-bold handwriting shrink-0",
                                  signed >= 0
                                    ? "text-green-700"
                                    : "text-red-600",
                                )}
                              >
                                {signed < 0 ? "-" : ""}
                                {formatCurrency(Math.abs(signed), m.currency)}
                              </span>
                            </div>
                            {/* Contribution bar (magnitude) */}
                            <div className="h-1.5 rounded-full bg-stone-200/60 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.max(0, Math.min(100, pct))}%`,
                                  backgroundColor: isLiability
                                    ? "#ef4444"
                                    : accent,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Merged transaction feed */}
                <div>
                  <h3 className="text-lg font-bold text-stone-700 handwriting mb-3 border-b border-stone-300/50 pb-2">
                    Recent Activity
                  </h3>
                  {loading ? (
                    <div className="flex justify-center py-12">
                      <RefreshCw className="w-6 h-6 text-amber-500 animate-spin" />
                    </div>
                  ) : txs.length === 0 ? (
                    <div className="text-center py-12 text-stone-400">
                      <div className="text-3xl mb-2">📝</div>
                      <p className="handwriting">No activity yet</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-2 book-scroll">
                      {txs.slice(0, 60).map((tx) => {
                        const internal = tx.groupDirection === "internal";
                        const isIn = tx.groupDirection === "in";
                        // Show the member-side amount in its own currency:
                        // inbound movements credit toAmount on cross-currency
                        // transfers, outbound ones debit the source amount.
                        const sideAccount = accounts.find(
                          (a) =>
                            a.id === (isIn ? tx.toAccountId : tx.fromAccountId),
                        );
                        const sideAmount = isIn
                          ? (tx.toAmount ?? tx.amount)
                          : tx.amount;
                        return (
                          <div
                            key={tx.id}
                            className="py-1.5 border-b border-stone-200/30 last:border-0"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="handwriting text-sm leading-tight">
                                  <span
                                    className={cn(
                                      "font-bold",
                                      internal
                                        ? "text-stone-400"
                                        : isIn
                                          ? "text-green-600"
                                          : "text-red-600",
                                    )}
                                  >
                                    {internal ? "" : isIn ? "+" : "-"}
                                    {formatCurrency(
                                      sideAmount,
                                      sideAccount?.currency,
                                    )}
                                  </span>
                                  <span className="text-xs text-stone-500 ml-2">
                                    {txLabelForGroup(tx, accounts)}
                                  </span>
                                  {internal && (
                                    <span className="text-[10px] text-stone-400 ml-1.5 px-1.5 py-0.5 rounded bg-stone-200/60 align-middle">
                                      internal
                                    </span>
                                  )}
                                </div>
                                {tx.note && (
                                  <div className="text-xs text-stone-400 handwriting mt-0.5">
                                    {tx.note}
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-stone-400 handwriting shrink-0">
                                {new Date(tx.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-center items-center mt-4 pt-4 border-t border-stone-200/50">
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

export default GroupSummaryDialog;
