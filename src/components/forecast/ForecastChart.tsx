import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CumulativePoint } from "@/utils/forecast";
import { MONTHS_SHORT } from "@/utils/forecast";
import { formatCurrency } from "@/lib/utils";

function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) return `${n < 0 ? "-" : ""}$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return `${n < 0 ? "-" : ""}$${abs.toFixed(0)}`;
}

interface ForecastChartProps {
  series: CumulativePoint[];
  startBalance: number;
  /** 0-based current month for the base year; -1 to hide the marker. */
  todayIndex?: number;
}

/**
 * Cumulative balance over the year as a best/worst band with an expected line.
 */
export function ForecastChart({ series, startBalance, todayIndex = -1 }: ForecastChartProps) {
  const data = series.map((p) => ({
    label: p.label,
    worst: p.worst,
    band: p.best - p.worst,
    best: p.best,
    expected: (p.best + p.worst) / 2,
  }));

  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e1d3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: "#78716c" }}
          tickLine={false}
          axisLine={{ stroke: "#d6cfc0" }}
        />
        <YAxis
          tickFormatter={compact}
          tick={{ fontSize: 11, fill: "#78716c" }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            formatCurrency(value),
            name === "best" ? "Best" : name === "worst" ? "Worst" : "Expected",
          ]}
          labelClassName="font-bold"
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e7e1d3",
            fontSize: 12,
          }}
        />
        <ReferenceLine
          y={startBalance}
          stroke="#a8a29e"
          strokeDasharray="4 4"
        />
        {todayIndex >= 0 && (
          <ReferenceLine
            x={MONTHS_SHORT[todayIndex]}
            stroke="#f59e0b"
            strokeDasharray="3 3"
            label={{ value: "now", position: "top", fontSize: 10, fill: "#f59e0b" }}
          />
        )}
        {/* Invisible base + shaded band = best/worst range */}
        <Area
          type="monotone"
          dataKey="worst"
          stackId="band"
          stroke="none"
          fill="transparent"
          isAnimationActive={false}
          legendType="none"
          activeDot={false}
        />
        <Area
          type="monotone"
          dataKey="band"
          stackId="band"
          stroke="none"
          fill="url(#bandFill)"
          isAnimationActive={false}
          legendType="none"
          activeDot={false}
        />
        <Line
          type="monotone"
          dataKey="best"
          stroke="#16a34a"
          strokeWidth={2.5}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="worst"
          stroke="#dc2626"
          strokeWidth={2.5}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="expected"
          stroke="#6b7280"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export default ForecastChart;
