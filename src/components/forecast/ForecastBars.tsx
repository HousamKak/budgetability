import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthBucket } from "@/utils/forecast";
import { MONTHS_SHORT } from "@/utils/forecast";
import { formatCurrency } from "@/lib/utils";
import { formatCurrencyCompact } from "@/lib/currency";

const compact = (n: number) => formatCurrencyCompact(n);

interface ForecastBarsProps {
  buckets: MonthBucket[];
}

/**
 * Per-month inflows (up) vs outflows (down) with an expected-net line.
 * Uses the mid-point of each month's best/worst range.
 */
export function ForecastBars({ buckets }: ForecastBarsProps) {
  const data = buckets.map((b, i) => ({
    label: MONTHS_SHORT[i],
    inflow: (b.inBest + b.inWorst) / 2,
    outflow: (b.outBest + b.outWorst) / 2, // negative
    net: (b.netBest + b.netWorst) / 2,
  }));

  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={data} stackOffset="sign" margin={{ top: 10, right: 16, bottom: 0, left: 4 }}>
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
            name === "inflow" ? "Inflow" : name === "outflow" ? "Outflow" : "Net",
          ]}
          contentStyle={{ borderRadius: 12, border: "1px solid #e7e1d3", fontSize: 12 }}
        />
        <ReferenceLine y={0} stroke="#d6cfc0" />
        <Bar dataKey="inflow" stackId="m" fill="#22c55e" radius={[3, 3, 0, 0]} />
        <Bar dataKey="outflow" stackId="m" fill="#ef4444" radius={[0, 0, 3, 3]} />
        <Line type="monotone" dataKey="net" stroke="#6b7280" strokeWidth={2} dot={{ r: 2 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export default ForecastBars;
