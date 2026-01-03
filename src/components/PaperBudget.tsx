import { AuthDialog } from "@/components/Auth";
import { ProfilePanel } from "@/components/ProfilePanel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { dataService, type Expense, type PlanItem } from "@/lib/data-service";
import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";

// Import our new components
import { layoutStyles } from "@/styles";
import { Calendar } from "./budget/Calendar";
import { DashboardHeader } from "./budget/DashboardHeader";
import { ExpenseDialog } from "./budget/ExpenseDialog";
import { CalendarIcon, Trash, Wallet } from "./budget/Icons";
import { MonthlyBookDialog } from "./budget/MonthlyBookDialog";
import { PlannerPanel } from "./budget/PlannerPanel";
import { QuoteModal } from "./budget/QuoteModal";
import { datePickerStyles, getRandomQuote } from "./budget/constants";
import { useDebounce } from "./budget/hooks/useDebounce";
import { makeId, monthKey, weekCount, weekIndexOf, ymd } from "./budget/utils";

/**
 * ——————————————————————————————————————————————————————————————————————
 * Cartoony "paper" budget app
 * - Month calendar on the left (paper sticky notes look)
 * - Compact Weekly Planner panel on the right
 * - Hover a day to see the planned + paid items; day cells remain clean
 * - Supabase + LocalStorage fallback persistence
 * - No external icon deps (inline SVGs)
 * ——————————————————————————————————————————————————————————————————————
 */

