import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { Account, AccountGroup } from "@/lib/data-service";
import { cn, formatCurrency } from "@/lib/utils";
import { paperTheme } from "@/styles";
import { ChevronRight, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { CategoryIcon } from "@/components/budget/CategoryIcon";
import { AccountCard } from "./AccountCard";

interface AccountGroupBandProps {
  group: AccountGroup;
  members: Account[];
  onOpenSummary: (group: AccountGroup) => void;
  onEditGroup: (group: AccountGroup) => void;
  onDeleteGroup: (group: AccountGroup) => void;
  onAddAccount: (group: AccountGroup) => void;
  // Per-account actions (forwarded to each member's AccountCard)
  onCardClick: (account: Account) => void;
  onEditAccount: (account: Account) => void;
  onDeleteAccount: (account: Account) => void;
  onTransfer: (account: Account) => void;
  onDeposit: (account: Account) => void;
  onSetDefault: (account: Account) => void;
}

/**
 * A horizontal "band" for one mother account: a clickable group header showing
 * the combined balance, followed by its member accounts stacked horizontally.
 */
export function AccountGroupBand({
  group,
  members,
  onOpenSummary,
  onEditGroup,
  onDeleteGroup,
  onAddAccount,
  onCardClick,
  onEditAccount,
  onDeleteAccount,
  onTransfer,
  onDeposit,
  onSetDefault,
}: AccountGroupBandProps) {
  const combined = members.reduce((sum, a) => sum + a.currentBalance, 0);
  const accent = group.color || "#f59e0b";

  return (
    <div
      className={cn(
        "relative rounded-2xl p-4 mb-5",
        paperTheme.colors.background.cardGradient,
        paperTheme.colors.borders.paper,
        paperTheme.effects.shadow.md,
        "overflow-hidden",
      )}
    >
      <div
        className={cn(
          "absolute inset-0 opacity-10 pointer-events-none rounded-2xl",
          paperTheme.effects.paperTexture,
        )}
      />
      {/* Accent spine on the left */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl"
        style={{ backgroundColor: accent }}
      />

      {/* Group header — click to view combined status */}
      <div className="relative z-10 flex items-center justify-between gap-3 mb-4 pl-2">
        <button
          type="button"
          onClick={() => onOpenSummary(group)}
          className="flex items-center gap-3 group/header text-left cursor-pointer rounded-lg -ml-1 pr-3 py-1 hover:bg-white/40 transition-colors"
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: accent + "22" }}
          >
            <CategoryIcon
              name={group.icon || "layers"}
              className="w-6 h-6"
              style={{ color: accent }}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2
                className={cn(
                  "text-xl font-bold",
                  paperTheme.colors.text.accent,
                  paperTheme.fonts.handwriting,
                )}
              >
                {group.name}
              </h2>
              <ChevronRight className="w-4 h-4 text-stone-400 group-hover/header:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-xs text-stone-500">
              {members.length} {members.length === 1 ? "account" : "accounts"} ·
              combined
            </p>
          </div>
          <p
            className={cn(
              "text-2xl font-bold ml-2",
              paperTheme.fonts.handwriting,
              combined >= 0 ? "text-green-700" : "text-red-600",
            )}
          >
            {formatCurrency(combined)}
          </p>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className={cn("h-8 text-xs", paperTheme.colors.borders.amber)}
            onClick={() => onAddAccount(group)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add
          </Button>
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-amber-100"
              >
                <MoreVertical className="w-4 h-4 text-stone-500" />
              </Button>
            </HoverCardTrigger>
            <HoverCardContent align="end" className="w-40 p-1">
              <div className="flex flex-col gap-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start h-8 text-xs"
                  onClick={() => onEditGroup(group)}
                >
                  <Pencil className="w-3 h-3 mr-2" />
                  Edit Group
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => onDeleteGroup(group)}
                >
                  <Trash2 className="w-3 h-3 mr-2" />
                  Delete Group
                </Button>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
      </div>

      {/* Members stacked horizontally */}
      <div className="relative z-10 pl-2">
        {members.length === 0 ? (
          <button
            type="button"
            onClick={() => onAddAccount(group)}
            className={cn(
              "w-full py-6 rounded-xl border-2 border-dashed text-sm text-stone-500 hover:bg-white/40 transition-colors cursor-pointer",
              paperTheme.colors.borders.amber,
            )}
          >
            No accounts yet — add one to this group
          </button>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 book-scroll">
            {members.map((account) => (
              <div key={account.id} className="w-72 shrink-0">
                <AccountCard
                  account={account}
                  onClick={onCardClick}
                  onEdit={onEditAccount}
                  onDelete={onDeleteAccount}
                  onTransfer={onTransfer}
                  onDeposit={onDeposit}
                  onSetDefault={onSetDefault}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AccountGroupBand;
