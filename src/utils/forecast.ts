import type { ForecastFlow } from "@/lib/data-service";

export const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
export const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type Bounds = { best: number; worst: number };

// Signed best/worst contribution of a flow for one occurrence (one month).
// Outflows are negative. Best case maximizes balance, worst minimizes it.
export function flowBounds(flow: ForecastFlow): Bounds {
  const sign = flow.type === "out" ? -1 : 1;
  if (flow.uncertain) {
    const lo = sign * (flow.lowValue ?? 0);
    const hi = sign * (flow.highValue ?? 0);
    return { best: Math.max(lo, hi), worst: Math.min(lo, hi) };
  }
  const v = sign * (flow.value ?? 0);
  return { best: v, worst: v };
}

// Magnitude used for list display (mid-point for uncertain).
export function flowDisplayAmount(flow: ForecastFlow): number {
  if (flow.uncertain) {
    return ((flow.lowValue ?? 0) + (flow.highValue ?? 0)) / 2;
  }
  return flow.value ?? 0;
}

export type MonthBucket = {
  inBest: number;
  inWorst: number;
  outBest: number; // negative
  outWorst: number; // negative
  netBest: number;
  netWorst: number;
};

function emptyBucket(): MonthBucket {
  return { inBest: 0, inWorst: 0, outBest: 0, outWorst: 0, netBest: 0, netWorst: 0 };
}

// Per-month best/worst aggregation for one year (enabled flows only).
export function monthlyBuckets(
  flows: ForecastFlow[],
  year: number,
): MonthBucket[] {
  const months: MonthBucket[] = Array.from({ length: 12 }, emptyBucket);
  for (const f of flows) {
    if (f.enabled === false || f.year !== year) continue;
    const b = flowBounds(f);
    for (const m of f.months) {
      const idx = m - 1;
      if (idx < 0 || idx > 11) continue;
      const bucket = months[idx];
      bucket.netBest += b.best;
      bucket.netWorst += b.worst;
      if (f.type === "in") {
        bucket.inBest += b.best;
        bucket.inWorst += b.worst;
      } else {
        bucket.outBest += b.best;
        bucket.outWorst += b.worst;
      }
    }
  }
  return months;
}

// Net total (best/worst) of a whole year's enabled flows.
export function yearNet(flows: ForecastFlow[], year: number): Bounds {
  return monthlyBuckets(flows, year).reduce(
    (acc, m) => ({ best: acc.best + m.netBest, worst: acc.worst + m.netWorst }),
    { best: 0, worst: 0 },
  );
}

// Starting balance for `year`, grounded to the real accounts total at `baseYear`.
// For years after the base year we roll the anchor forward through the
// intervening years' net flows; the base year itself starts at the anchor.
export function startingBalance(
  flows: ForecastFlow[],
  year: number,
  anchor: number,
  baseYear: number,
): Bounds {
  const start: Bounds = { best: anchor, worst: anchor };
  if (year > baseYear) {
    for (let y = baseYear; y < year; y++) {
      const n = yearNet(flows, y);
      start.best += n.best;
      start.worst += n.worst;
    }
  }
  return start;
}

export type CumulativePoint = {
  label: string;
  monthIndex: number; // -1 for the starting point
  best: number;
  worst: number;
  netBest: number;
  netWorst: number;
};

// Running end-of-month balance band, prefixed with the starting point.
export function cumulativeSeries(
  buckets: MonthBucket[],
  start: Bounds,
): CumulativePoint[] {
  const points: CumulativePoint[] = [
    { label: "Start", monthIndex: -1, best: start.best, worst: start.worst, netBest: 0, netWorst: 0 },
  ];
  let runBest = start.best;
  let runWorst = start.worst;
  for (let i = 0; i < 12; i++) {
    runBest += buckets[i].netBest;
    runWorst += buckets[i].netWorst;
    points.push({
      label: MONTHS_SHORT[i],
      monthIndex: i,
      best: runBest,
      worst: runWorst,
      netBest: buckets[i].netBest,
      netWorst: buckets[i].netWorst,
    });
  }
  return points;
}

