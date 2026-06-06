import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { Account } from "@/lib/data-service";
import { cn, formatCurrency } from "@/lib/utils";
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
}

/**
 * One account rendered as a dense, draggable single-line row.
 * Click opens details; hover reveals a quick ⋮ menu and (in a group) a × to
 * detach from that group.
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
}: AccountRowProps) {
  const typeColor = getAccountTypeConfig(account.accountType).color;
  const icon = account.icon || "wallet";

  return (
    <div
      draggable
      onDragStart={(e) => startAccountDrag(e, account.id)}
      onClick={() => onClick(account)}
      title="Drag onto a group to add · click to view"
      className="group/row relative flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/70 cursor-pointer transition-colors"
    >
      {/* Type icon */}
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: typeColor + "22" }}
      >
        <CategoryIcon
          name={icon}
          className="w-4 h-4"
          style={{ color: typeColor }}
        />
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0 flex items-center gap-1">
        <span className="text-sm font-medium text-stone-700 truncate">
          {account.name}
        </span>
        {account.isDefault && (
          <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
        )}
      </div>

      {/* Balance */}
      <span
        className={cn(
          "text-sm font-bold tabular-nums shrink-0",
          account.currentBalance >= 0 ? "text-green-700" : "text-red-600",
        )}
      >
        {formatCurrency(account.currentBalance)}
      </span>

      {/* Hover actions (reserve space so layout stays stable) */}
      <div className="flex items-center shrink-0 invisible group-hover/row:visible">
        {onRemove && (
          <button
            type="button"
            title={removeLabel}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="w-6 h-6 rounded-md flex items-center justify-center text-stone-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <HoverCard openDelay={0} closeDelay={80}>
          <HoverCardTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="w-6 h-6 rounded-md flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </HoverCardTrigger>
          <HoverCardContent align="end" className="w-40 p-1">
            <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
              <MenuItem icon={ArrowUpRight} label="Deposit" onClick={() => onDeposit(account)} />
              <MenuItem icon={ArrowRightLeft} label="Transfer" onClick={() => onTransfer(account)} />
              <MenuItem icon={Pencil} label="Edit" onClick={() => onEdit(account)} />
              {!account.isDefault && (
                <MenuItem icon={Star} label="Set Default" onClick={() => onSetDefault(account)} />
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
      </div>
    </div>
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
