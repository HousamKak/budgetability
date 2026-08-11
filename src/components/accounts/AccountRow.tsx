import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { MoneyByCurrency } from "@/lib/currency";
import { sumToBase } from "@/lib/currency";
import type { Account } from "@/lib/data-service";
import { cn, formatCurrency } from "@/lib/utils";
import { WalletBalances } from "./WalletBalances";
import {
  ArrowRightLeft,
  ArrowUpRight,
  MoreVertical,
  Pencil,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { CategoryIcon } from "@/components/budget/CategoryIcon";
import { getAccountTypeConfig } from "./AccountTypeBadge";
import { startAccountDrag } from "./accountDrag";

interface AccountRowProps {
  account: Account;
  onClick: (account: Account) => void;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
  onTransfer: (account: Account) => void;
  onDeposit: (account: Account) => void;
  onSetDefault: (account: Account) => void;
  /** Remove from the current group (group context only). */
  onRemove?: () => void;
  removeLabel?: string;
  /** What moved through this account in the month being viewed. */
  activity?: { inflow: MoneyByCurrency; outflow: MoneyByCurrency };
  /** Historical balances when viewing a past month (else live). */
  balances?: MoneyByCurrency;
  /**
   * Viewing a past month: the balance shown is historical, so every action
   * that would move money or change the account is withheld.
   */
  readOnly?: boolean;
}

/**
 * One account as a dense, draggable single-line row with always-visible
 * Deposit / Transfer actions. Click opens details; ⋮ holds the rest; in a
 * group context, × detaches it from that group.
 */
export function AccountRow({
  account,
  onClick,
  onEdit,
  onDelete,
  onTransfer,
  onDeposit,
  onSetDefault,
  onRemove,
  removeLabel = "Remove from group",
  activity,
  balances,
  readOnly = false,
}: AccountRowProps) {
  const typeColor = getAccountTypeConfig(account.accountType).color;
  const icon = account.icon || "wallet";
  // Month activity summarized in base — the row is too dense for per-currency
  // in/out; the transactions dialog has the full native story.
  const inflowBase = activity ? sumToBase(activity.inflow) : 0;
  const outflowBase = activity ? sumToBase(activity.outflow) : 0;
  const hasActivity = inflowBase > 0 || outflowBase > 0;

  return (
    <div
      draggable={!readOnly}
      onDragStart={(e) => startAccountDrag(e, account.id)}
      onClick={() => onClick(account)}
      title={
        readOnly
          ? "Click to view transactions"
          : "Drag onto a group to add · click to view"
      }
      className="group/row relative flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/70 cursor-pointer transition-colors"
    >
      {/* Type icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: typeColor + "22" }}
      >
        <CategoryIcon
          name={icon}
          className="w-4 h-4"
          style={{ color: typeColor }}
        />
      </div>

      {/* Name + balance (stacked, tight) */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium text-stone-700 truncate">
            {account.name}
          </span>
          {account.isDefault && (
            <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
          )}
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <WalletBalances
            account={account}
            balances={balances}
            inline
            amountClassName="text-sm leading-tight"
          />
          {hasActivity && (
            <span className="text-[11px] tabular-nums text-stone-400">
              {inflowBase > 0 && (
                <span className="text-green-600">
                  +{formatCurrency(inflowBase)}
                </span>
              )}
              {inflowBase > 0 && outflowBase > 0 && " · "}
              {outflowBase > 0 && (
                <span className="text-red-500">
                  −{formatCurrency(outflowBase)}
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Always-visible actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        {!readOnly && (
          <>
            <IconButton
              title="Deposit"
              onClick={() => onDeposit(account)}
              className="text-emerald-600 hover:bg-emerald-50"
            >
              <ArrowUpRight className="w-4 h-4" />
            </IconButton>
            <IconButton
              title="Transfer"
              onClick={() => onTransfer(account)}
              className="text-sky-600 hover:bg-sky-50"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </IconButton>
          </>
        )}

        {!readOnly && (
        <HoverCard openDelay={0} closeDelay={80}>
          <HoverCardTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="w-7 h-7 rounded-md flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </HoverCardTrigger>
          <HoverCardContent align="end" className="w-40 p-1">
            <div
              className="flex flex-col gap-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <MenuItem
                icon={Pencil}
                label="Edit"
                onClick={() => onEdit(account)}
              />
              {!account.isDefault && (
                <MenuItem
                  icon={Star}
                  label="Set Default"
                  onClick={() => onSetDefault(account)}
                />
              )}
              {onRemove && (
                <MenuItem
                  icon={X}
                  label={removeLabel}
                  onClick={onRemove}
                />
              )}
              <MenuItem
                icon={Trash2}
                label="Delete"
                danger
                onClick={() => onDelete(account)}
              />
            </div>
          </HoverCardContent>
        </HoverCard>
        )}

        {/* Quick detach (group context) */}
        {!readOnly && onRemove && (
          <IconButton
            title={removeLabel}
            onClick={onRemove}
            className="text-stone-300 hover:text-red-600 hover:bg-red-50 invisible group-hover/row:visible"
          >
            <X className="w-3.5 h-3.5" />
          </IconButton>
        )}
      </div>
    </div>
  );
}

function IconButton({
  title,
  onClick,
  className,
  children,
}: {
  title: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "w-7 h-7 rounded-md flex items-center justify-center text-stone-400 cursor-pointer transition-colors",
        className,
      )}
    >
      {children}
    </button>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "justify-start h-8 text-xs",
        danger && "text-red-600 hover:text-red-700 hover:bg-red-50",
      )}
      onClick={onClick}
    >
      <Icon className="w-3 h-3 mr-2" />
      {label}
    </Button>
  );
}

export default AccountRow;
