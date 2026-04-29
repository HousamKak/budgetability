import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Account, type Expense, type PlanItem } from "@/lib/data-service";
import { formatNumber } from "@/lib/utils";
import { cn, dialogStyles } from "@/styles";
import { Check, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import { CategoryPicker } from "./CategoryPicker";
import { CategoryIcon } from "./CategoryIcon";
import {
  AccountInlineSelect,
  renderAccountLabel,
} from "./AccountInlineSelect";
import { getAccountTypeConfig } from "@/components/accounts/AccountTypeBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DialogMode = "expense" | "plan";

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formDate: string;
  onFormDateChange: (date: string) => void;
  amount: string;
  onAmountChange: (amount: string) => void;
  category: string;
  onCategoryChange: (category: string) => void;
  note: string;
  onNoteChange: (note: string) => void;
  accountId: string;
  onAccountIdChange: (accountId: string) => void;
  accounts: Account[];
  onSubmit: () => void;
  onSubmitPlan?: (planData: {
    date: string;
    amount: number;
    category: string;
    accountId?: string;
    note: string;
  }) => void;
  dayExpenses?: Array<{
    id: string;
    amount: number;
    category?: string;
    accountId?: string;
    note?: string;
    date?: string;
  }>;
  dayPlans?: PlanItem[];
  onMarkPlanPaid?: (plan: PlanItem) => void;
  onRemovePlan?: (planId: string) => void;
  onRemoveExpense?: (expenseId: string) => void;
  // Edit functionality
  editingExpense?: Expense | null;
  editingPlan?: PlanItem | null;
  onUpdateExpense?: (id: string, updates: Partial<Expense>) => void;
  onUpdatePlan?: (id: string, updates: Partial<PlanItem>) => void;
  onInlineUpdateExpense?: (id: string, updates: Partial<Expense>) => void;
  onInlineUpdatePlan?: (id: string, updates: Partial<PlanItem>) => void;
  onEditExpense?: (expense: Expense) => void;
  onEditPlan?: (plan: PlanItem) => void;
}