// Full computed model for one year.
export type ForecastModel = {
  start: Bounds;
  buckets: MonthBucket[];
  series: CumulativePoint[];
  yearEnd: Bounds;
};

export function computeForecast(
  flows: ForecastFlow[],
  year: number,
  anchor: number,
  baseYear: number,
): ForecastModel {
  const buckets = monthlyBuckets(flows, year);
  const start = startingBalance(flows, year, anchor, baseYear);
  const series = cumulativeSeries(buckets, start);
  const last = series[series.length - 1];
  return { start, buckets, series, yearEnd: { best: last.best, worst: last.worst } };
}

// ---- Import from the standalone cashflow-uncertainty tool ----
// Old amounts are in "k" (thousands); convert to real currency.
const K_TO_DOLLARS = 1000;

type OldFlow = {
  year: number;
  month?: number;
  months?: number[];
  type: "in" | "out";
  name?: string | null;
  value?: number;
  lowValue?: number;
  highValue?: number;
  uncertain?: boolean;
  enabled?: boolean;
  isGhost?: boolean;
};

// Accepts the object {cashFlowData, ghostFlowData} (values may be JSON strings
// or already-parsed arrays), or a raw array of old flows. Returns flows ready to
// insert (merged by identical signature into multi-month flows, k -> dollars).
export function parseOldToolData(input: unknown): Array<Omit<ForecastFlow, "id">> {
  const asArray = (v: unknown): OldFlow[] => {
    if (!v) return [];
    if (typeof v === "string") {
      try { return JSON.parse(v) as OldFlow[]; } catch { return []; }
    }
    return Array.isArray(v) ? (v as OldFlow[]) : [];
  };

  let cash: OldFlow[] = [];
  let ghost: OldFlow[] = [];

  if (Array.isArray(input)) {
    cash = input as OldFlow[];
  } else if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    cash = asArray(obj.cashFlowData ?? obj.cashFlows);
    ghost = asArray(obj.ghostFlowData ?? obj.ghostFlows);
  } else if (typeof input === "string") {
    // Maybe the whole thing is a JSON string
    try {
      return parseOldToolData(JSON.parse(input));
    } catch {
      return [];
    }
  }

  // Merge per-month rows that share an identical signature into one flow.
  const merged = new Map<string, Omit<ForecastFlow, "id">>();
  let order = 0;

  const ingest = (f: OldFlow, isGhost: boolean) => {
    const uncertain = !!f.uncertain;
    const value = uncertain ? undefined : Math.abs(f.value ?? 0) * K_TO_DOLLARS;
    const lowValue = uncertain ? Math.abs(f.lowValue ?? 0) * K_TO_DOLLARS : undefined;
    const highValue = uncertain ? Math.abs(f.highValue ?? 0) * K_TO_DOLLARS : undefined;
    const monthsIn = f.months ?? (f.month ? [f.month] : []);
    const name = f.name ?? "";
    const key = [
      f.year, f.type, name, uncertain ? 1 : 0, isGhost ? 1 : 0,
      value ?? "", lowValue ?? "", highValue ?? "",
    ].join("|");

    const existing = merged.get(key);
    if (existing) {
      for (const m of monthsIn) {
        if (!existing.months.includes(m)) existing.months.push(m);
      }
      existing.months.sort((a, b) => a - b);
    } else {
      merged.set(key, {
        year: f.year,
        months: [...monthsIn].sort((a, b) => a - b),
        type: f.type,
        name: name || undefined,
        uncertain,
        value,
        lowValue,
        highValue,
        isGhost,
        enabled: f.enabled !== false,
        sortOrder: order++,
      });
    }
  };

  cash.forEach((f) => ingest(f, false));
  ghost.forEach((f) => ingest(f, true));

  return Array.from(merged.values()).filter((f) => f.months.length > 0);
}
