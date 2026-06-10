import type { Expense } from '@/lib/data-service';

// Analytics data processing utilities

export interface CategoryAnalytics {
  category: string;
  amount: number;
  percentage: number;
  count: number;
  [key: string]: string | number; // Index signature for chart compatibility
}

export interface DailySpending {
  date: string;
  amount: number;
  dayOfWeek: string;
  dayNumber: number;
}

export interface SpendingSummary {
  totalSpent: number;
  averageDaily: number;
  mostExpensiveDay: { date: string; amount: number };
  mostCommonCategory: string;
  categoriesCount: number;
  daysWithSpending: number;
  budgetUtilization: number;
}

export interface WeeklyPattern {
  dayOfWeek: string;
  totalAmount: number;
  averageAmount: number;
  transactionCount: number;
}

// Color palette for charts (paper theme inspired)
export const chartColors = {
  primary: ['#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f'],
  amber: ['#fbbf24', '#f59e0b', '#d97706', '#b45309', '#92400e'],
  warm: ['#fb923c', '#f97316', '#ea580c', '#dc2626', '#b91c1c'],
  cool: ['#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af'],
  green: ['#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534'],
  mixed: ['#f59e0b', '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#f97316', '#06b6d4', '#84cc16']
};

/**
 * Process expenses to get category breakdown analytics
 */
export function getCategoryAnalytics(expenses: Expense[]): CategoryAnalytics[] {
  const categoryTotals = new Map<string, { amount: number; count: number }>();
  const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  expenses.forEach(expense => {
    const category = expense.category || 'Uncategorized';
    const current = categoryTotals.get(category) || { amount: 0, count: 0 };
    categoryTotals.set(category, {
      amount: current.amount + expense.amount,
      count: current.count + 1
    });
  });

  return Array.from(categoryTotals.entries())
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0,
      count: data.count
    }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Process expenses to get daily spending data
 */
export function getDailySpending(expenses: Expense[]): DailySpending[] {
  const dailyTotals = new Map<string, number>();

  expenses.forEach(expense => {
    const current = dailyTotals.get(expense.date) || 0;
    dailyTotals.set(expense.date, current + expense.amount);
  });

  return Array.from(dailyTotals.entries())
    .map(([date, amount]) => {
      // Parse "YYYY-MM-DD" in local time (new Date(string) would be UTC midnight)
      const [y, m, d] = date.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return {
        date,
        amount,
        dayOfWeek: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: dateObj.getDate()
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get cumulative spending data for budget tracking
 */
export function getCumulativeSpending(expenses: Expense[], budget: number): Array<{
  date: string;
  cumulative: number;
  budget: number;
  remaining: number;
  dayNumber: number;
}> {
  const dailySpending = getDailySpending(expenses);
  let cumulative = 0;

  return dailySpending.map(day => {
    cumulative += day.amount;
    return {
      date: day.date,
      cumulative,
      budget,
      remaining: Math.max(0, budget - cumulative),
      dayNumber: day.dayNumber
    };
  });
}

/**
 * Analyze weekly spending patterns
 */
export function getWeeklyPatterns(expenses: Expense[]): WeeklyPattern[] {
  const weeklyData = new Map<string, { total: number; count: number }>();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  expenses.forEach(expense => {
    // Parse "YYYY-MM-DD" in local time (new Date(string) would be UTC midnight)
    const [y, m, d] = expense.date.split('-').map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();
    const dayName = dayNames[dayOfWeek];
    const current = weeklyData.get(dayName) || { total: 0, count: 0 };
    weeklyData.set(dayName, {
      total: current.total + expense.amount,
      count: current.count + 1
    });
  });

  return dayNames.map(dayName => {
    const data = weeklyData.get(dayName) || { total: 0, count: 0 };
    return {
      dayOfWeek: dayName.slice(0, 3), // Short form
      totalAmount: data.total,
      averageAmount: data.count > 0 ? data.total / data.count : 0,
      transactionCount: data.count
    };
  });
}

/**
 * Generate comprehensive spending summary
 */
export function getSpendingSummary(expenses: Expense[], budget: number): SpendingSummary {
  const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const dailySpending = getDailySpending(expenses);
  const categoryAnalytics = getCategoryAnalytics(expenses);

  // Find most expensive day
  const mostExpensiveDay = dailySpending.reduce(
    (max, day) => day.amount > max.amount ? day : max,
    { date: '', amount: 0 }
  );

  // Find most common category
  const mostCommonCategory = categoryAnalytics.reduce(
    (max, cat) => cat.count > max.count ? cat : max,
    { category: 'None', count: 0 }
  ).category;

  // Calculate averages
  const daysWithSpending = dailySpending.length;
  const averageDaily = daysWithSpending > 0 ? totalSpent / daysWithSpending : 0;

  return {
    totalSpent,
    averageDaily,
    mostExpensiveDay: {
      date: mostExpensiveDay.date,
      amount: mostExpensiveDay.amount
    },
    mostCommonCategory,
    categoriesCount: categoryAnalytics.length,
    daysWithSpending,
    budgetUtilization: budget > 0 ? (totalSpent / budget) * 100 : 0
  };
}

/**
 * Get category spending over time for trend analysis
 */
export function getCategoryTrends(expenses: Expense[]): Array<{
  date: string;
  [category: string]: number | string;
}> {
  const dailyData = new Map<string, Map<string, number>>();

  // Group by date and category
  expenses.forEach(expense => {
    const category = expense.category || 'Uncategorized';
    if (!dailyData.has(expense.date)) {
      dailyData.set(expense.date, new Map());
    }
    const dayData = dailyData.get(expense.date)!;
    dayData.set(category, (dayData.get(category) || 0) + expense.amount);
  });

  // Get all unique categories
  const allCategories = new Set<string>();
  expenses.forEach(expense => {
    allCategories.add(expense.category || 'Uncategorized');
  });

  // Convert to chart-friendly format
  return Array.from(dailyData.entries())
    .map(([date, categoryData]) => {
      const result: { date: string; [category: string]: number | string } = { date };
      allCategories.forEach(category => {
        result[category] = categoryData.get(category) || 0;
      });
      return result;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate budget health score (0-100)
 */
export function getBudgetHealthScore(expenses: Expense[], budget: number, daysInMonth: number): {
  score: number;
  status: 'excellent' | 'good' | 'warning' | 'danger';
  message: string;
} {
  const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  // Guard against division by zero/NaN when no budget is set
  if (budget <= 0) {
    return { score: 0, status: 'warning', message: 'No budget set' };
  }

  const currentDay = new Date().getDate();
  const expectedSpending = (budget / daysInMonth) * currentDay;
  const spendingRatio = totalSpent / expectedSpending;

  let score = 100;
  let status: 'excellent' | 'good' | 'warning' | 'danger' = 'excellent';
  let message = 'Perfect budget control!';

  if (spendingRatio > 1.5) {
    score = 20;
    status = 'danger';
    message = 'Spending way above budget pace!';
  } else if (spendingRatio > 1.2) {
    score = 40;
    status = 'warning';
    message = 'Spending faster than budget allows';
  } else if (spendingRatio > 1.0) {
    score = 70;
    status = 'good';
    message = 'Slightly above budget pace';
  } else if (spendingRatio > 0.8) {
    score = 90;
    status = 'excellent';
    message = 'Great budget control!';
  }

  return { score, status, message };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
}

/**
 * Format percentage for display
 */
export function formatPercentage(percentage: number): string {
  return `${percentage.toFixed(1)}%`;
}