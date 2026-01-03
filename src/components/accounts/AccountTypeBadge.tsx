import type { Account } from "@/lib/data-service";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Building2,
  CreditCard,
  PiggyBank,
  Wallet,
} from "lucide-react";

type AccountType = Account["accountType"];

const typeConfig: Record<
  AccountType,
  { icon: LucideIcon; label: string; color: string }
> = {
  checking: {
    icon: Building2,
    label: "Checking",
    color: "#3b82f6", // blue
  },
  savings: {
    icon: PiggyBank,
    label: "Savings",
    color: "#22c55e", // green
  },
  credit: {
    icon: CreditCard,
    label: "Credit",
    color: "#ef4444", // red
  },
  cash: {
    icon: Banknote,
    label: "Cash",
    color: "#f59e0b", // amber
  },
  other: {
    icon: Wallet,
    label: "Other",
    color: "#6b7280", // gray
  },
};

interface AccountTypeBadgeProps {
  type: AccountType;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Display account type with icon and optional label
 */
export function AccountTypeBadge({
  type,
  showLabel = true,
  size = "sm",
  className,
}: AccountTypeBadgeProps) {
  const config = typeConfig[type] || typeConfig.other;
  const Icon = config.icon;

  const sizeClasses = {
    sm: {
      container: "gap-1",
      icon: "w-3.5 h-3.5",
      text: "text-xs",
    },
    md: {
      container: "gap-1.5",
      icon: "w-4 h-4",
      text: "text-sm",
    },
    lg: {
      container: "gap-2",
      icon: "w-5 h-5",
      text: "text-base",
    },
  };

  const sizes = sizeClasses[size];

  return (
    <span
      className={cn("inline-flex items-center", sizes.container, className)}
    >
      <Icon
        className={cn("flex-shrink-0", sizes.icon)}
        style={{ color: config.color }}
      />
      {showLabel && (
        <span className={cn(sizes.text)} style={{ color: config.color }}>
          {config.label}
        </span>
      )}
    </span>
  );
}

/**
 * Get account type configuration
 */
export function getAccountTypeConfig(type: AccountType) {
  return typeConfig[type] || typeConfig.other;
}

/**
 * List of all account types for select dropdowns
 */
export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "credit", label: "Credit Card" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

export default AccountTypeBadge;
