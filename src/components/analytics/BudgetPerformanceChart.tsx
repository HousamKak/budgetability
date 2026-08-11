import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { chartColors, formatCurrency } from '@/utils/analytics';
import { formatCurrencyCompact } from '@/lib/currency';
import { paperTheme } from '@/styles';

interface BudgetPerformanceData {
  date: string;
  cumulative: number;
  budget: number;
  remaining: number;
  dayNumber: number;
}

interface BudgetPerformanceChartProps {
  data: BudgetPerformanceData[];
}

export function BudgetPerformanceChart({ data }: BudgetPerformanceChartProps) {
  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className={`${paperTheme.colors.background.white} ${paperTheme.colors.borders.paper} ${paperTheme.radius.md} p-3 ${paperTheme.effects.shadow.md}`}>
          <p className={`font-semibold ${paperTheme.colors.text.primary} ${paperTheme.fonts.handwriting}`}>
            Day {data.dayNumber}
          </p>
          <p className={`${paperTheme.colors.text.accent} text-sm`}>
            Spent: {formatCurrency(data.cumulative)}
          </p>
          <p className={`${paperTheme.colors.text.muted} text-sm`}>
            Remaining: {formatCurrency(data.remaining)}
          </p>
          <p className={`${paperTheme.colors.text.secondary} text-xs`}>
            Budget: {formatCurrency(data.budget)}
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
          No budget performance data available
        </p>
      </div>
    );
  }

  const maxBudget = Math.max(...data.map(d => d.budget));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart
        data={data}
        margin={{
          top: 10,
          right: 30,
          left: 0,
          bottom: 0,
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
        <ReferenceLine
          y={maxBudget}
          stroke={chartColors.warm[3]}
          strokeDasharray="5 5"
          label={{ value: "Budget Limit", position: "top" }}
        />
        <Area
          type="monotone"
          dataKey="cumulative"
          stackId="1"
          stroke={chartColors.amber[2]}
          fill={chartColors.amber[0]}
          fillOpacity={0.6}
        />
        <Area
          type="monotone"
          dataKey="remaining"
          stackId="1"
          stroke={chartColors.green[2]}
          fill={chartColors.green[0]}
          fillOpacity={0.4}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}