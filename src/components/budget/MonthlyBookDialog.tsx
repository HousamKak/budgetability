import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { type Expense, type PlanItem } from "@/lib/data-service";
import { cn, dialogStyles } from "@/styles";
import { Check, Pencil, X } from "lucide-react";
import { useState } from "react";

interface MonthlyBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthLabel: string;
  expenses: Expense[];
  plans: PlanItem[];
  onMarkPlanPaid?: (plan: PlanItem) => void;
  onRemovePlan?: (planId: string) => void;
  onRemoveExpense?: (expenseId: string) => void;
  onEditExpense?: (expense: Expense) => void;
  onEditPlan?: (plan: PlanItem) => void;
  onUpdateExpense?: (expenseId: string, updates: Partial<Expense>) => void;
  onUpdatePlan?: (planId: string, updates: Partial<PlanItem>) => void;
}

export function MonthlyBookDialog({
  open,
  onOpenChange,
  monthLabel,
  expenses,
  plans,
  onMarkPlanPaid,
  onRemovePlan,
  onRemoveExpense,
  onEditExpense: _onEditExpense,
  onEditPlan: _onEditPlan,
  onUpdateExpense,
  onUpdatePlan,
}: MonthlyBookDialogProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    amount: string;
    category: string;
    note: string;
    date: string;
  }>({ amount: "", category: "", note: "", date: "" });

  const closeBook = () => {
    setCurrentPage(0);
    setIsFlipping(false);
    setEditingExpenseId(null);
    setEditingPlanId(null);
    onOpenChange(false);
  };

  const startEditingExpense = (expense: Expense) => {
    setEditingExpenseId(expense.id);
    setEditFormData({
      amount: expense.amount.toString(),
      category: expense.category || "",
      note: expense.note || "",
      date: expense.date,
    });
  };

  const startEditingPlan = (plan: PlanItem) => {
    setEditingPlanId(plan.id);
    setEditFormData({
      amount: plan.amount.toString(),
      category: plan.category || "",
      note: plan.note || "",
      date: plan.targetDate || "",
    });
  };

  const saveExpenseEdit = () => {
    if (editingExpenseId && onUpdateExpense) {
      const amount = parseFloat(editFormData.amount);
      if (!isNaN(amount) && amount > 0) {
        onUpdateExpense(editingExpenseId, {
          amount,
          category: editFormData.category,
          note: editFormData.note,
          date: editFormData.date,
        });
      }
    }
    setEditingExpenseId(null);
  };

  const savePlanEdit = () => {
    if (editingPlanId && onUpdatePlan) {
      const amount = parseFloat(editFormData.amount);
      if (!isNaN(amount) && amount > 0) {
        onUpdatePlan(editingPlanId, {
          amount,
          category: editFormData.category,
          note: editFormData.note,
          targetDate: editFormData.date,
        });
      }
    }
    setEditingPlanId(null);
  };

  const cancelEdit = () => {
    setEditingExpenseId(null);
    setEditingPlanId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{monthLabel} Monthly Ledger</DialogTitle>
          <DialogDescription>
            View and manage all your expenses and plans for {monthLabel}.
          </DialogDescription>
        </DialogHeader>
        <div className={cn(dialogStyles.paperDialog)}>
          {/* Paper texture overlay */}
          <div className={dialogStyles.paperTexture}></div>

          {/* Yellow transparent tape */}
          <div className={dialogStyles.yellowTape}></div>

          {/* Torn edge effect */}
          <div className={dialogStyles.tornEdge}></div>

          <div className={dialogStyles.contentWrapper}>
            {/* Book View */}
            <div className="relative min-h-[600px] p-4">
              {/* Book title */}
              <div className="text-center mb-8 relative z-10">
                <h2 className="text-2xl font-bold text-stone-700 handwriting mb-2">
                  📖 {monthLabel} Ledger
                </h2>
                <p className="text-sm text-stone-500 handwriting">
                  All your expenses and plans for the month
                </p>
              </div>

              {/* Book binding spine - positioned after title */}
              <div className="absolute left-1/2 top-24 bottom-0 w-2 bg-stone-400/20 transform -translate-x-1/2 shadow-inner rounded-full"></div>

              {/* Book pages with flip animation */}
              <div className="relative w-full h-full">
                {/* Page 0: Monthly Expenses */}
                {currentPage === 0 && (
                  <div
                    className={cn(
                      "grid grid-cols-2 gap-12 min-h-[480px] transition-all duration-300 transform",
                      isFlipping
                        ? "rotateY-90 opacity-0"
                        : "rotateY-0 opacity-100"
                    )}
                  >
                    {/* Left page - Expenses */}
                    <div className="relative bg-gradient-to-br from-red-50 via-white to-red-100 rounded-l-lg border-r border-stone-200/50 shadow-inner p-6">
                      <div className="absolute left-4 top-0 bottom-0 flex flex-col justify-evenly">
                        {Array.from({ length: 15 }).map((_, i) => (
                          <div
                            key={i}
                            className="w-2 h-2 rounded-full bg-stone-300/30"
                          ></div>
                        ))}
                      </div>

                      <div className="ml-6">
                        <h3 className="text-xl font-bold text-red-700 handwriting mb-4 border-b border-red-300/50 pb-2">
                          💸 Monthly Expenses
                        </h3>

                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 book-scroll book-scroll-red">
                          {expenses && expenses.length > 0 ? (
                            expenses.map((expense) => (
                              <div key={expense.id} className="py-1">
                                {editingExpenseId === expense.id ? (
                                  // Inline edit mode
                                  <div className="bg-amber-50 rounded p-2 space-y-2 border border-amber-300">
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
                                      />
                                      <Input
                                        type="text"
                                        value={editFormData.category}
                                        onChange={(e) =>
                                          setEditFormData({
                                            ...editFormData,
                                            category: e.target.value,
                                          })
                                        }
                                        className="h-7 text-sm flex-1"
                                        placeholder="Category"
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
                                    />
                                    <Input
                                      type="date"
                                      value={editFormData.date}
                                      onChange={(e) =>
                                        setEditFormData({
                                          ...editFormData,
                                          date: e.target.value,
                                        })
                                      }
                                      className="h-7 text-sm"
                                    />
                                    <div className="flex gap-1 justify-end">
                                      <button
                                        onClick={saveExpenseEdit}
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
                                  <div className="flex justify-between items-center">
                                    <div className="flex-1">
                                      <div className="handwriting text-red-600 text-sm leading-tight">
                                        <span className="font-bold">
                                          ${expense.amount.toFixed(2)}
                                        </span>
                                        {expense.category && (
                                          <span className="text-xs opacity-75 ml-2">
                                            {expense.category}
                                          </span>
                                        )}
                                        {expense.note && (
                                          <span className="text-xs text-stone-600 ml-2">
                                            • {expense.note}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-stone-400 handwriting">
                                        {new Date(
                                          expense.date
                                        ).toLocaleDateString()}
                                      </div>
                                    </div>
                                    {(onUpdateExpense || onRemoveExpense) && (
                                      <div className="flex gap-1 ml-2">
                                        {onUpdateExpense && (
                                          <button
                                            onClick={() =>
                                              startEditingExpense(expense)
                                            }
                                            className="text-xs px-1 py-0.5 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors cursor-pointer"
                                            title="Edit expense"
                                          >
                                            <Pencil className="w-3 h-3" />
                                          </button>
                                        )}
                                        {onRemoveExpense && (
                                          <button
                                            onClick={() =>
                                              onRemoveExpense(expense.id)
                                            }
                                            className="text-xs px-1 py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors cursor-pointer"
                                            title="Delete expense"
                                          >
                                            ✕
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-16 text-red-400">
                              <div className="text-3xl mb-2">📝</div>
                              <p className="handwriting">
                                No expenses this month
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right page - Plans */}
                    <div className="relative bg-gradient-to-br from-blue-50 via-white to-blue-100 rounded-r-lg shadow-inner p-6">
                      <div className="absolute right-4 top-0 bottom-0 flex flex-col justify-evenly">
                        {Array.from({ length: 15 }).map((_, i) => (
                          <div
                            key={i}
                            className="w-2 h-2 rounded-full bg-stone-300/30"
                          ></div>
                        ))}
                      </div>

                      <div className="mr-6">
                        <h3 className="text-xl font-bold text-blue-700 handwriting mb-4 border-b border-blue-300/50 pb-2">
                          📋 Monthly Plans
                        </h3>

                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 book-scroll book-scroll-blue">
                          {plans && plans.length > 0 ? (
                            plans.map((plan) => (
                              <div key={plan.id} className="py-1">
                                {editingPlanId === plan.id ? (
                                  // Inline edit mode
                                  <div className="bg-amber-50 rounded p-2 space-y-2 border border-amber-300">
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
                                      />
                                      <Input
                                        type="text"
                                        value={editFormData.category}
                                        onChange={(e) =>
                                          setEditFormData({
                                            ...editFormData,
                                            category: e.target.value,
                                          })
                                        }
                                        className="h-7 text-sm flex-1"
                                        placeholder="Category"
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
                                    />
                                    <Input
                                      type="date"
                                      value={editFormData.date}
                                      onChange={(e) =>
                                        setEditFormData({
                                          ...editFormData,
                                          date: e.target.value,
                                        })
                                      }
                                      className="h-7 text-sm"
                                    />
                                    <div className="flex gap-1 justify-end">
                                      <button
                                        onClick={savePlanEdit}
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
                                  <div className="flex justify-between items-center">
                                    <div className="flex-1">
                                      <div className="handwriting text-blue-600 text-sm leading-tight">
                                        <span className="font-bold">
                                          ${plan.amount.toFixed(2)}
                                        </span>
                                        {plan.category && (
                                          <span className="text-xs opacity-75 ml-2">
                                            {plan.category}
                                          </span>
                                        )}
                                        {plan.note && (
                                          <span className="text-xs text-stone-600 ml-2">
                                            • {plan.note}
                                          </span>
                                        )}
                                      </div>
                                      {plan.targetDate && (
                                        <div className="text-xs text-stone-400 handwriting">
                                          {new Date(
                                            plan.targetDate
                                          ).toLocaleDateString()}
                                        </div>
                                      )}
                                    </div>
                                    {(onUpdatePlan ||
                                      onMarkPlanPaid ||
                                      onRemovePlan) && (
                                      <div className="flex gap-1 ml-2">
                                        {onUpdatePlan && (
                                          <button
                                            onClick={() =>
                                              startEditingPlan(plan)
                                            }
                                            className="text-xs px-1 py-0.5 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors cursor-pointer"
                                            title="Edit plan"
                                          >
                                            <Pencil className="w-3 h-3" />
                                          </button>
                                        )}
                                        {onMarkPlanPaid && (
                                          <button
                                            onClick={() => onMarkPlanPaid(plan)}
                                            className="text-xs px-1 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors cursor-pointer"
                                            title="Mark as paid"
                                          >
                                            ✓
                                          </button>
                                        )}
                                        {onRemovePlan && (
                                          <button
                                            onClick={() =>
                                              onRemovePlan(plan.id)
                                            }
                                            className="text-xs px-1 py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors cursor-pointer"
                                            title="Delete plan"
                                          >
                                            ✕
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-16 text-blue-400">
                              <div className="text-3xl mb-2">📝</div>
                              <p className="handwriting">No plans this month</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Book action buttons */}
            <div className="flex justify-center items-center mt-6 pt-4 border-t border-stone-200/50">
              <Button
                variant="outline"
                onClick={closeBook}
                className="handwriting text-stone-600 border-stone-300 hover:bg-stone-50 cursor-pointer"
              >
                ← Close Monthly Book
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
