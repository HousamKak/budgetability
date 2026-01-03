import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Expense, PlanItem } from "@/lib/data-service";
import { formatNumber } from "@/lib/utils";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Trash } from "./Icons";
import { daysInMonth, monStartOffset } from "./utils";

interface WeekViewProps {
  year: number;
  month: number;
  weekCount: number;
  todaysWeek: number;
  plans: PlanItem[];
  expenses: Expense[];
  onUpdate: (id: string, patch: Partial<PlanItem>) => void;
  onRemove: (id: string) => void;
  onMarkPaid: (p: PlanItem) => void;
}

export function WeekView({
  year,
  month,
  weekCount,
  todaysWeek,
  plans,
  expenses,
  onUpdate,
  onRemove,
  onMarkPaid,
}: WeekViewProps) {
  const [weekIndex, setWeekIndex] = useState<number>(todaysWeek);
  const [itemsExpanded, setItemsExpanded] = useState<boolean>(true);
  const [showAllItemsModal, setShowAllItemsModal] = useState<boolean>(false);

  const labelForWeek = (i: number) => {
    const off = monStartOffset(year, month);
    const startDay = i * 7 - off + 1; // may be <=0
    const endDay = Math.min(daysInMonth(year, month), startDay + 6);
    const safeStart = Math.max(1, startDay);
    return `Week ${i + 1} (${safeStart}-${endDay})`;
  };

  const thisWeekItems = plans.filter((p) => p.weekIndex === weekIndex);

  // Financial summary helpers
  function getWeekDateRange(wkIndex: number) {
    const off = monStartOffset(year, month);
    const startDay = Math.max(1, wkIndex * 7 - off + 1);
    const endDay = Math.min(daysInMonth(year, month), startDay + 6);
    return { startDay, endDay };
  }

  function getWeekExpenses(wkIndex: number) {
    const { startDay, endDay } = getWeekDateRange(wkIndex);
    return expenses.filter((e) => {
      const expenseDate = new Date(e.date);
      const expenseDay = expenseDate.getDate();
      const expenseMonth = expenseDate.getMonth();
      const expenseYear = expenseDate.getFullYear();
      return (
        expenseYear === year &&
        expenseMonth === month &&
        expenseDay >= startDay &&
        expenseDay <= endDay
      );
    });
  }

  function getWeekSummary(wkIndex: number) {
    const weekExpenses = getWeekExpenses(wkIndex);
    const weekPlans = plans.filter((p) => p.weekIndex === wkIndex);
    const spent = weekExpenses.reduce((sum, e) => sum + e.amount, 0);
    const planned = weekPlans.reduce((sum, p) => sum + p.amount, 0);
    return { spent, planned, weekExpenses, weekPlans };
  }

  const currentSummary = getWeekSummary(weekIndex);

  return (
    <div className="p-4 space-y-4">
      {/* Week Navigation & Summary */}
      <div className="bg-gradient-to-r from-amber-50/80 to-yellow-50/80 rounded-xl p-4 border border-amber-200/40">
        <div className="flex items-center justify-between mb-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setWeekIndex(Math.max(0, weekIndex - 1))}
            disabled={weekIndex === 0}
            className="h-8 w-8 p-0 rounded-full hover:bg-amber-200/50 disabled:opacity-30 cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="text-center flex-1">
            <div className="text-lg font-medium text-stone-700">
              {labelForWeek(weekIndex)}
            </div>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setWeekIndex(Math.min(weekCount - 1, weekIndex + 1))}
            disabled={weekIndex === weekCount - 1}
            className="h-8 w-8 p-0 rounded-full hover:bg-amber-200/50 disabled:opacity-30 cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Financial Data */}
        <div className="flex justify-center gap-6 text-sm">
          <div className="text-center">
            <div className="opacity-60">Spent</div>
            <div className="font-bold text-red-600">
              ${formatNumber(currentSummary.spent)}
            </div>
          </div>
          <div className="text-center">
            <div className="opacity-60">Planned</div>
            <div className="font-bold text-blue-600">
              ${formatNumber(currentSummary.planned)}
            </div>
          </div>
        </div>
      </div>

      {/* Week Items */}
      <div className="bg-white rounded-lg border border-stone-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-stone-700">
            Week Items ({thisWeekItems.length})
          </h3>
          <div className="flex items-center gap-2">
            {thisWeekItems.length > 5 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAllItemsModal(true)}
                className="h-6 px-2 text-xs cursor-pointer"
              >
                View all
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setItemsExpanded(!itemsExpanded)}
              className="h-6 w-6 p-0 cursor-pointer"
            >
              <ChevronRight
                className={`h-4 w-4 transition-transform ${
                  itemsExpanded ? "rotate-90" : ""
                }`}
              />
            </Button>
          </div>
        </div>

        {itemsExpanded && (
          <div className="max-h-96 overflow-y-auto">
            <WeekList
              items={thisWeekItems}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onMarkPaid={onMarkPaid}
            />
          </div>
        )}
      </div>

      {/* All Items Modal */}
      <Dialog open={showAllItemsModal} onOpenChange={setShowAllItemsModal}>
        <DialogContent
          className="max-w-2xl max-h-[80vh] overflow-y-auto"
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle>All Week Items ({thisWeekItems.length})</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <WeekList
              items={thisWeekItems}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onMarkPaid={onMarkPaid}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WeekList({
  items,
  onUpdate,
  onRemove,
  onMarkPaid,
}: {
  items: PlanItem[];
  onUpdate: (id: string, patch: Partial<PlanItem>) => void;
  onRemove: (id: string) => void;
  onMarkPaid: (p: PlanItem) => void;
}) {
  return (
    <div>
      {items.length === 0 && (
        <div className="text-sm text-stone-500 text-center py-4">
          No items planned for this week.
        </div>
      )}
      <div className="space-y-2">
        {items.map((p) => (
          <div
            key={p.id}
            className="rounded-lg border border-stone-200 bg-white p-2.5 text-sm"
          >
            {/* First line: Amount, Category, Action buttons */}
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-3">
                <div className="font-bold text-stone-900">
                  ${formatNumber(p.amount)}
                </div>
                <div className="text-stone-600">{p.category}</div>
                {p.note && (
                  <div className="text-xs text-stone-500 truncate max-w-24">
                    • {p.note}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors cursor-pointer handwriting h-6"
                  onClick={() => onMarkPaid(p)}
                  disabled={!p.targetDate}
                  title={!p.targetDate ? "Specify a day first" : "Mark as paid"}
                >
                  ✓ Paid
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 hover:bg-red-50 cursor-pointer"
                  onClick={() => onRemove(p.id)}
                  title="Delete"
                >
                  <Trash className="w-3 h-3 text-red-500" />
                </Button>
              </div>
            </div>
            {/* Second line: Date input */}
            <div className="flex items-center gap-2">
              <Label className="text-xs opacity-70 min-w-fit">Day:</Label>
              <Input
                className="h-6 flex-1 text-xs date-input-stable"
                type="date"
                value={p.targetDate || ""}
                onChange={(e) => onUpdate(p.id, { targetDate: e.target.value })}
                autoComplete="off"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
