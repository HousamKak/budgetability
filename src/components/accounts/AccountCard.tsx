import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { Account } from "@/lib/data-service";
import { cn, formatCurrency } from "@/lib/utils";
import { paperTheme } from "@/styles";
import {
  ArrowRightLeft,
  ArrowUpRight,
  MoreVertical,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import { AccountTypeBadge, getAccountTypeConfig } from "./AccountTypeBadge";
import { CategoryIcon } from "@/components/budget/CategoryIcon";

interface AccountCardProps {
  account: Account;
  onClick?: (account: Account) => void;
  onEdit?: (account: Account) => void;
  onDelete?: (account: Account) => void;
  onTransfer?: (account: Account) => void;
  onDeposit?: (account: Account) => void;
  onSetDefault?: (account: Account) => void;
}

/**
 * Display a single account with balance - click to view transactions
 */
export function AccountCard({
  account,
  onClick,
  onEdit,
  onDelete,
  onTransfer,
  onDeposit,
  onSetDefault,
}: AccountCardProps) {
  return (
    <div
      onClick={() => onClick?.(account)}
      className={cn(
        "relative p-4 rounded-xl",
        paperTheme.colors.background.cardGradient,
        paperTheme.colors.borders.paper,
        paperTheme.effects.shadow.md,
        "overflow-hidden transition-transform duration-200 hover:scale-[1.02]",
        onClick && "cursor-pointer",
      )}
    >
      {/* Paper texture overlay */}
      <div
        className={cn(
          "absolute inset-0 opacity-15 pointer-events-none rounded-xl",
          paperTheme.effects.paperTexture,
        )}
      />

      {/* Yellow tape at top */}
      <div
        className={cn(
          "absolute -top-1 left-4 w-12 h-4",
          paperTheme.effects.yellowTape,
        )}
      />

      {/* Default star indicator */}
      {account.isDefault && (
        <div className="absolute top-2 right-10">
          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 pt-2">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {account.icon ? (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: getAccountTypeConfig(account.accountType).color + "20" }}
              >
                <CategoryIcon
                  name={account.icon}
                  className="w-4 h-4"
                  style={{ color: getAccountTypeConfig(account.accountType).color }}
                />
              </div>
            ) : null}
            <div>
              <h3
                className={cn(
                  "text-lg font-bold",
                  paperTheme.colors.text.accent,
                  paperTheme.fonts.handwriting,
                )}
              >
                {account.name}
              </h3>
              <AccountTypeBadge type={account.accountType} size="sm" />
            </div>
          </div>

          {/* Actions menu */}
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-amber-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4 text-stone-500" />
              </Button>
            </HoverCardTrigger>
            <HoverCardContent align="end" className="w-40 p-1">
              <div className="flex flex-col gap-0.5">
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start h-8 text-xs"
                    onClick={() => onEdit(account)}
                  >
                    <Pencil className="w-3 h-3 mr-2" />
                    Edit
                  </Button>
                )}
                {onSetDefault && !account.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start h-8 text-xs"
                    onClick={() => onSetDefault(account)}
                  >
                    <Star className="w-3 h-3 mr-2" />
                    Set Default
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => onDelete(account)}
                  >
                    <Trash2 className="w-3 h-3 mr-2" />
                    Delete
                  </Button>
                )}
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>

        {/* Balance */}
        <div className="mb-3">
          <p
            className={cn(
              "text-2xl font-bold",
              paperTheme.fonts.handwriting,
              account.currentBalance >= 0 ? "text-green-700" : "text-red-600",
            )}
          >
            {formatCurrency(account.currentBalance)}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          {onDeposit && (
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-7 text-xs",
                paperTheme.colors.borders.amber,
                "hover:bg-amber-50",
              )}
              onClick={(e) => {
                e.stopPropagation();
                onDeposit(account);
              }}
            >
              <ArrowUpRight className="w-3 h-3 mr-1" />
              Deposit
            </Button>
          )}
          {onTransfer && (
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-7 text-xs",
                paperTheme.colors.borders.amber,
                "hover:bg-amber-50",
              )}
              onClick={(e) => {
                e.stopPropagation();
                onTransfer(account);
              }}
            >
              <ArrowRightLeft className="w-3 h-3 mr-1" />
              Transfer
            </Button>
          )}
        </div>
      </div>

      {/* Decorative corner tape */}
      <div className="absolute -bottom-1 -right-1 w-10 h-3 bg-red-400/60 rounded-sm shadow-sm transform rotate-12" />
    </div>
  );
}

export default AccountCard;
