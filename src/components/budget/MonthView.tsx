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
    const startDay = i * 7 - off + 1; // may be <=0
    const endDay = Math.min(daysInMonth(year, month), startDay + 6);
    const safeStart = Math.max(1, startDay);
    return `Week ${i + 1} (${safeStart}-${endDay})`;
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
    return { spent, planned, weekExpenses, weekPlans };
  }

  function getMonthSummary() {
    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalPlanned = plans.reduce((sum, p) => sum + p.amount, 0);
    const remaining = Math.max(0, budget - totalSpent);
    return { totalSpent, totalPlanned, remaining, budget };
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
    <div className="p-4 space-y-4">
      {/* Month Summary */}
      <div className="bg-gradient-to-r from-emerald-50/80 to-green-50/80 rounded-xl p-4 border border-emerald-200/40">
        <div className="text-sm font-medium text-stone-700 mb-3">Month Financial Summary</div>
        <div className="grid grid-cols-3 gap-4 text-sm mb-3">
          <div className="text-center">
            <div className="opacity-60">Budget</div>
            <div className="font-bold text-stone-700 text-lg">${formatNumber(monthSummary.budget)}</div>
          </div>
          <div className="text-center">
            <div className="opacity-60">Spent</div>
            <div className="font-bold text-red-600 text-lg">${formatNumber(monthSummary.totalSpent)}</div>
          </div>
          <div className="text-center">
            <div className="opacity-60">Remaining</div>
            <div className="font-bold text-emerald-600 text-lg">${formatNumber(monthSummary.remaining)}</div>
          </div>
        </div>

        {/* Progress bar */}
        {monthSummary.budget > 0 ? (
          <div>
            <div className="flex items-center justify-between text-xs opacity-60 mb-2">
              <span>Budget Used</span>
              <span>{((monthSummary.totalSpent / monthSummary.budget) * 100).toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-stone-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all"
                style={{
                  width: `${Math.min(100, (monthSummary.totalSpent / monthSummary.budget) * 100)}%`
                }}
              />
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-xs text-stone-500 italic">Set a budget to see progress</div>
          </div>
        )}
      </div>

      {/* Weekly Breakdown */}
      <div className="space-y-3">
        <div className="text-sm font-medium opacity-70 mb-3">Weekly Breakdown</div>
        {Array.from({ length: weekCount }, (_, i) => {
          const weekSummary = getWeekSummary(i);
          const weekItems = plans.filter((p) => p.weekIndex === i);
          const isExpanded = expandedWeeks.has(i);

          return (
            <div key={i} className="bg-white/50 rounded-lg border border-stone-200 overflow-hidden">
              {/* Week Header */}
              <div
                className="p-3 cursor-pointer hover:bg-stone-50 transition-colors"
                onClick={() => toggleWeekExpansion(i)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    <div className="text-sm font-medium">{labelForWeek(i)}</div>
                    <div className="text-xs bg-stone-100 px-2 py-1 rounded">
                      {weekItems.length} items
                    </div>
                  </div>
                  <div className="text-xs opacity-60">
                    Spent: ${formatNumber(weekSummary.spent)} | Planned: ${formatNumber(weekSummary.planned)}
                  </div>
                </div>
              </div>

              {/* Week Items (Expanded) */}
              {isExpanded && (
                <div className="border-t border-stone-200 p-3 bg-white">
                  {weekItems.length === 0 ? (
                    <div className="text-xs text-stone-500 italic text-center py-2">
                      No planned items this week.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {weekItems.map((item) => (
                        <div key={item.id} className="bg-stone-50 rounded px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-3">
                              <div className="font-bold text-stone-900">${formatNumber(item.amount)}</div>
                              <div className="text-stone-600">{item.category}</div>
                              {item.note && (
                                <div className="text-xs text-stone-500 truncate max-w-32">• {item.note}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors cursor-pointer handwriting h-6"
                                onClick={() => onMarkPaid(item)}
                                disabled={!item.targetDate}
                                title={!item.targetDate ? "Specify a day first" : "Mark as paid"}
                              >
                                ✓ Paid
                              </button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 hover:bg-amber-50 cursor-pointer"
                                onClick={() => moveToNextWeek(item.id, i)}
                                title="Move to next week"
                                disabled={i >= weekCount - 1}
                              >
                                <ChevronRight className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 hover:bg-red-50 cursor-pointer"
                                onClick={() => onRemove(item.id)}
                                title="Delete"
                              >
                                <Trash className="w-3 h-3 text-red-500" />
                              </Button>
                            </div>
                          </div>
                          {item.targetDate ? (
                            <div className="text-xs text-stone-500">
                              Scheduled: {new Date(item.targetDate).toLocaleDateString()}
                            </div>
                          ) : (
                            <div className="text-xs text-amber-600">
                              No specific date set
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}