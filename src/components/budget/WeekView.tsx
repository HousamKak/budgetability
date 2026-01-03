import { Button } from "@/components/ui/button";
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

  const labelForWeek = (i: number) => {
    const off = monStartOffset(year, month);
    const startDay = i * 7 - off + 1;
    const endDay = Math.min(daysInMonth(year, month), startDay + 6);
    const safeStart = Math.max(1, startDay);
    return { weekNum: i + 1, startDay: safeStart, endDay };
  };

  const thisWeekItems = plans.filter((p) => p.weekIndex === weekIndex);

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
    return { spent, planned };
  }

  const currentSummary = getWeekSummary(weekIndex);
  const weekLabel = labelForWeek(weekIndex);

  return (
    <div className="p-3 space-y-3">
      {/* Week Navigation */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setWeekIndex(Math.max(0, weekIndex - 1))}
          disabled={weekIndex === 0}
          className="h-7 w-7 p-0 rounded-lg hover:bg-amber-100 disabled:opacity-30 cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1 flex items-center justify-center gap-3">
          <span
            className="text-lg font-bold text-amber-700"
            style={{ fontFamily: '"Patrick Hand", cursive' }}
          >
            Week {weekLabel.weekNum}
          </span>
          <span className="text-xs text-stone-500 bg-amber-100/60 px-2 py-0.5 rounded-full">
            {weekLabel.startDay}–{weekLabel.endDay}
          </span>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setWeekIndex(Math.min(weekCount - 1, weekIndex + 1))}
          disabled={weekIndex === weekCount - 1}
          className="h-7 w-7 p-0 rounded-lg hover:bg-amber-100 disabled:opacity-30 cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary Row */}
      <div className="flex items-center justify-center gap-6 py-2 px-3 bg-gradient-to-r from-amber-50/80 to-orange-50/60 rounded-xl border border-amber-200/50">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-stone-500">Spent</span>
          <span className="text-sm font-bold text-red-600">${formatNumber(currentSummary.spent)}</span>
        </div>
        <div className="w-px h-4 bg-amber-300/50" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-stone-500">Planned</span>
          <span className="text-sm font-bold text-amber-700">${formatNumber(currentSummary.planned)}</span>
        </div>
      </div>

      {/* Week Items */}
      <div className="space-y-1.5">
        <div
          className="text-xs font-medium text-stone-500 px-1"
          style={{ fontFamily: '"Patrick Hand", cursive' }}
        >
          {thisWeekItems.length} item{thisWeekItems.length !== 1 ? 's' : ''} planned
        </div>

        {thisWeekItems.length === 0 ? (
          <div className="text-center py-8 text-stone-400">
            <div
              className="text-base mb-1"
              style={{ fontFamily: '"Patrick Hand", cursive' }}
            >
              Nothing planned yet
            </div>
            <div className="text-xs">Add items from the Draft tab</div>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
            {thisWeekItems.map((p) => (
              <div
                key={p.id}
                className="group flex items-center gap-2 p-2 rounded-lg bg-white/80 border border-stone-200/80 hover:border-amber-300/60 hover:shadow-sm transition-all"
              >
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="font-bold text-stone-800 text-sm">
                    ${formatNumber(p.amount)}
                  </span>
                  <span className="text-xs text-stone-600 truncate">{p.category}</span>
                  {p.note && (
                    <span className="text-xs text-stone-400 truncate hidden sm:inline">
                      · {p.note}
                    </span>
                  )}
                </div>

                {p.targetDate ? (
                  <span className="text-xs text-stone-500 tabular-nums">
                    {new Date(p.targetDate + 'T00:00:00').getDate()}th
                  </span>
                ) : (
                  <input
                    type="date"
                    value=""
                    onChange={(e) => onUpdate(p.id, { targetDate: e.target.value })}
                    className="w-7 h-6 opacity-50 hover:opacity-100 cursor-pointer text-xs"
                    title="Set date"
                  />
                )}

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors cursor-pointer"
                    onClick={() => onMarkPaid(p)}
                    disabled={!p.targetDate}
                    title={!p.targetDate ? "Set date first" : "Mark paid"}
                  >
                    Paid
                  </button>
                  <button
                    className="p-1 hover:bg-red-50 rounded transition-colors cursor-pointer"
                    onClick={() => onRemove(p.id)}
                    title="Delete"
                  >
                    <Trash className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
