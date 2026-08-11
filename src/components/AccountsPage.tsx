import { Button } from "@/components/ui/button";
import type { Account, AccountGroup } from "@/lib/data-service";
import { dataService } from "@/lib/data-service";
import { toBase } from "@/lib/currency";
import { cn, formatCurrency } from "@/lib/utils";
import { paperTheme } from "@/styles";
import {
  ArrowRightLeft,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { readAccountDrag } from "./accounts/accountDrag";
import { AccountForm } from "./accounts/AccountForm";
import { AccountGroupBand } from "./accounts/AccountGroupBand";
import { AccountRow } from "./accounts/AccountRow";
import { AccountTransactionsDialog } from "./accounts/AccountTransactionsDialog";
import { DepositDialog } from "./accounts/DepositDialog";
import { GroupForm } from "./accounts/GroupForm";
import { GroupSummaryDialog } from "./accounts/GroupSummaryDialog";
import { TransferDialog } from "./accounts/TransferDialog";

type ViewMode = "flat" | "grouped";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const NOW = new Date();
const CURRENT_MONTH_KEY = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, "0")}`;

type MonthActivity = { balance: number; inflow: number; outflow: number };

/**
 * Main accounts management page
 * Displays all accounts and provides actions for managing money
 */
export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("flat");

  // Which month the page is showing. On the current month this is just today's
  // live state; on any earlier month the whole page is rewound to how it looked
  // at that month's end, and becomes read-only.
  const [monthKey, setMonthKey] = useState(CURRENT_MONTH_KEY);
  const [snapshot, setSnapshot] = useState<Record<string, MonthActivity>>({});
  const isCurrentMonth = monthKey === CURRENT_MONTH_KEY;
  const isFutureMonth = monthKey > CURRENT_MONTH_KEY;
  const readOnly = !isCurrentMonth;

  // Dialog states
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>();
  const [formGroupIds, setFormGroupIds] = useState<string[]>([]);

  // Group dialog states
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AccountGroup | undefined>();
  const [showGroupSummary, setShowGroupSummary] = useState(false);
  const [summaryGroup, setSummaryGroup] = useState<AccountGroup | null>(null);
  const [ungroupedOver, setUngroupedOver] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferSourceAccount, setTransferSourceAccount] = useState<
    Account | undefined
  >();
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [depositAccount, setDepositAccount] = useState<Account | null>(null);
  const [showTransactionsDialog, setShowTransactionsDialog] = useState(false);
  const [transactionsAccount, setTransactionsAccount] = useState<Account | null>(null);

  useEffect(() => {
    loadData();
  }, [monthKey]);

  async function loadData() {
    try {
      setLoading(true);
      const [accts, grps, snap] = await Promise.all([
        dataService.getAccounts(),
        dataService.getAccountGroups(),
        dataService.getAccountMonthSnapshot(monthKey),
      ]);
      setAccounts(accts);
      setGroups(grps);
      setSnapshot(snap);
    } catch (error) {
      console.error("Failed to load accounts:", error);
    } finally {
      setLoading(false);
    }
  }

  // Step the month by `delta`, clamped so you can't scroll into the future —
  // there is nothing there to reconstruct.
  const stepMonth = (delta: number) => {
    const [y, m] = monthKey.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (next > CURRENT_MONTH_KEY) return;
    setMonthKey(next);
  };

  const handleCreateAccount = async (
    account: Omit<Account, "id" | "currentBalance">,
  ) => {
    try {
      const { groupIds = [], ...rest } = account;
      const created = await dataService.addAccount(rest);
      if (groupIds.length > 0)
        await dataService.setAccountGroups(created.id, groupIds);
      await loadData();
    } catch (error) {
      console.error("Failed to create account:", error);
    }
  };

  const handleUpdateAccount = async (
    account: Omit<Account, "id" | "currentBalance">,
  ) => {
    if (!editingAccount) return;
    try {
      const { groupIds = [], ...rest } = account;
      await dataService.updateAccount(editingAccount.id, rest);
      await dataService.setAccountGroups(editingAccount.id, groupIds);
      await loadData();
      setEditingAccount(undefined);
    } catch (error) {
      console.error("Failed to update account:", error);
    }
  };

  const handleDeleteAccount = async (account: Account) => {
    if (!confirm(`Delete account "${account.name}"? This cannot be undone.`))
      return;
    try {
      await dataService.removeAccount(account.id);
      await loadData();
    } catch (error) {
      console.error("Failed to delete account:", error);
    }
  };

  const handleSetDefault = async (account: Account) => {
    try {
      await dataService.setDefaultAccount(account.id);
      await loadData();
    } catch (error) {
      console.error("Failed to set default account:", error);
    }
  };

  const handleTransfer = async (
    fromId: string,
    toId: string,
    amount: number,
    note?: string,
    toAmount?: number,
  ) => {
    try {
      await dataService.transferBetweenAccounts(
        fromId,
        toId,
        amount,
        note,
        toAmount,
      );
      await loadData();
    } catch (error) {
      console.error("Failed to transfer:", error);
    }
  };

  const handleDeposit = async (
    accountId: string,
    amount: number,
    note?: string,
    inForecast?: boolean,
  ) => {
    try {
      await dataService.depositToAccount(accountId, amount, note, inForecast);
      await loadData();
    } catch (error) {
      console.error("Failed to deposit:", error);
    }
  };

  const handleCreateGroup = async (
    group: Omit<AccountGroup, "id" | "sortOrder">,
  ) => {
    try {
      await dataService.addAccountGroup({ ...group, sortOrder: groups.length });
      await loadData();
    } catch (error) {
      console.error("Failed to create group:", error);
    }
  };

  const handleUpdateGroup = async (
    group: Omit<AccountGroup, "id" | "sortOrder">,
  ) => {
    if (!editingGroup) return;
    try {
      await dataService.updateAccountGroup(editingGroup.id, group);
      await loadData();
      setEditingGroup(undefined);
    } catch (error) {
      console.error("Failed to update group:", error);
    }
  };

  const handleDeleteGroup = async (group: AccountGroup) => {
    if (
      !confirm(
        `Delete group "${group.name}"? Its accounts will not be deleted — they just become ungrouped.`,
      )
    )
      return;
    try {
      await dataService.removeAccountGroup(group.id);
      await loadData();
    } catch (error) {
      console.error("Failed to delete group:", error);
    }
  };

  const openNewAccount = (groupId: string | null = null) => {
    setEditingAccount(undefined);
    setFormGroupIds(groupId ? [groupId] : []);
    setShowAccountForm(true);
  };

  // Optimistic membership mutation helper: apply `updater` to the account's
  // groupIds locally, persist via `persist`, revert from server on failure.
  const mutateMembership = async (
    accountId: string,
    updater: (groupIds: string[]) => string[],
    persist: () => Promise<void>,
  ) => {
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === accountId
          ? { ...a, groupIds: updater(a.groupIds ?? []) }
          : a,
      ),
    );
    try {
      await persist();
    } catch (error) {
      console.error("Failed to update membership:", error);
      await loadData(); // revert to source of truth
    }
  };

  // Drag an account onto a group band → add it to that group (keep others).
  const addAccountToGroup = (groupId: string, accountId: string) => {
    const acct = accounts.find((a) => a.id === accountId);
    if (acct?.groupIds?.includes(groupId)) return; // already a member
    mutateMembership(
      accountId,
      (ids) => [...ids, groupId],
      () => dataService.addAccountToGroup(accountId, groupId),
    );
  };

  // Remove an account from a single group (keeps its other memberships).
  const removeFromGroup = (groupId: string, accountId: string) => {
    mutateMembership(
      accountId,
      (ids) => ids.filter((g) => g !== groupId),
      () => dataService.removeAccountFromGroup(accountId, groupId),
    );
  };

  // Drop onto the Ungrouped zone → detach from every group.
  const detachFromAllGroups = (accountId: string) => {
    mutateMembership(
      accountId,
      () => [],
      () => dataService.removeAccountFromAllGroups(accountId),
    );
  };

  // Per-account card actions (shared by flat grid and group bands). These
  // always resolve back to the live account — the cards may be showing a
  // rewound copy, but every action acts on the real one.
  const cardClick = (a: Account) => {
    setTransactionsAccount(liveAccount(a));
    setShowTransactionsDialog(true);
  };
  const editAccount = (a: Account) => {
    const live = liveAccount(a);
    setEditingAccount(live);
    setFormGroupIds(live.groupIds ?? []);
    setShowAccountForm(true);
  };
  const transferFrom = (a: Account) => {
    setTransferSourceAccount(liveAccount(a));
    setShowTransferDialog(true);
  };
  const depositTo = (a: Account) => {
    setDepositAccount(liveAccount(a));
    setShowDepositDialog(true);
  };

  // What the cards, rows and group bands render. On the current month this is
  // `accounts` untouched; on an earlier month each balance is swapped for the
  // reconstructed end-of-month figure, so every downstream component — group
  // totals included — rewinds with no changes of its own.
  const viewAccounts = useMemo(
    () =>
      isCurrentMonth
        ? accounts
        : accounts.map((a) => ({
            ...a,
            currentBalance: snapshot[a.id]?.balance ?? a.currentBalance,
          })),
    [accounts, snapshot, isCurrentMonth],
  );

  // Accounts can be denominated differently, so cross-account totals are
  // converted into the base currency (displayed with ≈ when currencies mix).
  const mixedCurrencies =
    new Set(viewAccounts.map((a) => a.currency)).size > 1;
  const totalBalance = viewAccounts.reduce(
    (sum, a) => sum + toBase(a.currentBalance, a.currency),
    0,
  );
  const monthTotals = useMemo(() => {
    const currencyById = new Map(accounts.map((a) => [a.id, a.currency]));
    let inflow = 0;
    let outflow = 0;
    for (const [accountId, s] of Object.entries(snapshot)) {
      const currency = currencyById.get(accountId) ?? "USD";
      inflow += toBase(s.inflow, currency);
      outflow += toBase(s.outflow, currency);
    }
    return { inflow, outflow };
  }, [snapshot, accounts]);

  // Actions still operate on the live account (never the rewound copy), so a
  // deposit opened from a past month would still hit the real balance — hence
  // the money actions are withheld entirely while `readOnly`.
  const liveAccount = (a: Account) => accounts.find((x) => x.id === a.id) ?? a;

  // Members of each group (an account can appear in several); and accounts
  // that belong to no group at all.
  const groupedAccounts = groups.map((g) => ({
    group: g,
    members: viewAccounts.filter((a) => a.groupIds?.includes(g.id)),
  }));
  const ungroupedAccounts = viewAccounts.filter((a) => !a.groupIds?.length);
  const summaryMembers = summaryGroup
    ? viewAccounts.filter((a) => a.groupIds?.includes(summaryGroup.id))
    : [];

  const [monthYear, monthNum] = monthKey.split("-").map(Number);
  const monthLabel = `${MONTH_NAMES[monthNum - 1]} ${monthYear}`;

  return (
    <div className="min-h-screen w-full p-4 md:p-8 max-lg:pb-24 bg-[repeating-linear-gradient(0deg,#fbf6e9,#fbf6e9_28px,#f2e8cf_28px,#f2e8cf_29px)]">
      {/* Background texture */}
      <div
        className={cn(
          "fixed inset-0 opacity-5 pointer-events-none",
          paperTheme.effects.paperTexture,
        )}
      />

      <div className="max-w-6xl mx-auto relative">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-3 rounded-xl",
                  paperTheme.colors.background.white,
                  paperTheme.colors.borders.amber,
                  paperTheme.effects.shadow.md,
                )}
              >
                <Wallet className="w-8 h-8 text-amber-600" />
              </div>
              <div>
                <h1
                  className={cn(
                    "text-3xl font-bold",
                    paperTheme.colors.text.accent,
                    paperTheme.fonts.handwriting,
                  )}
                >
                  Accounts
                </h1>
                <p className="text-stone-500 text-sm">
                  {isCurrentMonth
                    ? "Manage your money across different accounts"
                    : `Balances as they stood at the end of ${monthLabel}`}
                </p>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap items-center">
              {/* Month nav — rewinds the whole page. Can't go past this month. */}
              <div
                className={cn(
                  "flex items-center rounded-xl border-2",
                  readOnly ? "border-stone-300 bg-stone-50" : paperTheme.colors.borders.amber,
                  !readOnly && paperTheme.colors.background.white,
                )}
              >
                <button
                  type="button"
                  onClick={() => stepMonth(-1)}
                  title="Previous month"
                  className="px-2 py-1.5 text-stone-500 hover:text-amber-600 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span
                  className={cn(
                    "px-2 text-sm font-bold whitespace-nowrap",
                    paperTheme.fonts.handwriting,
                    readOnly ? "text-stone-600" : "text-stone-700",
                  )}
                >
                  {monthLabel}
                </span>
                <button
                  type="button"
                  onClick={() => stepMonth(1)}
                  disabled={isCurrentMonth || isFutureMonth}
                  title={isCurrentMonth ? "Already at the current month" : "Next month"}
                  className="px-2 py-1.5 text-stone-500 hover:text-amber-600 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-stone-500"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              {readOnly && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMonthKey(CURRENT_MONTH_KEY)}
                  className={cn(paperTheme.colors.borders.amber)}
                >
                  <CalendarClock className="w-4 h-4 mr-1" />
                  Back to today
                </Button>
              )}

              {/* View toggle: Flat <-> Grouped */}
              <div
                className={cn(
                  "flex items-center rounded-xl border-2 p-0.5",
                  paperTheme.colors.borders.amber,
                  paperTheme.colors.background.white,
                )}
              >
                <button
                  type="button"
                  onClick={() => setViewMode("flat")}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer",
                    viewMode === "flat"
                      ? "bg-amber-500 text-white"
                      : "text-stone-500 hover:bg-amber-50",
                  )}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Flat
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grouped")}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer",
                    viewMode === "grouped"
                      ? "bg-amber-500 text-white"
                      : "text-stone-500 hover:bg-amber-50",
                  )}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Grouped
                </button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={loading}
                className={cn(paperTheme.colors.borders.amber)}
              >
                <RefreshCw
                  className={cn("w-4 h-4 mr-1", loading && "animate-spin")}
                />
                Refresh
              </Button>
              {!readOnly && viewMode === "grouped" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingGroup(undefined);
                    setShowGroupForm(true);
                  }}
                  className={cn(paperTheme.colors.borders.amber)}
                >
                  <Layers className="w-4 h-4 mr-1" />
                  New Group
                </Button>
              )}
              {!readOnly && (
                <Button
                  size="sm"
                  onClick={() => openNewAccount(null)}
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  New Account
                </Button>
              )}
            </div>
          </div>

          {/* Summary card */}
          <div
            className={cn(
              "mt-6 p-4 rounded-xl",
              paperTheme.colors.background.cardGradient,
              paperTheme.colors.borders.paper,
              paperTheme.effects.shadow.md,
              "relative overflow-hidden",
            )}
          >
            <div
              className={cn(
                "absolute inset-0 opacity-15 pointer-events-none",
                paperTheme.effects.paperTexture,
              )}
            />
            <div className="relative flex flex-wrap gap-6">
              <div>
                <p className="text-sm text-stone-500">
                  {isCurrentMonth ? "Total Balance" : `Total · end of ${monthLabel}`}
                </p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    paperTheme.fonts.handwriting,
                    totalBalance >= 0 ? "text-green-700" : "text-red-600",
                  )}
                >
                  {mixedCurrencies ? "≈ " : ""}
                  {formatCurrency(totalBalance)}
                </p>
              </div>
              <div>
                <p className="text-sm text-stone-500">In · {monthLabel}</p>
                <p
                  className={cn(
                    "text-2xl font-bold text-green-700",
                    paperTheme.fonts.handwriting,
                  )}
                >
                  +{mixedCurrencies ? "≈ " : ""}
                  {formatCurrency(monthTotals.inflow)}
                </p>
              </div>
              <div>
                <p className="text-sm text-stone-500">Out · {monthLabel}</p>
                <p
                  className={cn(
                    "text-2xl font-bold text-red-600",
                    paperTheme.fonts.handwriting,
                  )}
                >
                  −{mixedCurrencies ? "≈ " : ""}
                  {formatCurrency(monthTotals.outflow)}
                </p>
              </div>
              <div>
                <p className="text-sm text-stone-500">Accounts</p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    paperTheme.fonts.handwriting,
                    paperTheme.colors.text.accent,
                  )}
                >
                  {accounts.length}
                </p>
              </div>
            </div>

            {readOnly && (
              <p className="relative mt-3 flex items-center gap-1.5 text-xs text-stone-500">
                <Lock className="w-3.5 h-3.5" />
                Viewing a past month — read only. Money actions are hidden so
                nothing lands in the wrong month.
              </p>
            )}

            {/* Quick transfer button */}
            {!readOnly && accounts.length >= 2 && (
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "absolute top-4 right-4",
                  paperTheme.colors.borders.amber,
                )}
                onClick={() => {
                  setTransferSourceAccount(undefined);
                  setShowTransferDialog(true);
                }}
              >
                <ArrowRightLeft className="w-4 h-4 mr-1" />
                Transfer
              </Button>
            )}
          </div>
        </div>

        {/* Accounts grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
        ) : accounts.length === 0 ? (
          <div
            className={cn(
              "text-center py-12 rounded-xl",
              paperTheme.colors.background.cardGradient,
              paperTheme.colors.borders.paper,
              paperTheme.effects.shadow.md,
              "relative overflow-hidden",
            )}
          >
            <div
              className={cn(
                "absolute inset-0 opacity-15 pointer-events-none",
                paperTheme.effects.paperTexture,
              )}
            />
            <div className="relative">
              <Wallet className="w-12 h-12 text-amber-300 mx-auto mb-4" />
              <h3
                className={cn(
                  "text-xl font-bold mb-2",
                  paperTheme.colors.text.accent,
                  paperTheme.fonts.handwriting,
                )}
              >
                No Accounts Yet
              </h3>
              <p className="text-stone-500 mb-4">
                Create your first account to start managing your money
              </p>
              <Button
                onClick={() => {
                  setEditingAccount(undefined);
                  setShowAccountForm(true);
                }}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                <Plus className="w-4 h-4 mr-1" />
                Create Account
              </Button>
            </div>
          </div>
        ) : viewMode === "flat" ? (
          <div className="rounded-xl border border-stone-200/70 bg-white/50 p-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-2">
              {viewAccounts.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  onClick={cardClick}
                  onEdit={editAccount}
                  onDelete={handleDeleteAccount}
                  onTransfer={transferFrom}
                  onDeposit={depositTo}
                  onSetDefault={handleSetDefault}
                  activity={snapshot[account.id]}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Group cards in a responsive 2-column grid */}
            {groups.length === 0 ? (
              <div
                className={cn(
                  "p-6 rounded-2xl border-2 border-dashed text-center",
                  paperTheme.colors.borders.amber,
                )}
              >
                <Layers className="w-8 h-8 text-amber-300 mx-auto mb-2" />
                <p className="text-stone-500 text-sm mb-3">
                  No groups yet. Create a mother account to combine related
                  accounts (e.g. "Global Savings").
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingGroup(undefined);
                    setShowGroupForm(true);
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  New Group
                </Button>
              </div>
            ) : (
              <div className="columns-1 lg:columns-2 gap-3">
                {groupedAccounts.map(({ group, members }) => (
                  <div
                    key={group.id}
                    className="mb-3 break-inside-avoid"
                  >
                  <AccountGroupBand
                    group={group}
                    members={members}
                    onOpenSummary={(g) => {
                      setSummaryGroup(g);
                      setShowGroupSummary(true);
                    }}
                    onEditGroup={(g) => {
                      setEditingGroup(g);
                      setShowGroupForm(true);
                    }}
                    onDeleteGroup={handleDeleteGroup}
                    onAddAccount={(g) => openNewAccount(g.id)}
                    onAccountDrop={addAccountToGroup}
                    onRemoveFromGroup={removeFromGroup}
                    onCardClick={cardClick}
                    onEditAccount={editAccount}
                    onDeleteAccount={handleDeleteAccount}
                    onTransfer={transferFrom}
                    onDeposit={depositTo}
                    onSetDefault={handleSetDefault}
                    activity={snapshot}
                    readOnly={readOnly}
                  />
                  </div>
                ))}
              </div>
            )}

            {/* Ungrouped — compact rows; also a drop zone to detach from groups */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (!ungroupedOver) setUngroupedOver(true);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setUngroupedOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setUngroupedOver(false);
                const id = readAccountDrag(e);
                if (id) detachFromAllGroups(id);
              }}
              className={cn(
                "rounded-xl border bg-white/50 p-2 transition-all",
                ungroupedOver
                  ? "ring-2 ring-amber-400 border-amber-300"
                  : "border-stone-200/70",
              )}
            >
              <div className="flex items-center gap-2 px-1.5 py-1">
                <h2 className="text-xs font-bold uppercase tracking-wide text-stone-400">
                  Ungrouped
                </h2>
                <span className="text-[11px] text-stone-300">
                  {ungroupedAccounts.length}
                </span>
              </div>
              {ungroupedAccounts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-2">
                  {ungroupedAccounts.map((account) => (
                    <AccountRow
                      key={account.id}
                      account={account}
                      onClick={cardClick}
                      onEdit={editAccount}
                      onDelete={handleDeleteAccount}
                      onTransfer={transferFrom}
                      onDeposit={depositTo}
                      onSetDefault={handleSetDefault}
                      activity={snapshot[account.id]}
                      readOnly={readOnly}
                    />
                  ))}
                </div>
              ) : (
                <div
                  className={cn(
                    "py-4 rounded-lg border border-dashed text-center text-xs text-stone-400",
                    ungroupedOver
                      ? "border-amber-400 bg-amber-50/60 text-amber-600"
                      : "border-stone-300/60",
                  )}
                >
                  {ungroupedOver
                    ? "Drop to remove from its groups"
                    : "Every account is in a group — drag one here to detach it"}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dialogs */}
        <AccountForm
          open={showAccountForm}
          onOpenChange={(open) => {
            setShowAccountForm(open);
            if (!open) {
              setEditingAccount(undefined);
              setFormGroupIds([]);
            }
          }}
          onSubmit={editingAccount ? handleUpdateAccount : handleCreateAccount}
          editingAccount={editingAccount}
          groups={groups}
          defaultGroupIds={formGroupIds}
        />

        <GroupForm
          open={showGroupForm}
          onOpenChange={(open) => {
            setShowGroupForm(open);
            if (!open) setEditingGroup(undefined);
          }}
          onSubmit={editingGroup ? handleUpdateGroup : handleCreateGroup}
          editingGroup={editingGroup}
        />

        <GroupSummaryDialog
          open={showGroupSummary}
          onOpenChange={(open) => {
            setShowGroupSummary(open);
            if (!open) setSummaryGroup(null);
          }}
          group={summaryGroup}
          members={summaryMembers}
          accounts={accounts}
        />

        <TransferDialog
          open={showTransferDialog}
          onOpenChange={setShowTransferDialog}
          accounts={accounts}
          sourceAccount={transferSourceAccount}
          onTransfer={handleTransfer}
        />

        <DepositDialog
          open={showDepositDialog}
          onOpenChange={setShowDepositDialog}
          account={depositAccount}
          onDeposit={handleDeposit}
        />

        <AccountTransactionsDialog
          open={showTransactionsDialog}
          onOpenChange={(open) => {
            setShowTransactionsDialog(open);
            if (!open) {
              setTransactionsAccount(null);
              loadData();
            }
          }}
          account={transactionsAccount}
          accounts={accounts}
          initialMonthKey={monthKey}
          // Withheld while a past month is on screen — the dialog would happily
          // move money today from a page that's showing history.
          onDeposit={
            readOnly
              ? undefined
              : (a) => {
                  setDepositAccount(a);
                  setShowDepositDialog(true);
                }
          }
          onTransfer={
            readOnly
              ? undefined
              : (a) => {
                  setTransferSourceAccount(a);
                  setShowTransferDialog(true);
                }
          }
        />
      </div>
    </div>
  );
}
