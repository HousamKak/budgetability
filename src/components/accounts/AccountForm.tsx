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
import { useEffect, useState } from "react";
import {
  ACCOUNT_TYPES,
  AccountTypeBadge,
  getAccountTypeConfig,
} from "./AccountTypeBadge";

interface AccountFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (account: Omit<Account, "id" | "currentBalance">) => void;
  editingAccount?: Account;
}

/**
 * Dialog for creating or editing an account
 */
export function AccountForm({
  open,
  onOpenChange,
  onSubmit,
  editingAccount,
}: AccountFormProps) {
  const [name, setName] = useState("");
  const [accountType, setAccountType] =
    useState<Account["accountType"]>("checking");
  const [initialBalance, setInitialBalance] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const isEditing = !!editingAccount;

  // Reset form when dialog opens/closes or when editing changes
  useEffect(() => {
    if (open) {
      if (editingAccount) {
        setName(editingAccount.name);
        setAccountType(editingAccount.accountType);
        setInitialBalance(editingAccount.initialBalance.toString());
        setIsDefault(editingAccount.isDefault);
      } else {
        setName("");
        setAccountType("checking");
        setInitialBalance("");
        setIsDefault(false);
      }
    }
  }, [open, editingAccount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const balance = parseFloat(initialBalance) || 0;

    onSubmit({
      name: name.trim(),
      accountType,
      initialBalance: balance,
      isDefault,
      sortOrder: 0,
    });

    onOpenChange(false);
  };

  const typeConfig = getAccountTypeConfig(accountType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-md rounded-3xl border-4",
          paperTheme.colors.background.cardGradient,
          paperTheme.colors.borders.paper,
          paperTheme.effects.shadow
        )}
        aria-describedby={undefined}
      >
        {/* Paper texture */}
        <div
          className={cn(
            "absolute inset-0 opacity-15 pointer-events-none rounded-3xl",
            paperTheme.effects.paperTexture
          )}
        />

        <DialogHeader className="relative pb-4">
          <DialogTitle
            className={cn(
              "text-2xl",
              paperTheme.colors.text.accent,
              paperTheme.fonts.handwriting
            )}
          >
            {isEditing ? "Edit Account" : "New Account"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="relative space-y-5 pt-2">
          {/* Account Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className={cn("text-base", paperTheme.fonts.handwriting)}>
              Account Name
            </Label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Main Checking"
              required
              className={cn(
                "w-full px-4 py-3 rounded-xl border-2 text-sm shadow-sm",
                paperTheme.colors.borders.amber,
                paperTheme.colors.background.white,
                "focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:shadow-md transition-shadow"
              )}
            />
          </div>

          {/* Account Type */}
          <div className="space-y-2">
            <Label className={cn("text-base", paperTheme.fonts.handwriting)}>Account Type</Label>
            <Select
              value={accountType}
              onValueChange={(v) => setAccountType(v as Account["accountType"])}
            >
              <SelectTrigger
                className={cn(
                  "w-full rounded-xl border-2 shadow-sm",
                  paperTheme.colors.borders.amber,
                  paperTheme.colors.background.white
                )}
              >
                <SelectValue>
                  <AccountTypeBadge type={accountType} size="md" />
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <AccountTypeBadge type={type.value} size="md" />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Initial Balance */}
          <div className="space-y-2">
            <Label htmlFor="balance" className={cn("text-base", paperTheme.fonts.handwriting)}>
              {isEditing ? "Initial Balance" : "Starting Balance"}
            </Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500">
                $
              </span>
              <input
                id="balance"
                type="number"
                step="0.01"
                min="0"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                placeholder="0.00"
                className={cn(
                  "w-full pl-9 pr-4 py-3 rounded-xl border-2 text-sm shadow-sm",
                  paperTheme.colors.borders.amber,
                  paperTheme.colors.background.white,
                  "focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:shadow-md transition-shadow"
                )}
              />
            </div>
            {isEditing && (
              <p className="text-xs text-stone-500">
                Note: Changing initial balance won't affect current balance
              </p>
            )}
          </div>

          {/* Default Account */}
          <div className="flex items-center gap-2">
            <input
              id="isDefault"
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-4 h-4 rounded-md border-2 border-amber-300 text-amber-500 focus:ring-amber-400 shadow-sm"
            />
            <Label
              htmlFor="isDefault"
              className={cn("text-sm", paperTheme.fonts.handwriting)}
            >
              Set as default account (for overdraft coverage)
            </Label>
          </div>

          {/* Preview card */}
          <div
            className={cn(
              "p-4 rounded-xl border-2 shadow-sm",
              paperTheme.colors.borders.amber,
              "bg-white/50"
            )}
          >
            <p className="text-xs text-stone-500 mb-2">Preview</p>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: typeConfig.color + "20" }}
              >
                {(() => {
                  const Icon = getAccountTypeConfig(accountType).icon;
                  return (
                    <Icon
                      className="w-4 h-4"
                      style={{ color: typeConfig.color }}
                    />
                  );
                })()}
              </div>
              <div>
                <p className={cn("font-medium", paperTheme.fonts.handwriting)}>
                  {name || "Account Name"}
                </p>
                <p className="text-xs text-stone-500">
                  ${parseFloat(initialBalance) || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl border-2 border-amber-900/20 shadow-sm hover:shadow-md transition-all py-5"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className={cn(
                "flex-1 rounded-xl shadow-sm hover:shadow-md transition-all py-5",
                "bg-amber-500 hover:bg-amber-600 text-white"
              )}
              disabled={!name.trim()}
            >
              {isEditing ? "Save Changes" : "Create Account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AccountForm;
