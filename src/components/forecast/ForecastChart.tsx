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
import { cn, formatCurrency } from "@/lib/utils";
import { formatCurrencyCompact } from "@/lib/currency";

const compact = (n: number) => formatCurrencyCompact(n);
import { Activity, Spline } from "lucide-react";
import { useState } from "react";

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
  const [discrete, setDiscrete] = useState(false);
  const lineType = discrete ? "linear" : "monotone";
  const data = series.map((p) => ({
    label: p.label,
    worst: p.worst,
    band: p.best - p.worst,
    best: p.best,
    expected: (p.best + p.worst) / 2,
  }));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setDiscrete((d) => !d)}
        title={discrete ? "Curved lines" : "Straight lines with points"}
        className={cn(
          "absolute right-0 -top-1 z-10 w-7 h-7 rounded-md flex items-center justify-center border transition-colors cursor-pointer",
          discrete
            ? "bg-amber-500 text-white border-amber-500"
            : "bg-white text-stone-500 border-stone-200 hover:border-amber-300",
        )}
      >
        {discrete ? <Activity className="w-4 h-4" /> : <Spline className="w-4 h-4" />}
      </button>
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
        <Tooltip content={<BestWorstTooltip />} />
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
          type={lineType}
          dataKey="worst"
          stackId="band"
          stroke="none"
          fill="transparent"
          isAnimationActive={false}
          legendType="none"
          activeDot={false}
        />
        <Area
          type={lineType}
          dataKey="band"
          stackId="band"
          stroke="none"
          fill="url(#bandFill)"
          isAnimationActive={false}
          legendType="none"
          activeDot={false}
        />
        <Line
          type={lineType}
          dataKey="best"
          stroke="#16a34a"
          strokeWidth={2.5}
          dot={discrete}
        />
        <Line
          type={lineType}
          dataKey="worst"
          stroke="#dc2626"
          strokeWidth={2.5}
          dot={discrete}
        />
        <Line
          type={lineType}
          dataKey="expected"
          stroke="#6b7280"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          dot={discrete}
        />
      </ComposedChart>
    </ResponsiveContainer>
    </div>
  );
}

// Tooltip showing only Best and Worst for the hovered month.
function BestWorstTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const get = (k: string) => payload.find((p) => p.dataKey === k)?.value;
  const best = get("best");
  const worst = get("worst");
  if (best == null && worst == null) return null;
  return (
    <div
      className="rounded-xl border bg-white px-3 py-2 text-xs shadow-md"
      style={{ borderColor: "#e7e1d3" }}
    >
      <div className="font-bold text-stone-700 mb-1">{label}</div>
      <div className="flex items-center justify-between gap-5">
        <span className="text-green-600">Best</span>
        <span className="font-bold tabular-nums text-stone-700">
          {formatCurrency(best ?? 0)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-5">
        <span className="text-red-600">Worst</span>
        <span className="font-bold tabular-nums text-stone-700">
          {formatCurrency(worst ?? 0)}
        </span>
      </div>
    </div>
  );
}

export default ForecastChart;
