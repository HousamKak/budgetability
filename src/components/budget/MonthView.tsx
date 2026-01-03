import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import { ChevronRight, Trash } from "./Icons";
import { monStartOffset, daysInMonth } from "./utils";
import type { Expense, PlanItem } from "@/lib/data-service";

interface MonthViewProps {
  year: number;
  month: number;
  weekCount: number;
  plans: PlanItem[];
  expenses: Expense[];
  budget: number;
  onUpdate: (id: string, patch: Partial<PlanItem>) => void;
  onRemove: (id: string) => void;
  onMarkPaid: (p: PlanItem) => void;
}

export function MonthView({
  year,
  month,
  weekCount,
  plans,
  expenses,
  budget,
  onUpdate,
  onRemove,
  onMarkPaid,
}: MonthViewProps) {
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());

  const labelForWeek = (i: number) => {
    const off = monStartOffset(year, month);
    const startDay = i * 7 - off + 1;
    const endDay = Math.min(daysInMonth(year, month), startDay + 6);
    const safeStart = Math.max(1, startDay);
    return { weekNum: i + 1, startDay: safeStart, endDay };
  };

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
      return expenseYear === year && expenseMonth === month &&
             expenseDay >= startDay && expenseDay <= endDay;
    });
  }

  function getWeekSummary(wkIndex: number) {
    const weekExpenses = getWeekExpenses(wkIndex);
    const weekPlans = plans.filter((p) => p.weekIndex === wkIndex);
    const spent = weekExpenses.reduce((sum, e) => sum + e.amount, 0);
    const planned = weekPlans.reduce((sum, p) => sum + p.amount, 0);
    return { spent, planned, weekPlans };
  }

  function getMonthSummary() {
    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalPlanned = plans.reduce((sum, p) => sum + p.amount, 0);
    const remaining = Math.max(0, budget - totalSpent);
    const percentUsed = budget > 0 ? (totalSpent / budget) * 100 : 0;
    return { totalSpent, totalPlanned, remaining, budget, percentUsed };
  }

  function toggleWeekExpansion(weekIndex: number) {
    setExpandedWeeks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(weekIndex)) {
        newSet.delete(weekIndex);
      } else {
        newSet.add(weekIndex);
      }
      return newSet;
    });
  }

  function moveToNextWeek(id: string, currentWeekIndex: number) {
    onUpdate(id, { weekIndex: Math.min(currentWeekIndex + 1, weekCount - 1) });
  }

  const monthSummary = getMonthSummary();

  return (
    <div className="p-3 space-y-3">
      {/* Month Summary - Compact */}
      <div className="bg-gradient-to-r from-amber-50/80 to-orange-50/60 rounded-xl p-3 border border-amber-200/50">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-xs text-stone-500">Budget</div>
              <div className="font-bold text-stone-700">${formatNumber(monthSummary.budget)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-stone-500">Spent</div>
              <div className="font-bold text-red-600">${formatNumber(monthSummary.totalSpent)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-stone-500">Left</div>
              <div className="font-bold text-amber-700">${formatNumber(monthSummary.remaining)}</div>
            </div>
          </div>
          <div
            className="text-2xl font-bold text-amber-600"
            style={{ fontFamily: '"Patrick Hand", cursive' }}
          >
            {monthSummary.percentUsed.toFixed(0)}%
          </div>
        </div>

        {/* Progress bar - slim */}
        {monthSummary.budget > 0 && (
          <div className="h-1.5 bg-amber-200/50 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all rounded-full ${
                monthSummary.percentUsed > 90 ? 'bg-red-500' :
                monthSummary.percentUsed > 70 ? 'bg-amber-500' : 'bg-amber-400'
              }`}
              style={{ width: `${Math.min(100, monthSummary.percentUsed)}%` }}
            />
          </div>
        )}
      </div>

      {/* Weekly Breakdown - Compact */}
      <div className="space-y-1.5">
        <div
          className="text-xs font-medium text-stone-500 px-1"
          style={{ fontFamily: '"Patrick Hand", cursive' }}
        >
          Weekly Breakdown
        </div>

        {Array.from({ length: weekCount }, (_, i) => {
          const weekSummary = getWeekSummary(i);
          const weekLabel = labelForWeek(i);
          const isExpanded = expandedWeeks.has(i);
          const hasItems = weekSummary.weekPlans.length > 0;

          return (
            <div
              key={i}
              className={`rounded-lg border overflow-hidden transition-all ${
                isExpanded ? 'border-amber-300/60 bg-white/90' : 'border-stone-200/80 bg-white/60'
              }`}
            >
              {/* Week Header - Compact */}
              <div
                className={`flex items-center gap-2 px-2.5 py-1.5 cursor-pointer transition-colors ${
                  hasItems ? 'hover:bg-amber-50/50' : ''
                }`}
                onClick={() => hasItems && toggleWeekExpansion(i)}
              >
                {hasItems && (
                  <ChevronRight className={`h-3 w-3 text-stone-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                )}
                {!hasItems && <div className="w-3" />}

                <span
                  className="text-sm font-medium text-stone-700"
                  style={{ fontFamily: '"Patrick Hand", cursive' }}
                >
                  Week {weekLabel.weekNum}
                </span>
                <span className="text-xs text-stone-400">
                  {weekLabel.startDay}–{weekLabel.endDay}
                </span>

                <div className="flex-1" />

                <div className="flex items-center gap-3 text-xs">
                  {weekSummary.weekPlans.length > 0 && (
                    <span className="text-stone-400">{weekSummary.weekPlans.length} items</span>
                  )}
                  {weekSummary.spent > 0 && (
                    <span className="text-red-500">${formatNumber(weekSummary.spent)}</span>
                  )}
                  {weekSummary.planned > 0 && (
                    <span className="text-amber-600 font-medium">${formatNumber(weekSummary.planned)}</span>
                  )}
                </div>
              </div>

              {/* Week Items - Expanded */}
              {isExpanded && weekSummary.weekPlans.length > 0 && (
                <div className="px-2.5 pb-2 space-y-1">
                  {weekSummary.weekPlans.map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-center gap-2 px-2 py-1.5 rounded bg-stone-50/80 text-sm"
                    >
                      <span className="font-bold text-stone-800">${formatNumber(item.amount)}</span>
                      <span className="text-xs text-stone-600">{item.category}</span>
                      {item.note && (
                        <span className="text-xs text-stone-400 truncate max-w-24">· {item.note}</span>
                      )}

                      <div className="flex-1" />

                      {item.targetDate && (
                        <span className="text-xs text-stone-400 tabular-nums">
                          {new Date(item.targetDate + 'T00:00:00').getDate()}th
                        </span>
                      )}

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200 cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); onMarkPaid(item); }}
                          disabled={!item.targetDate}
                          title={!item.targetDate ? "Set date first" : "Mark paid"}
                        >
                          Paid
                        </button>
                        {i < weekCount - 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0 hover:bg-amber-50 cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); moveToNextWeek(item.id, i); }}
                            title="Move to next week"
                          >
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        )}
                        <button
                          className="p-0.5 hover:bg-red-50 rounded cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
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
          );
        })}
      </div>
    </div>
  );
}
