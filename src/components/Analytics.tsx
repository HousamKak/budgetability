import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Calendar, DollarSign, Target } from "lucide-react";
import { layoutStyles, paperTheme } from "@/styles";
import { dataService, type Expense } from "@/lib/data-service";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCategoryAnalytics,
  getDailySpending,
  getCumulativeSpending,
  getSpendingSummary,
  getBudgetHealthScore,
  formatCurrency,
  formatPercentage
} from "@/utils/analytics";
import { CategoryToggleChart } from "./analytics/CategoryToggleChart";
import { FilteredDailySpendingChart } from "./analytics/FilteredDailySpendingChart";
import { DailySpendingChart } from "./analytics/DailySpendingChart";
import { BudgetPerformanceChart } from "./analytics/BudgetPerformanceChart";
import { monthKey } from "./budget/utils";

/**
 * Comprehensive Analytics Dashboard with real data
 * Shows category breakdowns, spending trends, budget performance
 */
export default function Analytics() {
  const { loading } = useAuth();
  const today = new Date();
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth());

  const key = useMemo(() => monthKey(year, month), [year, month]);
  const [budget, setBudget] = useState<number>(0);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [budgetData, expensesData] = await Promise.all([
          dataService.getBudget(key),
          dataService.getExpenses(key),
        ]);
        setBudget(budgetData);
        setExpenses(expensesData);
      } catch (error) {
        console.error('Failed to load analytics data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [key]);

  // Calculate analytics
  const categoryAnalytics = useMemo(() => getCategoryAnalytics(expenses), [expenses]);
  const dailySpending = useMemo(() => getDailySpending(expenses), [expenses]);
  const cumulativeSpending = useMemo(() => getCumulativeSpending(expenses, budget), [expenses, budget]);
  const spendingSummary = useMemo(() => getSpendingSummary(expenses, budget), [expenses, budget]);
  const budgetHealth = useMemo(() => getBudgetHealthScore(expenses, budget, 31), [expenses, budget]);

  const monthLabel = new Date(year, month, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  if (loading || isLoading) {
    return (
      <div className={layoutStyles.appContainer}>
        <div className="min-h-screen w-full flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-medium text-stone-700 handwriting">Loading Analytics...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={layoutStyles.appContainer}>
      {/* Header section */}
      <div className="mx-auto max-w-7xl px-1 sm:px-2 pt-4 sm:pt-6 pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold tracking-wide drop-shadow-[0_1px_0_rgba(0,0,0,0.1)] handwriting">
            📊 Analytics Dashboard
          </h1>

          {/* Month/Year Selector */}
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-amber-600" />
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="px-3 py-2 text-sm rounded-md border border-amber-200 bg-white/80 handwriting text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  {new Date(year, i, 1).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="px-3 py-2 text-sm rounded-md border border-amber-200 bg-white/80 handwriting text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              {Array.from({ length: 5 }, (_, i) => {
                const yearOption = today.getFullYear() - 2 + i;
                return (
                  <option key={yearOption} value={yearOption}>
                    {yearOption}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Selected month label */}
        <div className="mt-3">
          <p className="text-base sm:text-lg text-stone-600 handwriting">
            Viewing data for {monthLabel}
          </p>
        </div>
      </div>

      {/* Main content area */}
      <div className="mx-auto max-w-7xl px-1 sm:px-2 pb-12 max-lg:pb-24 space-y-8">

        {/* Summary Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Spent */}
          <div className={`relative ${paperTheme.colors.background.cardGradient} ${paperTheme.colors.borders.paper} ${paperTheme.radius.lg} p-4 ${paperTheme.effects.shadow.md} overflow-hidden`}>
            <div className={`absolute inset-0 opacity-15 ${paperTheme.effects.paperTexture} ${paperTheme.radius.lg} pointer-events-none`}></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3">
                <DollarSign className="w-6 h-6 text-amber-600" />
                <div>
                  <p className="text-sm text-stone-600 handwriting">Total Spent</p>
                  <p className="text-lg font-bold text-stone-800 handwriting">{formatCurrency(spendingSummary.totalSpent)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Budget Utilization */}
          <div className={`relative ${paperTheme.colors.background.cardGradient} ${paperTheme.colors.borders.paper} ${paperTheme.radius.lg} p-4 ${paperTheme.effects.shadow.md} overflow-hidden`}>
            <div className={`absolute inset-0 opacity-15 ${paperTheme.effects.paperTexture} ${paperTheme.radius.lg} pointer-events-none`}></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3">
                <Target className="w-6 h-6 text-amber-600" />
                <div>
                  <p className="text-sm text-stone-600 handwriting">Budget Used</p>
                  <p className="text-lg font-bold text-stone-800 handwriting">{formatPercentage(spendingSummary.budgetUtilization)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Average Daily */}
          <div className={`relative ${paperTheme.colors.background.cardGradient} ${paperTheme.colors.borders.paper} ${paperTheme.radius.lg} p-4 ${paperTheme.effects.shadow.md} overflow-hidden`}>
            <div className={`absolute inset-0 opacity-15 ${paperTheme.effects.paperTexture} ${paperTheme.radius.lg} pointer-events-none`}></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3">
                <Calendar className="w-6 h-6 text-amber-600" />
                <div>
                  <p className="text-sm text-stone-600 handwriting">Daily Average</p>
                  <p className="text-lg font-bold text-stone-800 handwriting">{formatCurrency(spendingSummary.averageDaily)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Budget Health Score */}
          <div className={`relative ${paperTheme.colors.background.cardGradient} ${paperTheme.colors.borders.paper} ${paperTheme.radius.lg} p-4 ${paperTheme.effects.shadow.md} overflow-hidden`}>
            <div className={`absolute inset-0 opacity-15 ${paperTheme.effects.paperTexture} ${paperTheme.radius.lg} pointer-events-none`}></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full ${
                  budgetHealth.status === 'excellent' ? 'bg-green-500' :
                  budgetHealth.status === 'good' ? 'bg-yellow-500' :
                  budgetHealth.status === 'warning' ? 'bg-orange-500' : 'bg-red-500'
                }`}></div>
                <div>
                  <p className="text-sm text-stone-600 handwriting">Health Score</p>
                  <p className="text-lg font-bold text-stone-800 handwriting">{budgetHealth.score}/100</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Category Toggle Chart */}
          <div className={`relative ${paperTheme.colors.background.cardGradient} ${paperTheme.colors.borders.paper} ${paperTheme.radius.lg} p-6 ${paperTheme.effects.shadow.xl} overflow-hidden`}>
            <div className={`absolute inset-0 opacity-15 ${paperTheme.effects.paperTexture} ${paperTheme.radius.lg} pointer-events-none`}></div>
            <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-16 h-6 ${paperTheme.effects.yellowTape}`}></div>
            <div className="relative z-10">
              <CategoryToggleChart data={categoryAnalytics} />
            </div>
          </div>

          {/* Filtered Daily Spending Chart */}
          <div className={`relative ${paperTheme.colors.background.cardGradient} ${paperTheme.colors.borders.paper} ${paperTheme.radius.lg} p-6 ${paperTheme.effects.shadow.xl} overflow-hidden`}>
            <div className={`absolute inset-0 opacity-15 ${paperTheme.effects.paperTexture} ${paperTheme.radius.lg} pointer-events-none`}></div>
            <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-16 h-6 ${paperTheme.effects.yellowTape}`}></div>
            <div className="relative z-10">
              <FilteredDailySpendingChart expenses={expenses} />
            </div>
          </div>

          {/* Daily Spending Trend */}
          <div className={`relative ${paperTheme.colors.background.cardGradient} ${paperTheme.colors.borders.paper} ${paperTheme.radius.lg} p-6 ${paperTheme.effects.shadow.xl} overflow-hidden`}>
            <div className={`absolute inset-0 opacity-15 ${paperTheme.effects.paperTexture} ${paperTheme.radius.lg} pointer-events-none`}></div>
            <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-16 h-6 ${paperTheme.effects.yellowTape}`}></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="w-8 h-8 text-amber-600" />
                <h2 className="text-xl font-bold text-stone-800 handwriting">Daily Spending Trend</h2>
              </div>
              <DailySpendingChart data={dailySpending} />
            </div>
          </div>

          {/* Budget Performance */}
          <div className={`relative ${paperTheme.colors.background.cardGradient} ${paperTheme.colors.borders.paper} ${paperTheme.radius.lg} p-6 ${paperTheme.effects.shadow.xl} overflow-hidden`}>
            <div className={`absolute inset-0 opacity-15 ${paperTheme.effects.paperTexture} ${paperTheme.radius.lg} pointer-events-none`}></div>
            <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-16 h-6 ${paperTheme.effects.yellowTape}`}></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <Target className="w-8 h-8 text-amber-600" />
                <h2 className="text-xl font-bold text-stone-800 handwriting">Budget vs Spending</h2>
              </div>
              <BudgetPerformanceChart data={cumulativeSpending} />
            </div>
          </div>
        </div>

        {/* Insights Section */}
        <div className={`relative ${paperTheme.colors.background.cardGradient} ${paperTheme.colors.borders.paper} ${paperTheme.radius.lg} p-6 ${paperTheme.effects.shadow.xl} overflow-hidden`}>
          <div className={`absolute inset-0 opacity-15 ${paperTheme.effects.paperTexture} ${paperTheme.radius.lg} pointer-events-none`}></div>
          <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-16 h-6 ${paperTheme.effects.yellowTape}`}></div>
          <div className="relative z-10">
            <h2 className="text-xl font-bold text-stone-800 handwriting mb-4">📈 Key Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white/60 rounded-lg p-4 border border-amber-200">
                <h3 className="font-semibold text-stone-800 handwriting mb-2">Most Common Category</h3>
                <p className="text-stone-600 handwriting">{spendingSummary.mostCommonCategory}</p>
              </div>
              <div className="bg-white/60 rounded-lg p-4 border border-amber-200">
                <h3 className="font-semibold text-stone-800 handwriting mb-2">Highest Spending Day</h3>
                <p className="text-stone-600 handwriting">
                  {spendingSummary.mostExpensiveDay.amount > 0 ? formatCurrency(spendingSummary.mostExpensiveDay.amount) : 'No data'}
                </p>
              </div>
              <div className="bg-white/60 rounded-lg p-4 border border-amber-200">
                <h3 className="font-semibold text-stone-800 handwriting mb-2">Budget Status</h3>
                <p className="text-stone-600 handwriting">{budgetHealth.message}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}