export function ExpenseDialog({
  open,
  onOpenChange,
  formDate,
  onFormDateChange,
  amount,
  onAmountChange,
  category,
  onCategoryChange,
  note,
  onNoteChange,
  accountId,
  onAccountIdChange,
  accounts,
  onSubmit,
  onSubmitPlan,
  dayExpenses = [],
  dayPlans = [],
  onMarkPlanPaid,
  onRemovePlan,
  onRemoveExpense,
  editingExpense,
  editingPlan,
  onUpdateExpense,
  onUpdatePlan,
  onInlineUpdateExpense,
  onInlineUpdatePlan,
  onEditExpense: _onEditExpense,
  onEditPlan: _onEditPlan,
}: ExpenseDialogProps) {
  const [mode, setMode] = useState<DialogMode>("expense");
  const [bookMode, setBookMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);

  // Inline editing state for book view
  const [inlineEditingExpenseId, setInlineEditingExpenseId] = useState<
    string | null
  >(null);
  const [inlineEditingPlanId, setInlineEditingPlanId] = useState<string | null>(
    null
  );
  const [inlineEditFormData, setInlineEditFormData] = useState<{
    amount: string;
    category: string;
    accountId: string;
    note: string;
  }>({ amount: "", category: "", accountId: "", note: "" });

  // Inline editing handlers
  const startInlineEditingExpense = (expense: Expense) => {
    setInlineEditingExpenseId(expense.id);
    setInlineEditingPlanId(null);
    setInlineEditFormData({
      amount: expense.amount.toString(),
      category: expense.category || "",
      accountId: expense.accountId || "",
      note: expense.note || "",
    });
  };

  const startInlineEditingPlan = (plan: PlanItem) => {
    setInlineEditingPlanId(plan.id);
    setInlineEditingExpenseId(null);
    setInlineEditFormData({
      amount: plan.amount.toString(),
      category: plan.category || "",
      accountId: plan.accountId || "",
      note: plan.note || "",
    });
  };

  const saveInlineExpenseEdit = (expenseId: string) => {
    const updateFn = onInlineUpdateExpense || onUpdateExpense;
    if (updateFn) {
      const amount = parseFloat(inlineEditFormData.amount);
      if (!isNaN(amount) && amount > 0) {
        updateFn(expenseId, {
          amount,
          category: inlineEditFormData.category,
          accountId: inlineEditFormData.accountId || undefined,
          note: inlineEditFormData.note,
        });
      }
    }
    setInlineEditingExpenseId(null);
  };

  const saveInlinePlanEdit = (planId: string) => {
    const updateFn = onInlineUpdatePlan || onUpdatePlan;
    if (updateFn) {
      const amount = parseFloat(inlineEditFormData.amount);
      if (!isNaN(amount) && amount > 0) {
        updateFn(planId, {
          amount,
          category: inlineEditFormData.category,
          accountId: inlineEditFormData.accountId || undefined,
          note: inlineEditFormData.note,
        });
      }
    }
    setInlineEditingPlanId(null);
  };

  const cancelInlineEdit = () => {
    setInlineEditingExpenseId(null);
    setInlineEditingPlanId(null);
  };

  // Clear selected account if amount exceeds its available balance.
  // When editing, the original amount is already deducted from the balance,
  // so we only need to check if the *additional* cost is affordable.
  // Plans target a future payment, so today's balance is not a real
  // constraint — don't auto-clear in plan mode.
  useEffect(() => {
    if (mode !== "expense") return;
    if (!accountId) return;
    const parsedAmount = parseFloat(amount) || 0;
    if (parsedAmount <= 0) return;
    const selectedAccount = accounts.find((a) => a.id === accountId);
    if (!selectedAccount) return;
    const originalAmount = editingExpense?.accountId === accountId ? editingExpense.amount : 0;
    const effectiveBalance = selectedAccount.currentBalance + originalAmount;
    if (effectiveBalance < parsedAmount) {
      onAccountIdChange("");
    }
  }, [amount, accountId, accounts, onAccountIdChange, editingExpense, mode]);

  // Determine if we're in edit mode
  const isEditing = !!(editingExpense || editingPlan);

  // Set mode based on what we're editing
  useEffect(() => {
    if (editingExpense) {
      setMode("expense");
    } else if (editingPlan) {
      setMode("plan");
    }
  }, [editingExpense, editingPlan]);

  const handleSubmit = () => {
    if (isEditing) {
      // Update mode
      const a = Number(amount);
      if (isNaN(a) || a <= 0) return;

      if (editingExpense && onUpdateExpense) {
        onUpdateExpense(editingExpense.id, {
          date: formDate,
          amount: Number(a.toFixed(2)),
          category,
          accountId: accountId || undefined,
          note,
        });
      } else if (editingPlan && onUpdatePlan) {
        onUpdatePlan(editingPlan.id, {
          targetDate: formDate,
          amount: Number(a.toFixed(2)),
          category,
          accountId: accountId || undefined,
          note,
        });
      }
    } else if (mode === "expense") {
      onSubmit();
    } else {
      // Plan mode
      const a = Number(amount);
      if (!formDate || isNaN(a) || a <= 0 || !onSubmitPlan) return;
      onSubmitPlan({
        date: formDate,
        amount: Number(a.toFixed(2)),
        category,
        accountId: accountId || undefined,
        note,
      });
    }
  };

  const openBook = () => {
    setBookMode(true);
    setCurrentPage(0);
  };

  const closeBook = () => {
    setBookMode(false);
    setCurrentPage(0);
    setIsFlipping(false);
  };

  const flipPage = (targetPage: number) => {
    if (isFlipping || targetPage === currentPage) return;
    setIsFlipping(true);
    setTimeout(() => {
      setCurrentPage(targetPage);
      setIsFlipping(false);
    }, 300);
  };

  // Dynamic styles based on mode
  const modeStyles = {
    expense: {
      borderColor: "border-red-300 bg-red-50/80",
      titleColor: "text-red-700",
      buttonColor: "bg-red-600 hover:bg-red-700 text-white",
    },
    plan: {
      borderColor: "border-blue-300 bg-blue-50/80",
      titleColor: "text-blue-700",
      buttonColor: "bg-blue-600 hover:bg-blue-700 text-white",
    },
  };

  const currentStyles = modeStyles[mode];

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(newOpen) => {
          onOpenChange(newOpen);
          // Clear any lingering focus when dialog closes
          if (!newOpen) {
            setTimeout(() => document.body.focus(), 0);
          }
        }}
      >
        <DialogContent
          className={cn("sm:max-w-md p-0 gap-0", bookMode && "sm:max-w-4xl")}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>
              {isEditing
                ? `Edit ${editingExpense ? "Expense" : "Plan"}`
                : bookMode
                ? "Budget Book"
                : `Add ${mode === "expense" ? "Expense" : "Plan"}`}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the details of your expense or plan."
                : bookMode
                ? "View and manage your budget entries."
                : mode === "expense"
                ? "Record a new expense."
                : "Create a new budget plan."}
            </DialogDescription>
          </DialogHeader>
          <div
            className={cn(
              dialogStyles.paperDialog,
              !bookMode && mode === "expense"
                ? "!border-red-300/80 bg-red-50/20"
                : !bookMode && mode === "plan"
                ? "!border-blue-300/80 bg-blue-50/20"
                : ""
            )}
          >
            {/* Paper texture overlay */}
            <div className={dialogStyles.paperTexture}></div>

            {/* Yellow transparent tape */}
            <div className={dialogStyles.yellowTape}></div>

            {/* Torn edge effect */}
            <div className={dialogStyles.tornEdge}></div>

            <div className={dialogStyles.contentWrapper}>
              {!bookMode ? (
                <>
                  {/* Simple Modal - Default View */}
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-stone-700 handwriting mb-2">
                      {isEditing ? (
                        <>
                          <span
                            className={
                              editingExpense ? "text-red-600" : "text-blue-600"
                            }
                          >
                            Editing {editingExpense ? "Expense" : "Plan"}
                          </span>{" "}
                          for{" "}
                        </>
                      ) : (
                        "Quick Add for "
                      )}
                      <span className="text-amber-600 underline decoration-wavy decoration-2">
                        {new Date(formDate).toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </h2>
                  </div>

                  {/* Mode Selection Buttons - hidden when editing */}
                  {!isEditing && (
                    <div className="flex gap-3 mb-6">
                      <button
                        type="button"
                        onClick={() => setMode("expense")}
                        className={cn(
                          "flex-1 p-4 rounded-lg border-2 transition-all duration-300 cursor-pointer",
                          "bg-gradient-to-br from-red-50 to-red-100",
                          mode === "expense"
                            ? "border-red-400 shadow-md ring-2 ring-red-200"
                            : "border-red-200 hover:border-red-300"
                        )}
                      >
                        <div className="text-center">
                          <div className="text-2xl mb-1">💸</div>
                          <p className="text-sm font-medium text-red-700 handwriting">
                            Expense
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMode("plan")}
                        className={cn(
                          "flex-1 p-4 rounded-lg border-2 transition-all duration-300 cursor-pointer",
                          "bg-gradient-to-br from-blue-50 to-blue-100",
                          mode === "plan"
                            ? "border-blue-400 shadow-md ring-2 ring-blue-200"
                            : "border-blue-200 hover:border-blue-300"
                        )}
                      >
                        <div className="text-center">
                          <div className="text-2xl mb-1">📋</div>
                          <p className="text-sm font-medium text-blue-700 handwriting">
                            Plan
                          </p>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Simple Form */}
                  <div className="space-y-4 mb-6">
                    <div className={dialogStyles.form.fieldContainer}>
                      <Label htmlFor="date" className={dialogStyles.form.label}>
                        Date
                      </Label>
                      <Input
                        id="date"
                        type="date"
                        value={formDate}
                        onChange={(e) => onFormDateChange(e.target.value)}
                        autoComplete="off"
                        className={cn(
                          "date-input-stable",
                          dialogStyles.form.input
                        )}
                      />
                    </div>
                    <div className={dialogStyles.form.fieldContainer}>
                      <Label
                        htmlFor="amount"
                        className={dialogStyles.form.label}
                      >
                        Amount
                      </Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => onAmountChange(e.target.value)}
                        autoFocus
                        inputMode="decimal"
                        className={dialogStyles.form.input}
                      />
                    </div>
                    <div className={dialogStyles.form.fieldContainer}>
                      <Label className={dialogStyles.form.label}>
                        Category
                      </Label>
                      <CategoryPicker
                        value={category}
                        onChange={(val) => onCategoryChange(val)}
                        useNameAsValue
                        triggerClassName={dialogStyles.form.input}
                        placeholder="Pick one"
                      />
                    </div>
                    {accounts.length > 0 && (
                      <div className={dialogStyles.form.fieldContainer}>
                        <Label className={dialogStyles.form.label}>
                          {mode === "expense" ? "Pay from" : "Will pay from"}
                        </Label>
                        <Select
                          value={accountId || "__none__"}
                          onValueChange={(v) => onAccountIdChange(v === "__none__" ? "" : v)}
                        >
                          <SelectTrigger className={cn(dialogStyles.form.input, "h-10")}>
                            <SelectValue>
                              {accountId ? (() => {
                                const acc = accounts.find((a) => a.id === accountId);
                                if (!acc) return "No account";
                                const typeConfig = getAccountTypeConfig(acc.accountType);
                                const iconName = acc.icon || ({ checking: "building-2", savings: "piggy-bank", credit: "credit-card", cash: "banknote", other: "wallet" }[acc.accountType]);
                                return (
                                  <span className="flex items-center gap-2">
                                    <CategoryIcon name={iconName} className="w-4 h-4 shrink-0" style={{ color: typeConfig.color }} />
                                    <span>{acc.name}{acc.isDefault ? " ★" : ""}</span>
                                  </span>
                                );
                              })() : "No account"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">No account</SelectItem>
                            {accounts
                              .slice()
                              .sort((a, b) => (a.isDefault ? -1 : b.isDefault ? 1 : 0))
                              .map((acc) => {
                                const parsedAmount = parseFloat(amount) || 0;
                                const originalAmount = editingExpense?.accountId === acc.id ? editingExpense.amount : 0;
                                const effectiveBalance = acc.currentBalance + originalAmount;
                                const insufficientFunds = parsedAmount > 0 && effectiveBalance < parsedAmount;
                                // For plans (future payments) the current balance is not a real
                                // constraint, so don't disable — show a soft warning instead.
                                const disableForInsufficient = mode === "expense" && insufficientFunds;
                                const typeConfig = getAccountTypeConfig(acc.accountType);
                                const iconName = acc.icon || ({ checking: "building-2", savings: "piggy-bank", credit: "credit-card", cash: "banknote", other: "wallet" }[acc.accountType]);
                                return (
                                  <SelectItem key={acc.id} value={acc.id} disabled={disableForInsufficient}>
                                    <span className={cn("flex items-center gap-2", disableForInsufficient && "opacity-50")}>
                                      <CategoryIcon name={iconName} className="w-4 h-4 shrink-0" style={{ color: typeConfig.color }} />
                                      <span>{acc.name}{acc.isDefault ? " ★" : ""}</span>
                                      {insufficientFunds && (
                                        <span className={cn("text-xs", mode === "expense" ? "text-red-500" : "text-amber-500")}>
                                          {mode === "expense" ? "(insufficient)" : "(low balance)"}
                                        </span>
                                      )}
                                    </span>
                                  </SelectItem>
                                );
                              })}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className={dialogStyles.form.fieldContainer}>
                      <Label htmlFor="note" className={dialogStyles.form.label}>
                        {mode === "expense"
                          ? "Note (optional)"
                          : "Plan description (optional)"}
                      </Label>
                      <Input
                        id="note"
                        value={note}
                        onChange={(e) => onNoteChange(e.target.value)}
                        placeholder={
                          mode === "expense"
                            ? "e.g., market, taxi, dinner"
                            : "e.g., birthday gift, vacation fund"
                        }
                        className={dialogStyles.form.input}
                      />
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex justify-between items-center">
                    {!isEditing ? (
                      <Button
                        variant="outline"
                        onClick={openBook}
                        className="handwriting text-amber-700 border-amber-300 hover:bg-amber-50 cursor-pointer"
                      >
                        📖 Open Book
                      </Button>
                    ) : (
                      <div /> /* Spacer */
                    )}

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className={dialogStyles.buttons.secondary}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        className={cn(
                          "cursor-pointer handwriting",
                          currentStyles.buttonColor
                        )}
                      >
                        {isEditing
                          ? mode === "expense"
                            ? "Update Expense ✓"
                            : "Update Plan ✓"
                          : mode === "expense"
                          ? "Save Expense 💰"
                          : "Save Plan 📝"}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Book View */}
                  <div className="relative min-h-[500px] p-4">
                    {/* Book binding spine */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-2 bg-stone-400/20 transform -translate-x-1/2 shadow-inner rounded-full"></div>

                    {/* Book pages with flip animation */}
                    <div className="relative w-full h-full">
                      {/* Page 0: Mode selection and form */}
                      {currentPage === 0 && (
                        <div
                          className={cn(
                            "grid grid-cols-2 gap-8 min-h-[450px] transition-all duration-300 transform",
                            isFlipping
                              ? "rotateY-90 opacity-0"
                              : "rotateY-0 opacity-100"
                          )}
                        >
                          {/* Left page - Mode selection */}
                          <div className="relative bg-gradient-to-br from-amber-50 via-white to-amber-100 rounded-l-lg border-r border-stone-200/50 shadow-inner p-4">
                            <div className="absolute left-3 top-0 bottom-0 flex flex-col justify-evenly">
                              {Array.from({ length: 12 }).map((_, i) => (
                                <div
                                  key={i}
                                  className="w-2 h-2 rounded-full bg-stone-300/40"
                                ></div>
                              ))}
                            </div>

                            <div className="ml-4">
                              <h3 className="text-xl font-bold text-stone-700 handwriting mb-6 border-b border-stone-300/50 pb-2">
                                Choose Your Action
                              </h3>

                              <div className="space-y-4">
                                <button
                                  type="button"
                                  onClick={() => setMode("expense")}
                                  className={cn(
                                    "w-full p-4 rounded-lg border-2 transition-all duration-200",
                                    "bg-gradient-to-r from-red-50 to-red-100",
                                    mode === "expense"
                                      ? "border-red-400 shadow-lg ring-2 ring-red-200 scale-105"
                                      : "border-red-200 hover:border-red-300 hover:scale-102"
                                  )}
                                >
                                  <div className="text-left">
                                    <div className="flex items-center gap-3 mb-2">
                                      <span className="text-3xl">💸</span>
                                      <h4 className="text-lg font-bold text-red-700 handwriting">
                                        Record Expense
                                      </h4>
                                    </div>
                                    <p className="text-sm text-red-600 handwriting">
                                      Something you already spent money on
                                    </p>
                                  </div>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setMode("plan")}
                                  className={cn(
                                    "w-full p-4 rounded-lg border-2 transition-all duration-200",
                                    "bg-gradient-to-r from-blue-50 to-blue-100",
                                    mode === "plan"
                                      ? "border-blue-400 shadow-lg ring-2 ring-blue-200 scale-105"
                                      : "border-blue-200 hover:border-blue-300 hover:scale-102"
                                  )}
                                >
                                  <div className="text-left">
                                    <div className="flex items-center gap-3 mb-2">
                                      <span className="text-3xl">📋</span>
                                      <h4 className="text-lg font-bold text-blue-700 handwriting">
                                        Plan Ahead
                                      </h4>
                                    </div>
                                    <p className="text-sm text-blue-600 handwriting">
                                      Something you're planning to buy
                                    </p>
                                  </div>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Right page - Form */}
                          <div className="relative bg-gradient-to-br from-white via-amber-50 to-amber-100 rounded-r-lg shadow-inner p-4">
                            <div className="absolute right-3 top-0 bottom-0 flex flex-col justify-evenly">
                              {Array.from({ length: 12 }).map((_, i) => (
                                <div
                                  key={i}
                                  className="w-2 h-2 rounded-full bg-stone-300/40"
                                ></div>
                              ))}
                            </div>

                            <div className="mr-4">
                              <div className="text-center mb-6">
                                <div
                                  className={cn(
                                    "inline-flex items-center gap-2 px-4 py-2 rounded-full border shadow-sm handwriting",
                                    mode === "expense"
                                      ? "bg-red-50 border-red-200 text-red-700"
                                      : "bg-blue-50 border-blue-200 text-blue-700"
                                  )}
                                >
                                  <span className="text-xl">
                                    {mode === "expense" ? "💸" : "📋"}
                                  </span>
                                  <span className="text-sm font-medium">
                                    {mode === "expense"
                                      ? "New Expense"
                                      : "New Plan"}
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div
                                  className={dialogStyles.form.fieldContainer}
                                >
                                  <Label
                                    htmlFor="book-date"
                                    className={dialogStyles.form.label}
                                  >
                                    Date
                                  </Label>
                                  <Input
                                    id="book-date"
                                    type="date"
                                    value={formDate}
                                    onChange={(e) =>
                                      onFormDateChange(e.target.value)
                                    }
                                    className={cn(
                                      "date-input-stable",
                                      dialogStyles.form.input
                                    )}
                                  />
                                </div>
                                <div
                                  className={dialogStyles.form.fieldContainer}
                                >
                                  <Label
                                    htmlFor="book-amount"
                                    className={dialogStyles.form.label}
                                  >
                                    Amount
                                  </Label>
                                  <Input
                                    id="book-amount"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={(e) =>
                                      onAmountChange(e.target.value)
                                    }
                                    className={dialogStyles.form.input}
                                  />
                                </div>
                                <div
                                  className={dialogStyles.form.fieldContainer}
                                >
                                  <Label className={dialogStyles.form.label}>
                                    Category
                                  </Label>
                                  <CategoryPicker
                                    value={category}
                                    onChange={(val) => onCategoryChange(val)}
                                    useNameAsValue
                                    triggerClassName={dialogStyles.form.input}
                                    placeholder="Pick one"
                                  />
                                </div>
                                <div
                                  className={dialogStyles.form.fieldContainer}
                                >
                                  <Label
                                    htmlFor="book-note"
                                    className={dialogStyles.form.label}
                                  >
                                    Note (optional)
                                  </Label>
                                  <Input
                                    id="book-note"
                                    value={note}
                                    onChange={(e) =>
                                      onNoteChange(e.target.value)
                                    }
                                    placeholder="Add a note..."
                                    className={dialogStyles.form.input}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Page 1: Today's entries */}
                      {currentPage === 1 && (
                        <div
                          className={cn(
                            "grid grid-cols-2 gap-8 min-h-[450px] transition-all duration-300 transform",
                            isFlipping
                              ? "rotateY-90 opacity-0"
                              : "rotateY-0 opacity-100"
                          )}
                        >
                          {/* Left page - Today's Expenses */}
                          <div className="relative bg-gradient-to-br from-red-50 via-white to-red-100 rounded-l-lg border-r border-stone-200/50 shadow-inner p-4">
                            <div className="absolute left-3 top-0 bottom-0 flex flex-col justify-evenly">
                              {Array.from({ length: 12 }).map((_, i) => (
                                <div
                                  key={i}
                                  className="w-2 h-2 rounded-full bg-stone-300/40"
                                ></div>
                              ))}
                            </div>

                            <div className="ml-4">
                              <h3 className="text-xl font-bold text-red-700 handwriting mb-6 border-b border-red-300/50 pb-2 flex items-center gap-2">
                                💸 Today's Expenses
                              </h3>

                              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 book-scroll book-scroll-red">
                                {dayExpenses && dayExpenses.length > 0 ? (
                                  dayExpenses.map((expense, index) => (
                                    <div key={expense.id} className="relative">
                                      {inlineEditingExpenseId === expense.id ? (
                                        // Inline edit mode
                                        <div className="bg-amber-50 p-3 rounded-lg border border-amber-300 space-y-2">
                                          <div className="flex gap-2">
                                            <Input
                                              type="number"
                                              value={inlineEditFormData.amount}
                                              onChange={(e) =>
                                                setInlineEditFormData({
                                                  ...inlineEditFormData,
                                                  amount: e.target.value,
                                                })
                                              }
                                              className="h-7 text-sm flex-1"
                                              placeholder="Amount"
                                              autoFocus
                                            />
                                            <div className="flex-1">
                                              <CategoryPicker
                                                value={inlineEditFormData.category}
                                                onChange={(val) => setInlineEditFormData({ ...inlineEditFormData, category: val })}
                                                useNameAsValue
                                                triggerClassName="h-7 text-sm"
                                                placeholder="Category"
                                              />
                                            </div>
                                          </div>
                                          <AccountInlineSelect
                                            accounts={accounts}
                                            value={inlineEditFormData.accountId}
                                            onChange={(id) =>
                                              setInlineEditFormData({
                                                ...inlineEditFormData,
                                                accountId: id,
                                              })
                                            }
                                          />
                                          <Input
                                            type="text"
                                            value={inlineEditFormData.note}
                                            onChange={(e) =>
                                              setInlineEditFormData({
                                                ...inlineEditFormData,
                                                note: e.target.value,
                                              })
                                            }
                                            className="h-7 text-sm"
                                            placeholder="Note"
                                          />
                                          <div className="flex gap-1 justify-end">
                                            <button
                                              onClick={() =>
                                                saveInlineExpenseEdit(
                                                  expense.id
                                                )
                                              }
                                              className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors cursor-pointer flex items-center gap-1"
                                            >
                                              <Check className="w-3 h-3" /> Save
                                            </button>
                                            <button
                                              onClick={cancelInlineEdit}
                                              className="text-xs px-2 py-1 bg-stone-300 text-stone-700 rounded hover:bg-stone-400 transition-colors cursor-pointer flex items-center gap-1"
                                            >
                                              <X className="w-3 h-3" /> Cancel
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        // Display mode - Handwritten note style
                                        <div
                                          className="bg-white/80 p-3 rounded-sm shadow-sm transform rotate-1 hover:rotate-0 transition-transform duration-200"
                                          style={{
                                            transform: `rotate(${
                                              (index % 2 === 0 ? 1 : -1) *
                                              (0.5 + Math.random() * 0.5)
                                            }deg)`,
                                          }}
                                        >
                                          <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                              <div className="handwriting text-red-600 text-base leading-relaxed">
                                                <span className="font-bold">
                                                  $
                                                  {formatNumber(expense.amount)}
                                                </span>
                                                {expense.category && (
                                                  <span className="text-sm opacity-75">
                                                    {" "}
                                                    • {expense.category}
                                                  </span>
                                                )}
                                              </div>
                                              {expense.accountId && (
                                                <p className="handwriting text-stone-500 text-xs mt-0.5 leading-tight">
                                                  {renderAccountLabel(accounts, expense.accountId)}
                                                </p>
                                              )}
                                              {expense.note && (
                                                <p className="handwriting text-stone-600 text-sm mt-1 leading-relaxed">
                                                  {expense.note}
                                                </p>
                                              )}
                                            </div>
                                            {(onUpdateExpense ||
                                              onRemoveExpense) && (
                                              <div className="flex gap-1 ml-2 flex-shrink-0">
                                                {onUpdateExpense && (
                                                  <button
                                                    onClick={() =>
                                                      startInlineEditingExpense(
                                                        expense as Expense
                                                      )
                                                    }
                                                    className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors cursor-pointer handwriting"
                                                    title="Edit expense"
                                                  >
                                                    <Pencil className="w-3 h-3" />
                                                  </button>
                                                )}
                                                {onRemoveExpense && (
                                                  <button
                                                    onClick={() =>
                                                      onRemoveExpense(
                                                        expense.id
                                                      )
                                                    }
                                                    className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors cursor-pointer handwriting"
                                                    title="Delete expense"
                                                  >
                                                    ✕
                                                  </button>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-center py-12 text-red-400">
                                    <div className="text-4xl mb-2">📝</div>
                                    <p className="handwriting text-lg">
                                      No expenses today
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right page - Today's Plans */}
                          <div className="relative bg-gradient-to-br from-blue-50 via-white to-blue-100 rounded-r-lg shadow-inner p-4">
                            <div className="absolute right-3 top-0 bottom-0 flex flex-col justify-evenly">
                              {Array.from({ length: 12 }).map((_, i) => (
                                <div
                                  key={i}
                                  className="w-2 h-2 rounded-full bg-stone-300/40"
                                ></div>
                              ))}
                            </div>

                            <div className="mr-4">
                              <h3 className="text-xl font-bold text-blue-700 handwriting mb-6 border-b border-blue-300/50 pb-2 flex items-center gap-2">
                                📋 Today's Plans
                              </h3>

                              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 book-scroll book-scroll-blue">
                                {dayPlans && dayPlans.length > 0 ? (
                                  dayPlans.map((plan, index) => (
                                    <div key={plan.id} className="relative">
                                      {inlineEditingPlanId === plan.id ? (
                                        // Inline edit mode
                                        <div className="bg-amber-50 p-3 rounded-lg border border-amber-300 space-y-2">
                                          <div className="flex gap-2">
                                            <Input
                                              type="number"
                                              value={inlineEditFormData.amount}
                                              onChange={(e) =>
                                                setInlineEditFormData({
                                                  ...inlineEditFormData,
                                                  amount: e.target.value,
                                                })
                                              }
                                              className="h-7 text-sm flex-1"
                                              placeholder="Amount"
                                              autoFocus
                                            />
                                            <div className="flex-1">
                                              <CategoryPicker
                                                value={inlineEditFormData.category}
                                                onChange={(val) => setInlineEditFormData({ ...inlineEditFormData, category: val })}
                                                useNameAsValue
                                                triggerClassName="h-7 text-sm"
                                                placeholder="Category"
                                              />
                                            </div>
                                          </div>
                                          <AccountInlineSelect
                                            accounts={accounts}
                                            value={inlineEditFormData.accountId}
                                            onChange={(id) =>
                                              setInlineEditFormData({
                                                ...inlineEditFormData,
                                                accountId: id,
                                              })
                                            }
                                          />
                                          <Input
                                            type="text"
                                            value={inlineEditFormData.note}
                                            onChange={(e) =>
                                              setInlineEditFormData({
                                                ...inlineEditFormData,
                                                note: e.target.value,
                                              })
                                            }
                                            className="h-7 text-sm"
                                            placeholder="Note"
                                          />
                                          <div className="flex gap-1 justify-end">
                                            <button
                                              onClick={() =>
                                                saveInlinePlanEdit(plan.id)
                                              }
                                              className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors cursor-pointer flex items-center gap-1"
                                            >
                                              <Check className="w-3 h-3" /> Save
                                            </button>
                                            <button
                                              onClick={cancelInlineEdit}
                                              className="text-xs px-2 py-1 bg-stone-300 text-stone-700 rounded hover:bg-stone-400 transition-colors cursor-pointer flex items-center gap-1"
                                            >
                                              <X className="w-3 h-3" /> Cancel
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        // Display mode - Handwritten note style
                                        <div
                                          className="bg-white/80 p-3 rounded-sm shadow-sm transform hover:rotate-0 transition-transform duration-200"
                                          style={{
                                            transform: `rotate(${
                                              (index % 2 === 0 ? -1 : 1) *
                                              (0.5 + Math.random() * 0.5)
                                            }deg)`,
                                          }}
                                        >
                                          <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                              <div className="handwriting text-blue-600 text-base leading-relaxed">
                                                <span className="font-bold">
                                                  ${formatNumber(plan.amount)}
                                                </span>
                                                {plan.category && (
                                                  <span className="text-sm opacity-75">
                                                    {" "}
                                                    • {plan.category}
                                                  </span>
                                                )}
                                              </div>
                                              {plan.accountId && (
                                                <p className="handwriting text-stone-500 text-xs mt-0.5 leading-tight">
                                                  {renderAccountLabel(accounts, plan.accountId)}
                                                </p>
                                              )}
                                              {plan.note && (
                                                <p className="handwriting text-stone-600 text-sm mt-1 leading-relaxed">
                                                  {plan.note}
                                                </p>
                                              )}
                                            </div>
                                            {(onUpdatePlan ||
                                              onMarkPlanPaid ||
                                              onRemovePlan) && (
                                              <div className="flex gap-1 ml-2 flex-shrink-0">
                                                {onUpdatePlan && (
                                                  <button
                                                    onClick={() =>
                                                      startInlineEditingPlan(
                                                        plan
                                                      )
                                                    }
                                                    className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors cursor-pointer handwriting"
                                                    title="Edit plan"
                                                  >
                                                    <Pencil className="w-3 h-3" />
                                                  </button>
                                                )}
                                                {onMarkPlanPaid && (
                                                  <button
                                                    onClick={() =>
                                                      onMarkPlanPaid(plan)
                                                    }
                                                    className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors cursor-pointer handwriting"
                                                    title="Mark as paid"
                                                  >
                                                    ✓ Paid
                                                  </button>
                                                )}
                                                {onRemovePlan && (
                                                  <button
                                                    onClick={() =>
                                                      onRemovePlan(plan.id)
                                                    }
                                                    className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors cursor-pointer handwriting"
                                                    title="Delete plan"
                                                  >
                                                    ✕
                                                  </button>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-center py-12 text-blue-400">
                                    <div className="text-4xl mb-2">📝</div>
                                    <p className="handwriting text-lg">
                                      No plans today
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Page navigation - moved outside book area */}
                    <div className="flex justify-center gap-4 items-center mt-4 pt-4 border-t border-stone-200/30">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => flipPage(0)}
                        disabled={currentPage === 0 || isFlipping}
                        className={cn(
                          "handwriting text-xs cursor-pointer",
                          currentPage === 0 && "bg-amber-100 border-amber-300"
                        )}
                      >
                        📝 Add Entry
                      </Button>
                      <div className="w-2 h-2 rounded-full bg-stone-300/50"></div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => flipPage(1)}
                        disabled={currentPage === 1 || isFlipping}
                        className={cn(
                          "handwriting text-xs cursor-pointer",
                          currentPage === 1 && "bg-amber-100 border-amber-300"
                        )}
                      >
                        📖 View Entries
                      </Button>
                    </div>
                  </div>

                  {/* Book action buttons */}
                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-stone-200/50">
                    <Button
                      variant="outline"
                      onClick={closeBook}
                      className="handwriting text-stone-600 border-stone-300 hover:bg-stone-50 cursor-pointer"
                    >
                      ← Close Book
                    </Button>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className={dialogStyles.buttons.secondary}
                      >
                        Cancel
                      </Button>
                      {currentPage === 0 && (
                        <Button
                          onClick={handleSubmit}
                          className={cn(
                            "cursor-pointer handwriting",
                            currentStyles.buttonColor
                          )}
                        >
                          {mode === "expense"
                            ? "Save Expense 💰"
                            : "Save Plan 📝"}
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
