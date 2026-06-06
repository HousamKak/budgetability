import { Button } from "@/components/ui/button";
import type { Account, AccountGroup } from "@/lib/data-service";
import { dataService } from "@/lib/data-service";
import { cn, formatCurrency } from "@/lib/utils";
import { paperTheme } from "@/styles";
import {
  ArrowRightLeft,
  LayoutGrid,
  Layers,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AccountCard } from "./accounts/AccountCard";
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

/**
 * Main accounts management page
 * Displays all accounts and provides actions for managing money
 */
export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("flat");

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
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [accts, grps] = await Promise.all([
        dataService.getAccounts(),
        dataService.getAccountGroups(),
      ]);
      setAccounts(accts);
      setGroups(grps);
    } catch (error) {
      console.error("Failed to load accounts:", error);
    } finally {
      setLoading(false);
    }
  }

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
  ) => {
    try {
      await dataService.transferBetweenAccounts(fromId, toId, amount, note);
      await loadData();
    } catch (error) {
      console.error("Failed to transfer:", error);
    }
  };

  const handleDeposit = async (
    accountId: string,
    amount: number,
    note?: string,
  ) => {
    try {
      await dataService.depositToAccount(accountId, amount, note);
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

  // Per-account card actions (shared by flat grid and group bands)
  const cardClick = (a: Account) => {
    setTransactionsAccount(a);
    setShowTransactionsDialog(true);
  };
  const editAccount = (a: Account) => {
    setEditingAccount(a);
    setFormGroupIds(a.groupIds ?? []);
    setShowAccountForm(true);
  };
  const transferFrom = (a: Account) => {
    setTransferSourceAccount(a);
    setShowTransferDialog(true);
  };
  const depositTo = (a: Account) => {
    setDepositAccount(a);
    setShowDepositDialog(true);
  };

  const totalBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0);

  // Members of each group (an account can appear in several); and accounts
  // that belong to no group at all.
  const groupedAccounts = groups.map((g) => ({
    group: g,
    members: accounts.filter((a) => a.groupIds?.includes(g.id)),
  }));
  const ungroupedAccounts = accounts.filter((a) => !a.groupIds?.length);
  const summaryMembers = summaryGroup
    ? accounts.filter((a) => a.groupIds?.includes(summaryGroup.id))
    : [];

  return (
    <div className="min-h-screen w-full p-4 md:p-8 bg-[repeating-linear-gradient(0deg,#fbf6e9,#fbf6e9_28px,#f2e8cf_28px,#f2e8cf_29px)]">
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
                  Manage your money across different accounts
                </p>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap items-center">
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
              {viewMode === "grouped" && (
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
              <Button
                size="sm"
                onClick={() => openNewAccount(null)}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                <Plus className="w-4 h-4 mr-1" />
                New Account
              </Button>
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
                <p className="text-sm text-stone-500">Total Balance</p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    paperTheme.fonts.handwriting,
                    totalBalance >= 0 ? "text-green-700" : "text-red-600",
                  )}
                >
                  {formatCurrency(totalBalance)}
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

            {/* Quick transfer button */}
            {accounts.length >= 2 && (
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onClick={cardClick}
                onEdit={editAccount}
                onDelete={handleDeleteAccount}
                onTransfer={transferFrom}
                onDeposit={depositTo}
                onSetDefault={handleSetDefault}
              />
            ))}
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
          onDeposit={(a) => {
            setDepositAccount(a);
            setShowDepositDialog(true);
          }}
          onTransfer={(a) => {
            setTransferSourceAccount(a);
            setShowTransferDialog(true);
          }}
        />
      </div>
    </div>
  );
}