// ——— main component ————————————————————————————————————————————
export default function PaperBudget() {
  const { user, loading } = useAuth();
  const today = new Date();
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth()); // 0-based

  const key = useMemo(() => monthKey(year, month), [year, month]);
  const [budget, setBudgetState] = useState<number>(0);
  const [budgetInput, setBudgetInput] = useState<string>("");
  const [hasLoadedData, setHasLoadedData] = useState<boolean>(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  // Mobile: bottom tabs to switch between calendar/planner
  const [activeTab, setActiveTab] = useState<"calendar" | "planner">(
    "calendar"
  );
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  // Plan animation state - tracks which dates should show animation (supports multiple simultaneous)
  const [animatedPlanDates, setAnimatedPlanDates] = useState<Set<string>>(
    new Set()
  );
  // Expense animation state - tracks which dates should show red animation (supports multiple simultaneous)
  const [animatedExpenseDates, setAnimatedExpenseDates] = useState<Set<string>>(
    new Set()
  );

  // Debounce the budget input to avoid excessive API calls
  const debouncedBudgetInput = useDebounce(budgetInput, 800);

  // Load data from service
  useEffect(() => {
    setHasLoadedData(false); // Reset flag when month changes
    const loadData = async () => {
      try {
        const [budgetData, expensesData, plansData] = await Promise.all([
          dataService.getBudget(key),
          dataService.getExpenses(key),
          dataService.getPlans(key),
        ]);
        setBudgetState(budgetData);
        setBudgetInput(budgetData ? budgetData.toString() : "");
        setHasLoadedData(true);
        setExpenses(expensesData);
        setPlans(plansData);
      } catch (error) {
        console.error("Failed to load data:", error);
        // Still set the input and flag even on error to prevent stale values
        setBudgetInput("");
        setHasLoadedData(true);
      }
    };
    loadData();
  }, [key]);

  // Handle debounced budget updates (only after data has loaded)
  useEffect(() => {
    // Only process debounced updates if:
    // 1. Data has loaded for this month
    // 2. Input has a value
    // 3. Input is different from current budget
    // 4. Input matches the current budget input (to ensure it's for the current month)
    if (
      hasLoadedData &&
      debouncedBudgetInput !== "" &&
      debouncedBudgetInput !== budget.toString() &&
      debouncedBudgetInput === budgetInput
    ) {
      const numericValue = Number(debouncedBudgetInput);
      if (!isNaN(numericValue) && numericValue >= 0) {
        setBudget(numericValue);
      }
    }
  }, [debouncedBudgetInput, budget, hasLoadedData, budgetInput]);

  // totals
  const totalSpent = useMemo(
    () => expenses.reduce((s, e) => s + e.amount, 0),
    [expenses]
  );
  const totalPlanned = useMemo(
    () => plans.reduce((s, p) => s + p.amount, 0),
    [plans]
  );

  // nav
  function gotoPrev() {
    const d = new Date(year, month - 1, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }
  function gotoNext() {
    const d = new Date(year, month + 1, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  // expense ops
  async function addExpense(e: Expense) {
    try {
      await dataService.addExpense(key, e);
      setExpenses((prev) =>
        [...prev, e].sort((a, b) => a.date.localeCompare(b.date))
      );
    } catch (error) {
      console.error("Failed to add expense:", error);
    }
  }
  async function removeExpense(id: string) {
    try {
      await dataService.removeExpense(key, id);
      setExpenses((prev) => prev.filter((x) => x.id !== id));
    } catch (error) {
      console.error("Failed to remove expense:", error);
    }
  }
  async function updateExpense(id: string, updates: Partial<Expense>) {
    try {
      await dataService.updateExpense(key, id, updates);
      setExpenses((prev) =>
        prev.map((x) => (x.id === id ? { ...x, ...updates } : x))
      );
    } catch (error) {
      console.error("Failed to update expense:", error);
    }
  }
  async function setBudget(amount: number) {
    try {
      await dataService.setBudget(key, amount);
      setBudgetState(amount);
    } catch (error) {
      console.error("Failed to set budget:", error);
    }
  }
  async function clearMonth() {
    try {
      await dataService.clearMonth(key);
      setBudgetState(0);
      setExpenses([]);
      setPlans([]);
    } catch (error) {
      console.error("Failed to clear month:", error);
    }
  }

  // plans ops
  async function addPlan(p: Omit<PlanItem, "id">) {
    try {
      const newPlan = { ...p, id: makeId() };
      await dataService.addPlan(key, newPlan);
      setPlans((prev) => [...prev, newPlan]);
    } catch (error) {
      console.error("Failed to add plan:", error);
    }
  }
  async function updatePlan(id: string, patch: Partial<PlanItem>) {
    try {
      await dataService.updatePlan(key, id, patch);
      setPlans((prev) =>
        prev.map((x) => (x.id === id ? { ...x, ...patch } : x))
      );
    } catch (error) {
      console.error("Failed to update plan:", error);
    }
  }
  async function removePlan(id: string) {
    try {
      await dataService.removePlan(key, id);
      setPlans((prev) => prev.filter((x) => x.id !== id));
    } catch (error) {
      console.error("Failed to remove plan:", error);
    }
  }
  function markPlanPaid(p: PlanItem) {
    const date = p.targetDate || ymd(new Date());
    addExpense({
      id: makeId(),
      date,
      amount: p.amount,
      category: p.category,
      note: p.note,
    });
    removePlan(p.id);
  }

  // Handle plan animation - shows blue glow on calendar day (supports multiple simultaneous)
  function handlePlanAnimation(targetDate: string) {
    // Add the date to the animated set
    setAnimatedPlanDates((prev) => new Set([...prev, targetDate]));

    // Remove this specific date after animation completes (2.5s)
    setTimeout(() => {
      setAnimatedPlanDates((prev) => {
        const next = new Set(prev);
        next.delete(targetDate);
        return next;
      });
    }, 2500);
  }

  // Handle expense animation - shows red glow on calendar day (supports multiple simultaneous)
  function handleExpenseAnimation(targetDate: string) {
    // Add the date to the animated set
    setAnimatedExpenseDates((prev) => new Set([...prev, targetDate]));

    // Remove this specific date after animation completes (2.5s)
    setTimeout(() => {
      setAnimatedExpenseDates((prev) => {
        const next = new Set(prev);
        next.delete(targetDate);
        return next;
      });
    }, 2500);
  }

  // add-expense dialog state (compact)
  const [open, setOpen] = useState(false);
  const [formDate, setFormDate] = useState<string>(ymd(today));
  const [amount, setAmount] = useState<string>("");
  const [category, setCategory] = useState<string>("groceries");
  const [note, setNote] = useState<string>("");

  // editing state
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingPlan, setEditingPlan] = useState<PlanItem | null>(null);

  // monthly book modal state
  const [monthlyBookOpen, setMonthlyBookOpen] = useState(false);

  // clear month confirmation dialog
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  function submitExpense() {
    const a = Number(amount);
    if (!formDate || isNaN(a) || a <= 0) return;
    addExpense({
      id: makeId(),
      date: formDate,
      amount: Number(a.toFixed(2)),
      category,
      note,
    });

    // Trigger red animation on the target date
    handleExpenseAnimation(formDate);

    setAmount("");
    setNote("");
    setOpen(false);
  }

  function submitPlan(planData: {
    date: string;
    amount: number;
    category: string;
    note: string;
  }) {
    // Parse the date to get week information
    const targetDate = new Date(planData.date);
    const weekIdx = weekIndexOf(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate()
    );

    addPlan({
      monthKey: key,
      weekIndex: weekIdx,
      targetDate: planData.date,
      amount: planData.amount,
      category: planData.category,
      note: planData.note,
    });

    // Trigger blue animation on the target date
    handlePlanAnimation(planData.date);

    setAmount("");
    setNote("");
    setOpen(false);
  }

  // Edit handlers
  function handleEditExpense(expense: Expense) {
    setEditingExpense(expense);
    setEditingPlan(null);
    setFormDate(expense.date);
    setAmount(expense.amount.toString());
    setCategory(expense.category || "groceries");
    setNote(expense.note || "");
    setOpen(true);
  }

  function handleEditPlan(plan: PlanItem) {
    setEditingPlan(plan);
    setEditingExpense(null);
    setFormDate(plan.targetDate || ymd(new Date()));
    setAmount(plan.amount.toString());
    setCategory(plan.category || "groceries");
    setNote(plan.note || "");
    setOpen(true);
  }

  function handleUpdateExpense(id: string, updates: Partial<Expense>) {
    updateExpense(id, updates);
    setEditingExpense(null);
    setAmount("");
    setNote("");
    setOpen(false);
  }

  function handleUpdatePlan(id: string, updates: Partial<PlanItem>) {
    // Also update targetDate if date changed
    if (updates.targetDate) {
      const targetDate = new Date(updates.targetDate);
      const weekIdx = weekIndexOf(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate()
      );
      updatePlan(id, {
        ...updates,
        weekIndex: weekIdx,
      });
    } else {
      updatePlan(id, updates);
    }
    setEditingPlan(null);
    setAmount("");
    setNote("");
    setOpen(false);
  }

  // Handle dialog close - reset editing state
  function handleDialogOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setEditingExpense(null);
      setEditingPlan(null);
    }
  }

  // nice month label
  const monthLabel = new Date(year, month, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[repeating-linear-gradient(0deg,#fbf6e9,#fbf6e9_28px,#f2e8cf_28px,#f2e8cf_29px)] flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium text-stone-700">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={layoutStyles.appContainer}>
      {/* Inject custom date picker styles */}
      <style dangerouslySetInnerHTML={{ __html: datePickerStyles }} />
      {/* Auth notification sticker (mobile width tweak) */}
      {supabase && !user && (
        <div
          className={`${layoutStyles.notifications.authSticker} animate-banner-oscillate cursor-pointer`}
          onClick={() => setShowAuthDialog(true)}
        >
          <div className={layoutStyles.notifications.authStickerWrapper}>
            {/* Paper texture overlay */}
            <div
              className={layoutStyles.notifications.authStickerTexture}
            ></div>

            <div className="relative">
              <p className="text-sm text-stone-800 font-bold mb-2 handwriting">
                ⚠️ Sign in to save!
              </p>
              <p className="text-xs text-stone-600 leading-relaxed handwriting">
                Your budget will be lost on page refresh. Sign in to keep your
                data safe!
              </p>
            </div>
          </div>
          {/* Yellow transparent tape */}
          <div className={layoutStyles.notifications.authStickerTape}></div>
        </div>
      )}

      {/* New Dashboard Header with Profile, Navigation, and Summary Cards */}
      <DashboardHeader
        monthLabel={monthLabel}
        year={year}
        month={month}
        budget={budget}
        budgetInput={budgetInput}
        totalSpent={totalSpent}
        totalPlanned={totalPlanned}
        onBudgetInputChange={setBudgetInput}
        onGotoPrev={gotoPrev}
        onGotoNext={gotoNext}
        onOpenMonthlyBook={() => setMonthlyBookOpen(true)}
        onOpenClearDialog={() => setClearDialogOpen(true)}
        onOpenQuickAdd={() => setOpen(true)}
      />

      {/* Profile Panel at bottom left */}
      <ProfilePanel onOpenAuthDialog={() => setShowAuthDialog(true)} />

      {/* ExpenseDialog - moved outside header for cleaner structure */}
      <ExpenseDialog
        open={open}
        onOpenChange={handleDialogOpenChange}
        formDate={formDate}
        onFormDateChange={setFormDate}
        amount={amount}
        onAmountChange={setAmount}
        category={category}
        onCategoryChange={setCategory}
        note={note}
        onNoteChange={setNote}
        onSubmit={submitExpense}
        onSubmitPlan={submitPlan}
        dayExpenses={expenses.filter((e) => e.date === formDate)}
        dayPlans={plans.filter((p) => p.targetDate === formDate)}
        onMarkPlanPaid={markPlanPaid}
        onRemovePlan={removePlan}
        onRemoveExpense={removeExpense}
        editingExpense={editingExpense}
        editingPlan={editingPlan}
        onUpdateExpense={handleUpdateExpense}
        onUpdatePlan={handleUpdatePlan}
        onInlineUpdateExpense={updateExpense}
        onInlineUpdatePlan={updatePlan}
        onEditExpense={handleEditExpense}
        onEditPlan={handleEditPlan}
      />
      <MonthlyBookDialog
        open={monthlyBookOpen}
        onOpenChange={setMonthlyBookOpen}
        monthLabel={monthLabel}
        expenses={expenses}
        plans={plans}
        onMarkPlanPaid={markPlanPaid}
        onRemovePlan={removePlan}
        onRemoveExpense={removeExpense}
        onEditExpense={handleEditExpense}
        onEditPlan={handleEditPlan}
        onUpdateExpense={updateExpense}
        onUpdatePlan={updatePlan}
      />

      {/* Clear Month Confirmation Dialog */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <div className="relative bg-gradient-to-br from-red-100 via-red-50 to-pink-50 border-2 border-red-300/70 rounded-2xl p-6 shadow-xl overflow-hidden">
            {/* Paper texture overlay */}
            <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_1px_1px,rgba(220,38,38,0.3)_1px,transparent_0)] bg-[length:12px_12px] rounded-2xl pointer-events-none"></div>

            {/* Red tape effect */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-16 h-6 bg-red-300/60 rounded-sm shadow-sm transform rotate-3"></div>

            {/* Torn edge effect */}
            <div className="absolute -top-1 left-4 right-4 h-3 bg-[repeating-linear-gradient(90deg,#fca5a5,#fca5a5_8px,#fecaca_8px,#fecaca_16px)] rounded-t-2xl opacity-70"></div>

            <div className="relative z-10">
              <DialogHeader>
                <DialogTitle className="font-bold text-xl text-red-700 handwriting text-center mb-4">
                  ⚠️ Clear Month Data
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-stone-700">
                  This will permanently delete <strong>all data</strong> for{" "}
                  <strong>{monthLabel}</strong>:
                </p>
                <ul className="text-sm text-stone-600 space-y-1 ml-4">
                  <li>
                    • Budget amount: <strong>${budget.toFixed(2)}</strong>
                  </li>
                  <li>
                    • All expenses:{" "}
                    <strong>
                      {expenses.length} items (${totalSpent.toFixed(2)})
                    </strong>
                  </li>
                  <li>
                    • All planned items: <strong>{plans.length} items</strong>
                  </li>
                </ul>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800 font-medium">
                    ⚠️ This action cannot be undone!
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setClearDialogOpen(false)}
                    className="cursor-pointer handwriting rounded-xl bg-white/80 hover:bg-stone-100 border-stone-300 hover:border-stone-400 text-stone-700 hover:text-stone-900 shadow-sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-red-600 hover:bg-red-700 text-white cursor-pointer handwriting rounded-xl shadow-sm"
                    onClick={() => {
                      clearMonth();
                      setClearDialogOpen(false);
                    }}
                  >
                    <Trash className="w-4 h-4 mr-1" />
                    Clear All Data
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* layout: calendar + planner */}
      <div
        className={`mx-auto max-w-7xl px-2 sm:px-4 pb-2 lg:pb-12 mobile-content-area lg:flex-1 mobile-tab-${activeTab}`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_520px] gap-4 items-start h-full lg:h-auto">
          {/* Left column: Calendar */}
          <div className="space-y-4">
            {/* Calendar - show on mobile only when calendar tab active, always show on desktop */}
            <div
              className="mobile-calendar-area lg:h-auto lg:flex lg:flex-col lg:max-h-[85vh]"
              data-mobile-view="calendar"
            >
              <Calendar
                year={year}
                month={month}
                monthKey={key}
                budget={budget}
                expenses={expenses}
                plans={plans}
                animatedPlanDates={animatedPlanDates}
                animatedExpenseDates={animatedExpenseDates}
                onDayClick={(dateString) => {
                  setFormDate(dateString);
                  setOpen(true);
                }}
                onMarkPlanPaid={markPlanPaid}
                onRemovePlan={removePlan}
                onRemoveExpense={removeExpense}
                onShowQuote={() => setShowQuoteModal(true)}
                onEditExpense={handleEditExpense}
                onEditPlan={handleEditPlan}
                onUpdateExpense={updateExpense}
                onUpdatePlan={updatePlan}
              />
            </div>
          </div>

          {/* Right column: Planner Panel */}
          <div>
            {/* Planner Panel (on mobile: toggled by bottom tabs) */}
            <div
              className="mobile-planner-area lg:mt-0"
              data-mobile-view="planner"
            >
              <PlannerPanel
                year={year}
                month={month}
                monthKeyStr={key}
                weekCount={weekCount(year, month)}
                todaysWeek={weekIndexOf(year, month, today.getDate())}
                plans={plans}
                expenses={expenses}
                budget={budget}
                onAdd={addPlan}
                onUpdate={updatePlan}
                onRemove={removePlan}
                onMarkPaid={markPlanPaid}
                onPlanAnimation={handlePlanAnimation}
              />
            </div>
          </div>
        </div>

        {/* Footer tip - raised above taskbar */}
        <div className="mx-auto max-w-7xl px-1 sm:px-2 pb-16 pt-4 hidden sm:block">
          <div className="flex flex-wrap items-center justify-start gap-2 sm:gap-3">
            {/* Removed tip as requested */}
          </div>
        </div>

        {/* Mobile-only bottom tabs - sticky navigation */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-amber-200 p-2 z-50 safe-area-inset-bottom shadow-lg">
          <div className="relative bg-amber-100/50 rounded-lg p-1 max-w-md mx-auto">
            {/* Sliding indicator */}
            <div
              className={`absolute top-1 h-10 w-1/2 bg-white shadow-sm rounded-md transition-all duration-300 ease-in-out ${
                activeTab === "calendar" ? "left-1" : "left-1/2"
              }`}
            />
            {/* Tabs */}
            <div className="relative flex">
              <button
                onClick={() => setActiveTab("calendar")}
                className={`relative z-10 flex-1 h-10 text-sm font-medium rounded-md transition-colors duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                  activeTab === "calendar"
                    ? "text-stone-900"
                    : "text-stone-600 hover:text-stone-800"
                }`}
              >
                <CalendarIcon className="w-4 h-4" />
                Calendar
              </button>
              <button
                onClick={() => setActiveTab("planner")}
                className={`relative z-10 flex-1 h-10 text-sm font-medium rounded-md transition-colors duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                  activeTab === "planner"
                    ? "text-stone-900"
                    : "text-stone-600 hover:text-stone-800"
                }`}
              >
                <Wallet className="w-4 h-4" />
                Planner
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quote of the Day Modal */}
      <QuoteModal
        open={showQuoteModal}
        onOpenChange={setShowQuoteModal}
        quote={getRandomQuote()}
      />

      {/* Auth Dialog */}
      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
    </div>
  );
}
