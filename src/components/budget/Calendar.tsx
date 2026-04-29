import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import type { Account, Expense, PlanItem } from "@/lib/data-service";
import { formatNumber } from "@/lib/utils";
import { calendarStyles, cn, conditional } from "@/styles";
import { Check, GripVertical, Pencil, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  AccountInlineSelect,
  renderAccountLabel,
} from "./AccountInlineSelect";
import { CategoryPicker } from "./CategoryPicker";
import { Plus, Trash } from "./Icons";
import { daysInMonth, firstWeekday, pad2, ymd } from "./utils";

interface CalendarProps {
  year: number;
  month: number;
  monthKey: string;
  budget: number;
  expenses: Expense[];
  plans: PlanItem[];
  accounts?: Account[];
  animatedPlanDates?: Set<string>;
  animatedExpenseDates?: Set<string>;
  onDayClick: (date: string) => void;
  onShowQuote: () => void;
  onRemoveExpense: (id: string) => void;
  onRemovePlan: (id: string) => void;
  onMarkPlanPaid: (plan: PlanItem) => void;
  onEditExpense?: (expense: Expense) => void;
  onEditPlan?: (plan: PlanItem) => void;
  onUpdateExpense?: (id: string, updates: Partial<Expense>) => void;
  onUpdatePlan?: (id: string, updates: Partial<PlanItem>) => void;
}

