import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { DailySpending } from '@/utils/analytics';
import { chartColors, formatCurrency } from '@/utils/analytics';
import { formatCurrencyCompact } from '@/lib/currency';
import { paperTheme } from '@/styles';

interface DailySpendingChartProps {
  data: DailySpending[];
}

export function DailySpendingChart({ data }: DailySpendingChartProps) {
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
        </div>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <p className={`${paperTheme.colors.text.muted} ${paperTheme.fonts.handwriting} text-lg`}>
          No daily spending data available
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={data}
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
          stroke={chartColors.amber[2]}
          strokeWidth={3}
          dot={{ fill: chartColors.amber[1], strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, stroke: chartColors.amber[2], strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}