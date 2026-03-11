import { Button } from "@/components/ui/button";
import type { Account, BudgetAllocation } from "@/lib/data-service";
import { dataService } from "@/lib/data-service";
import { cn, formatCurrency } from "@/lib/utils";
import { paperTheme } from "@/styles";
import { ArrowRightLeft, Plus, RefreshCw, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { AccountCard } from "./accounts/AccountCard";
import { AccountForm } from "./accounts/AccountForm";
import { DepositDialog } from "./accounts/DepositDialog";
import { TransferDialog } from "./accounts/TransferDialog";

/**
 * Main accounts management page
 * Displays all accounts and provides actions for managing money
 */
export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allAllocations, setAllAllocations] = useState<BudgetAllocation[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>();
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferSourceAccount, setTransferSourceAccount] = useState<
    Account | undefined
  >();
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [depositAccount, setDepositAccount] = useState<Account | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [accts, allocs] = await Promise.all([
        dataService.getAccounts(),
        dataService.getAllBudgetAllocations(),
      ]);
      setAccounts(accts);
      setAllAllocations(allocs);
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
      await dataService.addAccount(account);
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
      await dataService.updateAccount(editingAccount.id, account);
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

  const totalBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0);

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

            <div className="flex gap-2">
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
              <Button
                size="sm"
                onClick={() => {
                  setEditingAccount(undefined);
                  setShowAccountForm(true);
                }}
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                allocations={allAllocations.filter(
                  (a) => a.accountId === account.id,
                )}
                onEdit={(a) => {
                  setEditingAccount(a);
                  setShowAccountForm(true);
                }}
                onDelete={handleDeleteAccount}
                onTransfer={(a) => {
                  setTransferSourceAccount(a);
                  setShowTransferDialog(true);
                }}
                onDeposit={(a) => {
                  setDepositAccount(a);
                  setShowDepositDialog(true);
                }}
                onSetDefault={handleSetDefault}
              />
            ))}
          </div>
        )}

        {/* Dialogs */}
        <AccountForm
          open={showAccountForm}
          onOpenChange={(open) => {
            setShowAccountForm(open);
            if (!open) setEditingAccount(undefined);
          }}
          onSubmit={editingAccount ? handleUpdateAccount : handleCreateAccount}
          editingAccount={editingAccount}
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
      </div>
    </div>
  );
}
