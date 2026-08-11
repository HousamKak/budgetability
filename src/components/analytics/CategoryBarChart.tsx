import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { CategoryAnalytics } from '@/utils/analytics';
import { chartColors, formatCurrency } from '@/utils/analytics';
import { formatCurrencyCompact } from '@/lib/currency';
import { paperTheme } from '@/styles';

interface CategoryBarChartProps {
  data: CategoryAnalytics[];
}

export function CategoryBarChart({ data }: CategoryBarChartProps) {
  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className={`${paperTheme.colors.background.white} ${paperTheme.colors.borders.paper} ${paperTheme.radius.md} p-3 ${paperTheme.effects.shadow.md}`}>
          <p className={`font-semibold ${paperTheme.colors.text.primary} ${paperTheme.fonts.handwriting}`}>
            {label}
          </p>
          <p className={`${paperTheme.colors.text.accent} text-sm`}>
            Amount: {formatCurrency(data.amount)}
          </p>
          <p className={`${paperTheme.colors.text.muted} text-xs`}>
            {data.count} transaction{data.count !== 1 ? 's' : ''}
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
          No spending data available
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
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
          dataKey="category"
          tick={{ fontSize: 12, fill: '#6b7280' }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickFormatter={(value) => formatCurrencyCompact(Number(value))}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar
          dataKey="amount"
          fill={chartColors.amber[1]}
          stroke={chartColors.amber[2]}
          strokeWidth={1}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}