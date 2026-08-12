import { Button } from "@/components/ui/button";
import { cn, currencySymbol, formatCurrency } from "@/lib/utils";
import { Book, ChevronLeft, ChevronRight, Plus, Trash } from "./Icons";
import { SummaryCard } from "./SummaryCard";
import { ClipboardList } from "lucide-react";

interface DashboardHeaderProps {
  monthLabel: string;
  year: number;
  month: number;
  budget: number;
  budgetInput: string;
  totalSpent: number;
  totalPlanned: number;
  onBudgetInputChange: (value: string) => void;
  onGotoPrev: () => void;
  onGotoNext: () => void;
  onOpenMonthlyBook: () => void;
  onOpenClearDialog: () => void;
  onOpenQuickAdd: () => void;
  onOpenBudgetDetails: () => void;
}

export function DashboardHeader({
  monthLabel,
  budget,
  budgetInput,
  totalSpent,
  totalPlanned,
  onBudgetInputChange,
  onGotoPrev,
  onGotoNext,
  onOpenMonthlyBook,
  onOpenClearDialog,
  onOpenQuickAdd,
  onOpenBudgetDetails,
}: DashboardHeaderProps) {
  const leftNow = Math.max(0, budget - totalSpent);
  const leftAfterPlanned = budget - totalSpent - totalPlanned;

  return (
    <div className="mx-auto max-w-7xl px-2 sm:px-4 pt-4 pb-4">
      {/* ───────── Phone layout (below lg) ───────── */}
      <div className="lg:hidden flex flex-col gap-2.5 text-sm">
        {/* Row 1: month navigator (to the side) + budget beside it */}
        <div className="flex items-stretch gap-2">
          <div className="flex items-center gap-0.5 rounded-2xl border-2 border-amber-200 bg-white/70 shadow-sm px-1 shrink-0">
            <Button
              variant="ghost"
              onClick={onGotoPrev}
              className="rounded-xl h-8 w-8 p-0"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-base font-bold tracking-wide text-stone-800 handwriting whitespace-nowrap">
              {monthLabel}
            </h1>
            <Button
              variant="ghost"
              onClick={onGotoNext}
              className="rounded-xl h-8 w-8 p-0"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 min-w-0 rounded-2xl border-2 border-amber-200 shadow-sm bg-gradient-to-br from-amber-50/80 to-white/80 overflow-hidden flex items-center">
            <div className="flex flex-col justify-center px-2 py-1.5 flex-1 min-w-0">
              <p className="text-[10px] text-stone-400 text-center font-medium uppercase tracking-wider">Budget</p>
              <div className="flex items-center justify-center gap-0.5">
                <span
                  className="text-lg font-bold tracking-wide text-stone-700"
                  style={{ fontFamily: '"Patrick Hand", "Comic Sans MS", "Dirham", cursive' }}
                >
                  {currencySymbol()}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={budgetInput}
                  onChange={(e) => onBudgetInputChange(e.target.value)}
                  className={cn(
                    "w-16 text-lg font-bold tracking-wide bg-transparent border-none outline-none text-center text-stone-800",
                    "focus:bg-white/50 rounded transition-colors"
                  )}
                  style={{ fontFamily: '"Patrick Hand", "Comic Sans MS", "Dirham", cursive' }}
                  placeholder="0"
                />
              </div>
            </div>
            <div
              onClick={onOpenBudgetDetails}
              className="flex flex-col items-center justify-center px-2 self-stretch border-l border-dashed border-amber-300/70 cursor-pointer hover:bg-amber-100/60 transition-colors"
              title="View budget & account details"
            >
              <ClipboardList className="w-4 h-4 text-amber-600" />
              <span
                className="text-[9px] font-bold text-amber-700 mt-0.5"
                style={{ fontFamily: '"Patrick Hand", "Comic Sans MS", "Dirham", cursive' }}
              >
                Details
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: action buttons */}
        <div className="flex items-center gap-1.5">
          <Button
            onClick={onOpenQuickAdd}
            className="flex-1 rounded-lg bg-amber-200/80 hover:bg-amber-300/80 text-stone-900 border border-amber-300 shadow-sm h-8 px-2"
          >
            <Plus className="w-3.5 h-3.5 mr-0.5" />
            <span className="text-xs font-medium">Quick Add</span>
          </Button>
          <Button
            variant="ghost"
            onClick={onOpenMonthlyBook}
            className="flex-1 rounded-lg bg-amber-100/60 hover:bg-amber-200/80 border border-amber-300/50 h-8 px-2"
          >
            <Book className="h-3.5 w-3.5 text-amber-700" />
            <span className="ml-0.5 text-xs font-medium text-amber-700">Book</span>
          </Button>
          <Button
            variant="ghost"
            onClick={onOpenClearDialog}
            className="flex-1 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200/50 h-8 px-2"
          >
            <Trash className="h-3.5 w-3.5 text-red-600" />
            <span className="ml-0.5 text-xs font-medium text-red-600">Clear</span>
          </Button>
        </div>

        {/* Row 3: Spent + Planned — matched to the native app's cards */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border-2 border-amber-200 bg-white/70 shadow-sm px-3.5 py-3 min-h-[88px]">
            <div className="text-[13px] text-stone-600 handwriting leading-none">Spent so far</div>
            <div className="text-2xl font-bold text-red-600 handwriting leading-tight mt-1">
              {formatCurrency(totalSpent)}
            </div>
            <div className="text-xs text-stone-600 handwriting leading-none mt-1.5">
              {formatCurrency(leftNow)} left now
            </div>
          </div>
          <div className="rounded-2xl border-2 border-amber-200 bg-white/70 shadow-sm px-3.5 py-3 min-h-[88px]">
            <div className="text-[13px] text-stone-600 handwriting leading-none">Planned so far</div>
            <div className="text-2xl font-bold text-blue-600 handwriting leading-tight mt-1">
              {formatCurrency(totalPlanned)}
            </div>
            <div
              className={cn(
                "text-xs handwriting leading-none mt-1.5",
                leftAfterPlanned >= 0 ? "text-emerald-600" : "text-red-600"
              )}
            >
              {formatCurrency(leftAfterPlanned)} left after
            </div>
          </div>
        </div>
      </div>

      {/* ───────── Desktop layout (lg+) — unchanged ───────── */}
      <div className="hidden lg:grid lg:grid-cols-[1.3fr_1fr_1fr_1fr] gap-4 text-sm">
        {/* Section A: Month Navigation + Action Buttons */}
        <div className="flex flex-col gap-3">
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

            <h1 className="text-xl sm:text-2xl font-bold tracking-wide text-stone-800 handwriting whitespace-nowrap px-2">
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

          {/* Action Buttons Row */}
          <div className="flex items-center justify-center gap-1.5">
            {/* Quick Add Button */}
            <Button
              onClick={onOpenQuickAdd}
              className="rounded-lg bg-amber-200/80 hover:bg-amber-300/80 text-stone-900 border border-amber-300 shadow-sm h-8 px-2"
              title="Quick add expense or plan"
            >
              <Plus className="w-3.5 h-3.5 mr-0.5" />
              <span className="text-xs font-medium">Quick Add</span>
            </Button>

            {/* Monthly Book */}
            <Button
              variant="ghost"
              onClick={onOpenMonthlyBook}
              className="rounded-lg bg-amber-100/60 hover:bg-amber-200/80 border border-amber-300/50 h-8 px-2"
              title="Open monthly book"
            >
              <Book className="h-3.5 w-3.5 text-amber-700" />
              <span className="ml-0.5 text-xs font-medium text-amber-700">Book</span>
            </Button>

            {/* Clear Month */}
            <Button
              variant="ghost"
              onClick={onOpenClearDialog}
              className="rounded-lg bg-red-50 hover:bg-red-100 border border-red-200/50 h-8 px-2"
              title="Clear month"
            >
              <Trash className="h-3.5 w-3.5 text-red-600" />
              <span className="ml-0.5 text-xs font-medium text-red-600">Clear</span>
            </Button>
          </div>
        </div>

        {/* Budget Card with Details button */}
        <div className="rounded-2xl border-2 border-amber-200 shadow-sm bg-gradient-to-br from-amber-50/80 to-white/80 overflow-hidden">
          <div className="flex items-center h-full">
            {/* Budget section */}
            <div className="flex flex-col justify-center px-4 py-2 flex-1">
              <p className="text-[10px] text-stone-400 text-center font-medium uppercase tracking-wider">Monthly Budget</p>
              <div className="flex items-center justify-center gap-0.5">
                <span
                  className="text-xl font-bold tracking-wide text-stone-700"
                  style={{ fontFamily: '"Patrick Hand", "Comic Sans MS", "Dirham", cursive' }}
                >
                  {currencySymbol()}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={budgetInput}
                  onChange={(e) => onBudgetInputChange(e.target.value)}
                  className={cn(
                    "w-20 text-xl font-bold tracking-wide bg-transparent border-none outline-none text-center text-stone-800",
                    "focus:bg-white/50 rounded transition-colors"
                  )}
                  style={{ fontFamily: '"Patrick Hand", "Comic Sans MS", "Dirham", cursive' }}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Details button on right */}
            <div
              onClick={onOpenBudgetDetails}
              className="flex flex-col items-center justify-center px-3 h-full border-l border-dashed border-amber-300/70 cursor-pointer hover:bg-amber-100/60 transition-colors"
              title="View budget & account details"
            >
              <ClipboardList className="w-4 h-4 text-amber-600" />
              <span
                className="text-[10px] font-bold text-amber-700 mt-0.5"
                style={{ fontFamily: '"Patrick Hand", "Comic Sans MS", "Dirham", cursive' }}
              >
                Details
              </span>
            </div>
          </div>
        </div>

        {/* Section C: Spent so far */}
        <SummaryCard
          title="Spent so far"
          value={totalSpent}
          red
          leftAmount={leftNow}
          leftLabel="left now"
          titleTooltip="Total amount you have already spent this month. Calculated by summing all your recorded expenses."
          leftLabelTooltip={`Money remaining right now. Calculated as: Starting cash - Spent so far = ${formatCurrency(budget)} - ${formatCurrency(totalSpent)} = ${formatCurrency(leftNow)}`}
        />

        {/* Section D: Planned so far */}
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
          } Calculated as: Starting cash - Spent so far - Planned so far = ${formatCurrency(budget)} - ${formatCurrency(totalSpent)} - ${formatCurrency(totalPlanned)} = ${formatCurrency(leftAfterPlanned)}`}
        />
      </div>
    </div>
  );
}
