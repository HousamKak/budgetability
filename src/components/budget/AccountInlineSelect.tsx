import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Account } from "@/lib/data-service";
import { cn } from "@/lib/utils";
import { getAccountTypeConfig } from "@/components/accounts/AccountTypeBadge";
import { CategoryIcon } from "./CategoryIcon";

const DEFAULT_ICON_BY_TYPE = {
  checking: "building-2",
  savings: "piggy-bank",
  credit: "credit-card",
  cash: "banknote",
  other: "wallet",
} as const;

export function renderAccountLabel(
  accounts: Account[],
  id: string | undefined,
  opts?: { iconClassName?: string },
) {
  if (!id) return null;
  const acc = accounts.find((a) => a.id === id);
  if (!acc) return null;
  const typeConfig = getAccountTypeConfig(acc.accountType);
  const iconName = acc.icon || DEFAULT_ICON_BY_TYPE[acc.accountType];
  return (
    <span className="inline-flex items-center gap-1">
      <CategoryIcon
        name={iconName}
        className={cn("shrink-0", opts?.iconClassName || "w-3.5 h-3.5")}
        style={{ color: typeConfig.color }}
      />
      <span>{acc.name}</span>
    </span>
  );
}

interface AccountInlineSelectProps {
  accounts: Account[];
  value: string;
  onChange: (accountId: string) => void;
  triggerClassName?: string;
}

export function AccountInlineSelect({
  accounts,
  value,
  onChange,
  triggerClassName,
}: AccountInlineSelectProps) {
  if (accounts.length === 0) return null;
  return (
    <Select
      value={value || "__none__"}
      onValueChange={(v) => onChange(v === "__none__" ? "" : v)}
    >
      <SelectTrigger className={cn("h-7 text-sm", triggerClassName)}>
        <SelectValue>
          {value ? renderAccountLabel(accounts, value) : "No account"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">No account</SelectItem>
        {accounts
          .slice()
          .sort((a, b) => (a.isDefault ? -1 : b.isDefault ? 1 : 0))
          .map((acc) => (
            <SelectItem key={acc.id} value={acc.id}>
              {renderAccountLabel(accounts, acc.id)}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
