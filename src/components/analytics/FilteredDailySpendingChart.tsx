import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Filter, TrendingUp } from 'lucide-react';
import type { Expense } from '@/lib/data-service';
import { chartColors, formatCurrency } from '@/utils/analytics';
import { formatCurrencyCompact } from '@/lib/currency';
import { paperTheme } from '@/styles';

interface FilteredDailySpendingChartProps {
  expenses: Expense[];
}

export function FilteredDailySpendingChart({ expenses }: FilteredDailySpendingChartProps) {
  // Get unique categories from expenses
  const categories = useMemo(() => {
    const categorySet = new Set(expenses.map(expense => expense.category || 'Uncategorized'));
    return ['All Categories', ...Array.from(categorySet).sort()];
  }, [expenses]);

  const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');

  // Filter expenses by selected category and generate daily spending data
  const dailySpendingData = useMemo(() => {
    const filteredExpenses = selectedCategory === 'All Categories'
      ? expenses
      : expenses.filter(expense => (expense.category || 'Uncategorized') === selectedCategory);

    const dailyTotals = new Map<string, number>();

    filteredExpenses.forEach(expense => {
      const current = dailyTotals.get(expense.date) || 0;
      dailyTotals.set(expense.date, current + expense.amount);
    });

    return Array.from(dailyTotals.entries())
      .map(([date, amount]) => {
        const dateObj = new Date(date);
        return {
          date,
          amount,
          dayOfWeek: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
          dayNumber: dateObj.getDate()
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [expenses, selectedCategory]);

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className={`${paperTheme.colors.background.white} ${paperTheme.colors.borders.paper} ${paperTheme.radius.md} p-3 ${paperTheme.effects.shadow.md}`}>
          <p className={`font-semibold ${paperTheme.colors.text.primary} ${paperTheme.fonts.handwriting}`}>
            Day {data.dayNumber} ({data.dayOfWeek})
          </p>
          <p className={`${paperTheme.colors.text.accent} text-sm`}>
            {formatCurrency(data.amount)}
          </p>
          {selectedCategory !== 'All Categories' && (
            <p className={`${paperTheme.colors.text.muted} text-xs`}>
              {selectedCategory}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      {/* Header with category filter */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-amber-600" />
          <h2 className="text-xl font-bold text-stone-800 handwriting">Daily Spending by Category</h2>
        </div>

        {/* Category Filter Dropdown */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-stone-600" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={`px-3 py-2 text-sm rounded-md border border-amber-200 bg-white/80 ${paperTheme.fonts.handwriting} text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500`}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Chart */}
      {dailySpendingData.length === 0 ? (
        <div className="h-64 flex items-center justify-center">
          <p className={`${paperTheme.colors.text.muted} ${paperTheme.fonts.handwriting} text-lg`}>
            No spending data for {selectedCategory}
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={dailySpendingData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
            <XAxis
              dataKey="dayNumber"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickFormatter={(value) => `Day ${value}`}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickFormatter={(value) => formatCurrencyCompact(Number(value))}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="amount"
              stroke={selectedCategory === 'All Categories' ? chartColors.amber[2] : chartColors.mixed[categories.indexOf(selectedCategory) % chartColors.mixed.length]}
              strokeWidth={3}
              dot={{
                fill: selectedCategory === 'All Categories' ? chartColors.amber[1] : chartColors.mixed[categories.indexOf(selectedCategory) % chartColors.mixed.length],
                strokeWidth: 2,
                r: 4
              }}
              activeDot={{
                r: 6,
                stroke: selectedCategory === 'All Categories' ? chartColors.amber[2] : chartColors.mixed[categories.indexOf(selectedCategory) % chartColors.mixed.length],
                strokeWidth: 2
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}