export function Calendar({
  year,
  month,
  monthKey,
  budget,
  expenses,
  plans,
  accounts = [],
  animatedPlanDates,
  animatedExpenseDates,
  onDayClick,
  onShowQuote,
  onRemoveExpense,
  onRemovePlan,
  onMarkPlanPaid,
  onEditExpense: _onEditExpense,
  onEditPlan: _onEditPlan,
  onUpdateExpense,
  onUpdatePlan,
}: CalendarProps) {
  const today = new Date();
  const nDays = daysInMonth(year, month);
  const startOn = firstWeekday(year, month); // 0=Sun ...
  const blanks = Array.from({ length: startOn === 0 ? 6 : startOn - 1 }); // make Monday first visually
  const days = Array.from({ length: nDays }, (_, i) => i + 1);

  // Inline editing state
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    amount: string;
    category: string;
    accountId: string;
    note: string;
  }>({ amount: "", category: "", accountId: "", note: "" });

  const startEditingExpense = (expense: Expense, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingExpenseId(expense.id);
    setEditingPlanId(null);
    setEditFormData({
      amount: expense.amount.toString(),
      category: expense.category || "",
      accountId: expense.accountId || "",
      note: expense.note || "",
    });
  };

  const startEditingPlan = (plan: PlanItem, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingPlanId(plan.id);
    setEditingExpenseId(null);
    setEditFormData({
      amount: plan.amount.toString(),
      category: plan.category || "",
      accountId: plan.accountId || "",
      note: plan.note || "",
    });
  };

  const saveExpenseEdit = (expenseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onUpdateExpense) {
      const amount = parseFloat(editFormData.amount);
      if (!isNaN(amount) && amount > 0) {
        onUpdateExpense(expenseId, {
          amount,
          category: editFormData.category,
          accountId: editFormData.accountId || undefined,
          note: editFormData.note,
        });
      }
    }
    setEditingExpenseId(null);
  };

  const savePlanEdit = (planId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onUpdatePlan) {
      const amount = parseFloat(editFormData.amount);
      if (!isNaN(amount) && amount > 0) {
        onUpdatePlan(planId, {
          amount,
          category: editFormData.category,
          accountId: editFormData.accountId || undefined,
          note: editFormData.note,
        });
      }
    }
    setEditingPlanId(null);
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingExpenseId(null);
    setEditingPlanId(null);
  };

  // Drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Fallback cleanup: if the source element unmounts during drag,
  // its onDragEnd won't fire. Catch with document-level listeners.
  useEffect(() => {
    if (!isDragging) return;
    function cleanup() {
      setIsDragging(false);
      setDragOverDay(null);
    }
    // dragend bubbles to document when source stays in DOM
    document.addEventListener("dragend", cleanup);
    // pointerdown fires on next user interaction if dragend was missed
    document.addEventListener("pointerdown", cleanup);
    return () => {
      document.removeEventListener("dragend", cleanup);
      document.removeEventListener("pointerdown", cleanup);
    };
  }, [isDragging]);

  function handleDragStart(e: React.DragEvent, type: "expense" | "plan", id: string) {
    e.dataTransfer.setData("text/plain", JSON.stringify({ type, id }));
    e.dataTransfer.effectAllowed = "move";
    // Wait one frame so the browser captures the drag ghost,
    // then force-close all HoverCards via state
    requestAnimationFrame(() => {
      setIsDragging(true);
    });
  }

  function handleDragEnd() {
    setIsDragging(false);
    setDragOverDay(null);
  }

  function handleDrop(e: React.DragEvent, targetDate: string) {
    e.preventDefault();
    setIsDragging(false);
    setDragOverDay(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (data.type === "expense" && onUpdateExpense) {
        onUpdateExpense(data.id, { date: targetDate });
      } else if (data.type === "plan" && onUpdatePlan) {
        onUpdatePlan(data.id, { targetDate });
      }
    } catch { /* ignore invalid drag data */ }
  }

  function handleDragOver(e: React.DragEvent, dayDate: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverDay !== dayDate) setDragOverDay(dayDate);
  }

  function handleDragLeave() {
    setDragOverDay(null);
  }

  // helpers per-day
  function spentOn(day: number) {
    const d = `${monthKey}-${pad2(day)}`;
    return expenses
      .filter((e) => e.date === d)
      .reduce((s, e) => s + e.amount, 0);
  }

  function leftAfter(day: number) {
    const upto = expenses
      .filter((e) => e.date <= `${monthKey}-${pad2(day)}`)
      .reduce((s, e) => s + e.amount, 0);
    return Math.max(0, budget - upto);
  }

  function listFor(day: number) {
    const d = `${monthKey}-${pad2(day)}`;
    return expenses.filter((e) => e.date === d);
  }

  function plannedFor(day: number) {
    const d = `${monthKey}-${pad2(day)}`;
    return plans.filter((p) => p.targetDate === d);
  }

  function plannedAmountOn(day: number) {
    const d = `${monthKey}-${pad2(day)}`;
    return plans
      .filter((p) => p.targetDate === d)
      .reduce((s, p) => s + p.amount, 0);
  }

  return (
    <div
      ref={calendarRef}
      className="mobile-calendar-area lg:h-auto lg:flex lg:flex-col"
      data-mobile-view="calendar"
    >
      {/* weekday header (Mon-first) */}
      <div className={calendarStyles.weekdayHeader}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className={calendarStyles.weekdayCell}>
            {d}
          </div>
        ))}
      </div>

      <div className={calendarStyles.calendarGrid}>
        {blanks.map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {days.map((d) => {
          const dayDate = `${monthKey}-${pad2(d)}`;
          const isPlanAnimated = animatedPlanDates?.has(dayDate) ?? false;
          const isExpenseAnimated = animatedExpenseDates?.has(dayDate) ?? false;

          const isEditing = listFor(d).some((e) => editingExpenseId === e.id) ||
            plannedFor(d).some((p) => editingPlanId === p.id);

          return (
            <HoverCard
              key={d}
              openDelay={200}
              closeDelay={200}
              open={isDragging ? false : isEditing ? true : undefined}
              onOpenChange={isDragging || isEditing ? () => {} : undefined}
            >
              <HoverCardTrigger asChild>
                <button
                  className={cn(
                    calendarStyles.dayCell,
                    conditional(
                      ymd(today) === dayDate,
                      calendarStyles.todayHighlight
                    ),
                    conditional(isPlanAnimated, calendarStyles.planGlow),
                    conditional(isExpenseAnimated, calendarStyles.expenseGlow),
                    conditional(dragOverDay === dayDate, "ring-2 ring-amber-400 bg-amber-50/50")
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    onDayClick(dayDate);
                  }}
                  onDragOver={(e) => handleDragOver(e, dayDate)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, dayDate)}
                >
                  {/* torn paper top edge */}
                  <div className={calendarStyles.dayTornEdge} />
                  <div className="p-0.5 xs:p-1 sm:p-2 md:p-2.5 h-full flex flex-col items-start">
                    <div className="flex items-center gap-0.5 xs:gap-1 sm:gap-2">
                      <span className="text-xs xs:text-sm sm:text-lg md:text-xl font-bold handwriting">
                        {d}
                      </span>
                    </div>

                    {/* Today sticker */}
                    {ymd(today) === dayDate && (
                      <div
                        className={calendarStyles.todaySticker}
                        onClick={(e) => {
                          e.stopPropagation();
                          onShowQuote();
                        }}
                      >
                        ⭐
                      </div>
                    )}
                    <div className={calendarStyles.dayStats.container}>
                      <div className={calendarStyles.dayStats.leftStats}>
                        <div>
                          <div className={calendarStyles.dayStats.label}>
                            spent
                          </div>
                          <div className="text-[7px] xs:text-[8px] sm:text-[9px] md:text-[10px] font-bold mt-0.5 text-red-600">
                            ${formatNumber(spentOn(d))}
                          </div>
                        </div>
                        <div>
                          <div className={calendarStyles.dayStats.label}>
                            rem
                          </div>
                          <div className="text-[7px] xs:text-[8px] sm:text-[9px] md:text-[10px] font-bold mt-0.5 text-emerald-600">
                            ${formatNumber(leftAfter(d))}
                          </div>
                        </div>
                      </div>
                      <div className={calendarStyles.dayStats.rightStats}>
                        <div className={calendarStyles.dayStats.label}>
                          planned
                        </div>
                        <div className="text-[7px] xs:text-[8px] sm:text-[9px] md:text-[10px] font-bold mt-0.5 text-blue-600">
                          ${formatNumber(plannedAmountOn(d))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={calendarStyles.hoverIcon}>
                    <Plus className="w-3.5 h-3.5 text-stone-600" />
                  </div>
                </button>
              </HoverCardTrigger>
              <HoverCardContent className="w-80">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">
                      {new Date(year, month, d).toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    <div className="text-xs text-stone-500">
                      budget:{" "}
                      <span className="font-bold text-stone-800">
                        ${formatNumber(budget)}
                      </span>
                    </div>
                  </div>

                  {/* Day Summary */}
                  <div className="grid grid-cols-3 gap-2 text-xs bg-amber-50/50 rounded-lg p-2 border border-amber-200/30">
                    <div className="text-center">
                      <div className="opacity-60">Planned</div>
                      <div className="font-bold text-blue-600">
                        ${formatNumber(plannedAmountOn(d))}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="opacity-60">Spent</div>
                      <div className="font-bold text-red-600">
                        ${formatNumber(spentOn(d))}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="opacity-60">Remaining</div>
                      <div className="font-bold text-emerald-600">
                        ${formatNumber(leftAfter(d))}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs uppercase tracking-wide opacity-60">
                    planned
                  </div>
                  <div className="max-h-44 overflow-y-auto pr-1">
                    {plannedFor(d).length === 0 && (
                      <div className="text-sm text-stone-500 italic">
                        No planned items for this day.
                      </div>
                    )}
                    {plannedFor(d).map((p) => (
                      <div
                        key={p.id}
                        className="rounded-xl border border-stone-200 bg-white px-2 py-1.5 mt-1 hover:shadow-sm transition-all"
                      >
                        {editingPlanId === p.id ? (
                          // Inline edit mode
                          <div
                            className="space-y-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                value={editFormData.amount}
                                onChange={(e) =>
                                  setEditFormData({
                                    ...editFormData,
                                    amount: e.target.value,
                                  })
                                }
                                className="h-7 text-sm flex-1"
                                placeholder="Amount"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="flex-1" onClick={(e) => e.stopPropagation()}>
                                <CategoryPicker
                                  value={editFormData.category}
                                  onChange={(val) => setEditFormData({ ...editFormData, category: val })}
                                  useNameAsValue
                                  triggerClassName="h-7 text-sm"
                                  placeholder="Category"
                                />
                              </div>
                            </div>
                            <div onClick={(e) => e.stopPropagation()}>
                              <AccountInlineSelect
                                accounts={accounts}
                                value={editFormData.accountId}
                                onChange={(id) =>
                                  setEditFormData({
                                    ...editFormData,
                                    accountId: id,
                                  })
                                }
                              />
                            </div>
                            <Input
                              type="text"
                              value={editFormData.note}
                              onChange={(e) =>
                                setEditFormData({
                                  ...editFormData,
                                  note: e.target.value,
                                })
                              }
                              className="h-7 text-sm"
                              placeholder="Note"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={(e) => savePlanEdit(p.id, e)}
                                className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="text-xs px-2 py-1 bg-stone-300 text-stone-700 rounded hover:bg-stone-400 transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <X className="w-3 h-3" /> Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          // Display mode
                          <div
                            className="flex items-center justify-between"
                            draggable
                            onDragStart={(ev) => handleDragStart(ev, "plan", p.id)}
                            onDragEnd={handleDragEnd}
                          >
                            <GripVertical className="w-3 h-3 text-stone-300 shrink-0 cursor-grab mr-1" />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold">
                                ${formatNumber(p.amount)}{" "}
                                <span className="ml-1 text-xs text-stone-500">
                                  {p.category}
                                </span>
                              </div>
                              {p.accountId && (
                                <div className="text-[11px] text-stone-500 truncate">
                                  {renderAccountLabel(accounts, p.accountId, { iconClassName: "w-3 h-3" })}
                                </div>
                              )}
                              {p.note && (
                                <div className="text-xs text-stone-500 truncate">
                                  {p.note}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <button
                                className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors cursor-pointer handwriting h-7"
                                onClick={() => onMarkPlanPaid(p)}
                                title="Mark as paid"
                              >
                                ✓ Paid
                              </button>
                              {onUpdatePlan && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 hover:bg-amber-50 cursor-pointer"
                                  onClick={(e) => startEditingPlan(p, e)}
                                  title="Edit"
                                >
                                  <Pencil className="w-3.5 h-3.5 text-amber-600" />
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 hover:bg-red-50 cursor-pointer"
                                onClick={() => onRemovePlan(p.id)}
                                title="Delete"
                              >
                                <Trash className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="text-xs uppercase tracking-wide opacity-60 mt-2">
                    expenses
                  </div>
                  <div className="max-h-44 overflow-y-auto pr-1">
                    {listFor(d).length === 0 && (
                      <div className="text-sm text-stone-500 italic">
                        No expenses yet. Click the day to add one.
                      </div>
                    )}
                    {listFor(d).map((e) => (
                      <div
                        key={e.id}
                        className="rounded-xl border border-stone-200 bg-white px-2 py-1.5 mt-1 hover:shadow-sm transition-all"
                      >
                        {editingExpenseId === e.id ? (
                          // Inline edit mode
                          <div
                            className="space-y-2"
                            onClick={(ev) => ev.stopPropagation()}
                          >
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                value={editFormData.amount}
                                onChange={(ev) =>
                                  setEditFormData({
                                    ...editFormData,
                                    amount: ev.target.value,
                                  })
                                }
                                className="h-7 text-sm flex-1"
                                placeholder="Amount"
                                autoFocus
                                onClick={(ev) => ev.stopPropagation()}
                              />
                              <div className="flex-1" onClick={(ev) => ev.stopPropagation()}>
                                <CategoryPicker
                                  value={editFormData.category}
                                  onChange={(val) => setEditFormData({ ...editFormData, category: val })}
                                  useNameAsValue
                                  triggerClassName="h-7 text-sm"
                                  placeholder="Category"
                                />
                              </div>
                            </div>
                            <div onClick={(ev) => ev.stopPropagation()}>
                              <AccountInlineSelect
                                accounts={accounts}
                                value={editFormData.accountId}
                                onChange={(id) =>
                                  setEditFormData({
                                    ...editFormData,
                                    accountId: id,
                                  })
                                }
                              />
                            </div>
                            <Input
                              type="text"
                              value={editFormData.note}
                              onChange={(ev) =>
                                setEditFormData({
                                  ...editFormData,
                                  note: ev.target.value,
                                })
                              }
                              className="h-7 text-sm"
                              placeholder="Note"
                              onClick={(ev) => ev.stopPropagation()}
                            />
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={(ev) => saveExpenseEdit(e.id, ev)}
                                className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="text-xs px-2 py-1 bg-stone-300 text-stone-700 rounded hover:bg-stone-400 transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <X className="w-3 h-3" /> Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          // Display mode
                          <div
                            className="flex items-center justify-between"
                            draggable
                            onDragStart={(ev) => handleDragStart(ev, "expense", e.id)}
                            onDragEnd={handleDragEnd}
                          >
                            <GripVertical className="w-3 h-3 text-stone-300 shrink-0 cursor-grab mr-1" />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold">
                                ${formatNumber(e.amount)}{" "}
                                <span className="ml-1 text-xs text-stone-500">
                                  {e.category}
                                </span>
                              </div>
                              {e.accountId && (
                                <div className="text-[11px] text-stone-500 truncate">
                                  {renderAccountLabel(accounts, e.accountId, { iconClassName: "w-3 h-3" })}
                                </div>
                              )}
                              {e.note && (
                                <div className="text-xs text-stone-500 truncate">
                                  {e.note}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1">
                              {onUpdateExpense && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 hover:bg-amber-50 cursor-pointer"
                                  onClick={(ev) => startEditingExpense(e, ev)}
                                  title="Edit"
                                >
                                  <Pencil className="w-3.5 h-3.5 text-amber-600" />
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => onRemoveExpense(e.id)}
                                className="h-7 w-7 hover:bg-red-50 cursor-pointer"
                                title="Delete"
                              >
                                <Trash className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          );
        })}
      </div>
    </div>
  );
}
