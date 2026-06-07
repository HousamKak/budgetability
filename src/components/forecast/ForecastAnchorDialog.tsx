import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Account } from "@/lib/data-service";
import { cn, formatCurrency } from "@/lib/utils";
import { paperTheme } from "@/styles";
import { CategoryIcon } from "@/components/budget/CategoryIcon";
import { getAccountTypeConfig } from "@/components/accounts/AccountTypeBadge";
import { useEffect, useState } from "react";

interface ForecastAnchorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  /** Currently selected account ids, or null meaning "all accounts". */
  selectedIds: string[] | null;
  /** Save handler: null = all accounts, otherwise the chosen ids. */
  onSave: (ids: string[] | null) => void;
}

/**
 * Pick which accounts feed the forecast's starting balance.
 */
export function ForecastAnchorDialog({
  open,
  onOpenChange,
  accounts,
  selectedIds,
  onSave,
}: ForecastAnchorDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setSelected(
      new Set(selectedIds ?? accounts.map((a) => a.id)),
    );
  }, [open, selectedIds, accounts]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allOn = accounts.length > 0 && selected.size === accounts.length;
  const toggleAll = () =>
    setSelected(allOn ? new Set() : new Set(accounts.map((a) => a.id)));

  const total = accounts
    .filter((a) => selected.has(a.id))
    .reduce((s, a) => s + a.currentBalance, 0);

  const handleSave = () => {
    onSave(allOn ? null : [...selected]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-md",
          paperTheme.colors.background.cardGradient,
          paperTheme.colors.borders.paper,
          paperTheme.effects.shadow,
        )}
      >
        <div
          className={cn(
            "absolute inset-0 opacity-15 pointer-events-none rounded-2xl",
            paperTheme.effects.paperTexture,
          )}
        />
        <DialogHeader className="relative pb-1">
          <DialogTitle
            className={cn("text-2xl", paperTheme.colors.text.accent, paperTheme.fonts.handwriting)}
          >
            Starting balance
          </DialogTitle>
          <DialogDescription className="text-sm text-stone-500">
            Choose which accounts feed the forecast’s starting balance.
          </DialogDescription>
        </DialogHeader>

        <div className="relative space-y-2 pt-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-stone-400">
              {selected.size} of {accounts.length} selected
            </span>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs text-amber-600 hover:underline cursor-pointer"
            >
              {allOn ? "Clear all" : "Select all"}
            </button>
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1">
            {accounts.length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-6">
                No accounts yet.
              </p>
            ) : (
              accounts.map((a) => {
                const on = selected.has(a.id);
                const color = getAccountTypeConfig(a.accountType).color;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggle(a.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border-2 transition-colors cursor-pointer text-left",
                      on ? "border-amber-300 bg-amber-50/60" : "border-transparent hover:bg-white/60",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      readOnly
                      className="w-4 h-4 rounded border-2 border-amber-300 text-amber-500 shrink-0 pointer-events-none"
                    />
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: color + "22" }}
                    >
                      <CategoryIcon
                        name={a.icon || "wallet"}
                        className="w-4 h-4"
                        style={{ color }}
                      />
                    </div>
                    <span className="flex-1 min-w-0 text-sm text-stone-700 truncate">
                      {a.name}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-bold tabular-nums shrink-0",
                        a.currentBalance >= 0 ? "text-green-700" : "text-red-600",
                      )}
                    >
                      {formatCurrency(a.currentBalance)}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between px-1 pt-2 border-t border-stone-200/60">
            <span className="text-sm text-stone-500">Starting balance</span>
            <span className="text-lg font-bold text-stone-700 tabular-nums">
              {formatCurrency(total)}
            </span>
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl border-2 border-amber-900/20 py-5"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="flex-1 rounded-xl py-5 bg-amber-500 hover:bg-amber-600 text-white"
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ForecastAnchorDialog;
