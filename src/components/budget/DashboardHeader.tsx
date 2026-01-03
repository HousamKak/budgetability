import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { paperTheme } from "@/styles";
import { Book, ChevronLeft, ChevronRight, Plus, Trash, Wallet } from "./Icons";
import { SummaryCard } from "./SummaryCard";

interface DashboardHeaderProps {
  monthLabel: string;
  year: number;
  month: number;
  budget: number;
  budgetInput: string;
  totalSpent: number;
  totalPlanned: number;
  totalAllocated?: number;
  onBudgetInputChange: (value: string) => void;
  onGotoPrev: () => void;
  onGotoNext: () => void;
  onOpenMonthlyBook: () => void;
  onOpenClearDialog: () => void;
  onOpenQuickAdd: () => void;
  onOpenBudgetSetup?: () => void;
}

export function DashboardHeader({
  monthLabel,
  budget,
  budgetInput,
  totalSpent,
  totalPlanned,
  totalAllocated,
  onBudgetInputChange,
  onGotoPrev,
  onGotoNext,
  onOpenMonthlyBook,
  onOpenClearDialog,
  onOpenQuickAdd,
  onOpenBudgetSetup,
}: DashboardHeaderProps) {
  const leftNow = Math.max(0, budget - totalSpent);
  const leftAfterPlanned = budget - totalSpent - totalPlanned;

  return (
    <div className="mx-auto max-w-7xl px-2 sm:px-4 pt-4 pb-4">
      {/* Top Row: Quick Actions */}
      <div className="flex items-center justify-end gap-2 flex-wrap mb-4">
        {/* Budget Button - Opens Budget Setup Dialog */}
        <button
          onClick={onOpenBudgetSetup}
          className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2 shadow-sm cursor-pointer",
            "bg-white/80 border border-amber-200 hover:bg-amber-50/80 hover:border-amber-300",
            "transition-all duration-150"
          )}
          title="Click to setup budget and link accounts"
        >
          <Wallet className="w-4 h-4 text-amber-600" />
          <div className="text-right">
            <p
              className={cn(
                "text-sm font-semibold leading-none",
                paperTheme.fonts.handwriting,
                budget > 0 ? "text-stone-800" : "text-stone-400"
              )}
            >
              {budget > 0 ? formatCurrency(budget) : "Set Budget"}
            </p>
            {totalAllocated !== undefined && totalAllocated > 0 && (
              <p className="text-xs text-stone-400 mt-0.5">
                {formatCurrency(totalAllocated)} allocated
              </p>
            )}
          </div>
        </button>

        {/* Quick Add Button */}
        <Button
          onClick={onOpenQuickAdd}
          className="rounded-xl bg-amber-200/80 hover:bg-amber-300/80 text-stone-900 border border-amber-300 shadow-sm h-10 px-3"
          title="Quick add expense or plan"
        >
          <Plus className="w-4 h-4 mr-1" />
          <span className="hidden sm:inline text-sm font-medium">
            Quick add
          </span>
          <span className="sm:hidden text-sm font-medium">Add</span>
        </Button>

        {/* Monthly Book */}
        <Button
          variant="ghost"
          onClick={onOpenMonthlyBook}
          className="rounded-xl bg-amber-100/60 hover:bg-amber-200/80 border border-amber-300/50 h-10 px-3"
          title="Open monthly book"
        >
          <Book className="h-4 w-4 text-amber-700" />
          <span className="hidden md:inline ml-1.5 text-sm font-medium text-amber-700">
            Book
          </span>
        </Button>

        {/* Clear Month */}
        <Button
          variant="ghost"
          onClick={onOpenClearDialog}
          className="rounded-xl bg-red-50 hover:bg-red-100 border border-red-200/50 h-10 px-3"
          title="Clear month"
        >
          <Trash className="h-4 w-4 text-red-600" />
          <span className="hidden md:inline ml-1.5 text-sm font-medium text-red-600">
            Clear
          </span>
        </Button>
      </div>

      {/* Bottom Row: Month Navigation + Summary Cards */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Month Navigation */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            onClick={onGotoPrev}
            className="rounded-xl shadow-sm bg-white/80 hover:bg-white border border-amber-200/50 h-8 w-8 p-0"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <h1 className="text-base sm:text-lg font-bold tracking-wide text-stone-800 handwriting whitespace-nowrap px-2">
            {monthLabel}
          </h1>

          <Button
            variant="ghost"
            onClick={onGotoNext}
            className="rounded-xl shadow-sm bg-white/80 hover:bg-white border border-amber-200/50 h-8 w-8 p-0"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Summary Cards Grid */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <SummaryCard
            title="Starting cash"
            value={budget}
            titleTooltip="Your monthly budget amount. This is the total money you have allocated for this month."
          />
          <SummaryCard
            title="Spent so far"
            value={totalSpent}
            red
            leftAmount={leftNow}
            leftLabel="left now"
            titleTooltip="Total amount you have already spent this month. Calculated by summing all your recorded expenses."
            leftLabelTooltip={`Money remaining right now. Calculated as: Starting cash - Spent so far = $${formatNumber(budget)} - $${formatNumber(totalSpent)} = $${formatNumber(leftNow)}`}
          />
          <SummaryCard
            title="Planned so far"
            value={totalPlanned}
            blue
            leftAmount={leftAfterPlanned}
            leftLabel="left after"
            leftAmountRed={leftAfterPlanned < 0}
            titleTooltip="Total amount you have planned to spend but haven't spent yet. This includes all your planned items that are not yet marked as paid."
            leftLabelTooltip={`Money that will remain after all planned expenses. ${
              leftAfterPlanned < 0
                ? "Negative means you have overplanned beyond your remaining budget."
                : ""
            } Calculated as: Starting cash - Spent so far - Planned so far = $${formatNumber(budget)} - $${formatNumber(totalSpent)} - $${formatNumber(totalPlanned)} = $${formatNumber(leftAfterPlanned)}`}
          />
        </div>
      </div>
    </div>
  );
}
