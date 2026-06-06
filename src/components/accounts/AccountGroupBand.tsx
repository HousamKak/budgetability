import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { Account, AccountGroup } from "@/lib/data-service";
import { cn, formatCurrency } from "@/lib/utils";
import {
  BarChart3,
  ChevronDown,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { CategoryIcon } from "@/components/budget/CategoryIcon";
import { AccountRow } from "./AccountRow";
import { readAccountDrag } from "./accountDrag";
import { groupTotal } from "./accountMath";

interface AccountGroupBandProps {
  group: AccountGroup;
  members: Account[];
  onOpenSummary: (group: AccountGroup) => void;
  onEditGroup: (group: AccountGroup) => void;
  onDeleteGroup: (group: AccountGroup) => void;
  onAddAccount: (group: AccountGroup) => void;
  onAccountDrop: (groupId: string, accountId: string) => void;
  onRemoveFromGroup: (groupId: string, accountId: string) => void;
  onCardClick: (account: Account) => void;
  onEditAccount: (account: Account) => void;
  onDeleteAccount: (account: Account) => void;
  onTransfer: (account: Account) => void;
  onDeposit: (account: Account) => void;
  onSetDefault: (account: Account) => void;
}

/**
 * A compact, collapsible group card ("mother account"): a tight header with the
 * combined total, and members listed as dense rows. Acts as a drop target —
 * drag an account onto it to add it to the group.
 */
export function AccountGroupBand({
  group,
  members,
  onOpenSummary,
  onEditGroup,
  onDeleteGroup,
  onAddAccount,
  onAccountDrop,
  onRemoveFromGroup,
  onCardClick,
  onEditAccount,
  onDeleteAccount,
  onTransfer,
  onDeposit,
  onSetDefault,
}: AccountGroupBandProps) {
  const combined = groupTotal(members);
  const accent = group.color || "#f59e0b";
  const [isOver, setIsOver] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!isOver) setIsOver(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsOver(false);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsOver(false);
    const id = readAccountDrag(e);
    if (id) onAccountDrop(group.id, id);
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative rounded-xl border bg-white/70 backdrop-blur-sm shadow-sm transition-all overflow-hidden self-start",
        isOver
          ? "ring-2 ring-amber-400 border-amber-300"
          : "border-stone-200/70",
      )}
    >
      {/* Accent strip */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: accent }}
      />

      {/* Header */}
      <div className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5">
        {/* Collapse toggle + identity */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 min-w-0 flex-1 text-left rounded-lg py-1 hover:bg-stone-50 transition-colors cursor-pointer"
          title={collapsed ? "Expand" : "Collapse"}
        >
          <ChevronDown
            className={cn(
              "w-4 h-4 text-stone-400 shrink-0 transition-transform",
              collapsed && "-rotate-90",
            )}
          />
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: accent + "22" }}
          >
            <CategoryIcon
              name={group.icon || "layers"}
              className="w-4 h-4"
              style={{ color: accent }}
            />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-stone-700 truncate handwriting leading-tight">
              {group.name}
            </div>
            <div className="text-[11px] text-stone-400 leading-tight">
              {members.length} {members.length === 1 ? "account" : "accounts"}
            </div>
          </div>
        </button>

        {/* Combined total → opens summary */}
        <button
          type="button"
          onClick={() => onOpenSummary(group)}
          title="View combined status"
          className="flex items-center gap-1 px-1.5 py-1 rounded-lg hover:bg-stone-50 transition-colors cursor-pointer shrink-0"
        >
          <span
            className={cn(
              "text-base font-bold tabular-nums handwriting",
              combined >= 0 ? "text-green-700" : "text-red-600",
            )}
          >
            {formatCurrency(combined)}
          </span>
          <BarChart3 className="w-3.5 h-3.5 text-stone-300" />
        </button>

        {/* Actions */}
        <button
          type="button"
          onClick={() => onAddAccount(group)}
          title="Add account to group"
          className="w-7 h-7 rounded-md flex items-center justify-center text-stone-400 hover:text-amber-600 hover:bg-amber-50 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
        <HoverCard openDelay={0} closeDelay={80}>
          <HoverCardTrigger asChild>
            <button
              type="button"
              className="w-7 h-7 rounded-md flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer shrink-0"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </HoverCardTrigger>
          <HoverCardContent align="end" className="w-40 p-1">
            <div className="flex flex-col gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="justify-start h-8 text-xs"
                onClick={() => onOpenSummary(group)}
              >
                <BarChart3 className="w-3 h-3 mr-2" />
                Combined status
              </Button>
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

      {/* Members */}
      {!collapsed && (
        <div className="pl-1.5 pr-1 pb-1.5 border-t border-stone-100">
          {members.length === 0 ? (
            <button
              type="button"
              onClick={() => onAddAccount(group)}
              className={cn(
                "mt-1.5 w-full py-3 rounded-lg border border-dashed text-xs text-stone-400 hover:bg-amber-50/50 transition-colors cursor-pointer",
                isOver ? "border-amber-400 bg-amber-50/60 text-amber-600" : "border-stone-300",
              )}
            >
              {isOver ? "Drop to add" : "Drag an account here, or click to add"}
            </button>
          ) : (
            <div className="mt-1 space-y-0.5">
              {members.map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  onClick={onCardClick}
                  onEdit={onEditAccount}
                  onDelete={onDeleteAccount}
                  onTransfer={onTransfer}
                  onDeposit={onDeposit}
                  onSetDefault={onSetDefault}
                  onRemove={() => onRemoveFromGroup(group.id, account.id)}
                  removeLabel={`Remove from ${group.name}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AccountGroupBand;
