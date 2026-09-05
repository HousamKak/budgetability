import { Button } from "@/components/ui/button";
import type {
  Account,
  ForecastFlow,
  ForecastSourceKind,
} from "@/lib/data-service";
import { dataService } from "@/lib/data-service";
import { cn, formatCurrency } from "@/lib/utils";
import { paperTheme } from "@/styles";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Ghost,
  Link2,
  Link2Off,
  LineChart as LineChartIcon,
  Pencil,
  Plus,
  RefreshCw,
  Rows3,
  Settings2,
  Sigma,
  Table as TableIcon,
  Trash2,
  TrendingUp,
  Upload,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ForecastBars } from "./forecast/ForecastBars";
import { ForecastChart } from "./forecast/ForecastChart";
import { ForecastFlowDialog } from "./forecast/ForecastFlowDialog";
import { ForecastImportDialog } from "./forecast/ForecastImportDialog";
import { ForecastStartDialog } from "./forecast/ForecastStartDialog";
import {
  MONTHS_FULL,
  MONTHS_SHORT,
  computeForecast,
  flowBounds,
  flowDisplayAmount,
} from "@/utils/forecast";

type View = "line" | "bars" | "table" | "calendar" | "ledger";
type SourceFilter = "all" | "manual" | "linked" | "rules";

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH_IDX = new Date().getMonth(); // 0..11, for the "now" marker
const START_KEY = "forecast-opening-balance";

// Where a line's number came from, by colour: amber for one you typed, sky for
// one linked to a single record, teal for one computed from many. Violet stays
// ghosts, and green/red keep encoding direction.
const SOURCE_LABEL: Record<ForecastSourceKind, string> = {
  expense: "Expense",
  plan: "Plan",
  deposit: "Income",
  rule: "Rule",
};

function loadStartBalance(): number {
  try {
    const raw = localStorage.getItem(START_KEY);
    const n = raw == null ? 0 : parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function monthsLabel(months: number[]): string {
  if (months.length === 12) return "All year";
  return months.map((m) => MONTHS_SHORT[m - 1]).join(" ");
}

export default function ForecastPage() {
  // Typed and computed flows both live in forecast_flows and are split here
  // because a computed one carries no amount until it's expanded into
  // per-month lines. Flows derived from individually marked records are kept
  // apart again — they persist differently. All merged for display and maths.
  const [manualFlows, setManualFlows] = useState<ForecastFlow[]>([]);
  const [ruleDefs, setRuleDefs] = useState<ForecastFlow[]>([]);
  const [linkedFlows, setLinkedFlows] = useState<ForecastFlow[]>([]);
  const [ruleFlows, setRuleFlows] = useState<ForecastFlow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [view, setView] = useState<View>("line");

  const [showFlowDialog, setShowFlowDialog] = useState(false);
  const [editingFlow, setEditingFlow] = useState<ForecastFlow | undefined>();
  const [showImport, setShowImport] = useState(false);
  const [flowsView, setFlowsView] = useState<"flow" | "month">("month");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [startBalance, setStartBalance] = useState<number>(loadStartBalance);
  const [showStartDialog, setShowStartDialog] = useState(false);

  // Rules are evaluated against the year on screen, so a year change reloads.
  useEffect(() => {
    loadData();
  }, [year]);

  async function loadData() {
    try {
      setLoading(true);
      const [stored, linked, accts] = await Promise.all([
        dataService.getForecastFlows(),
        dataService.getLinkedForecastFlows(),
        dataService.getAccounts(),
      ]);
      const defs = stored.filter((f) => f.rule);
      setManualFlows(stored.filter((f) => !f.rule));
      setRuleDefs(defs);
      setLinkedFlows(linked);
      setAccounts(accts);
      setRuleFlows(await dataService.evaluateRuleFlows(defs, year));
    } catch (e) {
      console.error("Failed to load forecast:", e);
    } finally {
      setLoading(false);
    }
  }

  const flows = useMemo(
    () => [...manualFlows, ...linkedFlows, ...ruleFlows],
    [manualFlows, linkedFlows, ruleFlows],
  );

  // The opening balance applies at the earliest year we have flows for; each
  // later year carries forward from the previous. Independent of accounts.
  const baseYear = useMemo(() => {
    if (flows.length === 0) return CURRENT_YEAR;
    return Math.min(...flows.map((f) => f.year));
  }, [flows]);

  const saveStartBalance = (value: number) => {
    setStartBalance(value);
    try {
      localStorage.setItem(START_KEY, String(value));
    } catch {
      /* ignore */
    }
  };

  const model = useMemo(
    () => computeForecast(flows, year, startBalance, baseYear),
    [flows, year, startBalance, baseYear],
  );

  // Purely-visual "now" marker (only when viewing the current calendar year).
  const todayIndex = year === CURRENT_YEAR ? CURRENT_MONTH_IDX : -1;

  // Everything in this year — what the chart card's views render. The chart
  // always shows the whole picture; the source filter below is a lens on the
  // flows list only, never on the maths.
  const yearFlows = useMemo(
    () =>
      flows
        .filter((f) => f.year === year)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [flows, year],
  );

  const listedFlows = useMemo(
    () =>
      yearFlows.filter((f) => {
        const kind = f.source?.kind;
        switch (sourceFilter) {
          case "manual":
            return !kind;
          case "linked":
            return !!kind && kind !== "rule";
          case "rules":
            return kind === "rule";
          default:
            return true;
        }
      }),
    [yearFlows, sourceFilter],
  );

  // A rule is one thing with one switch, so the By-flow list shows a single
  // row per rule — its year total — rather than the twelve monthly lines it
  // emits. By month they stay separate, which is the whole point of them.
  // Every rule is listed whether or not it produced anything this year, so a
  // muted or empty rule stays visible and switchable.
  const ruleRows = useMemo<ForecastFlow[]>(
    () =>
      ruleDefs
        .filter((def) => def.year === year)
        .map((def) => {
          const mine = ruleFlows.filter((f) => f.source?.id === def.id);
          return {
            ...def,
            // The stored row holds no amount; show the year total it produced.
            value: mine.reduce((s, f) => s + (f.value ?? 0), 0),
            source: {
              kind: "rule" as const,
              id: def.id,
              monthKey: `${year}-01`,
            },
          };
        }),
    [ruleDefs, ruleFlows, year],
  );

  const byFlowList = useMemo(() => {
    const withoutRules = listedFlows.filter((f) => f.source?.kind !== "rule");
    const showRules = sourceFilter === "all" || sourceFilter === "rules";
    return showRules ? [...withoutRules, ...ruleRows] : withoutRules;
  }, [listedFlows, ruleRows, sourceFilter]);

  const linkedCount = useMemo(
    () => yearFlows.filter((f) => f.source && f.source.kind !== "rule").length,
    [yearFlows],
  );

  // The same flows grouped under each month they occur in (for the by-month
  // flows list). A multi-month flow appears under each of its months.
  const flowsByMonth = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => i + 1)
        .map((month) => ({
          month,
          entries: listedFlows.filter((f) => f.months.includes(month)),
        }))
        .filter((m) => m.entries.length > 0),
    [listedFlows],
  );

  // ---- handlers ----
  const handleSubmitFlow = async (
    flow: Omit<ForecastFlow, "id" | "sortOrder">,
    memberIds?: string[],
  ) => {
    try {
      let flowId: string;
      if (editingFlow) {
        await dataService.updateForecastFlow(editingFlow.id, flow);
        flowId = editingFlow.id;
      } else {
        // Members point at the flow, so it has to exist before they can.
        const created = await dataService.addForecastFlow({
          ...flow,
          sortOrder: manualFlows.length,
        });
        flowId = created.id;
      }
      if (memberIds) await dataService.setFlowMembers(flowId, memberIds);
      setEditingFlow(undefined);
      await loadData();
    } catch (e) {
      console.error("Failed to save flow:", e);
    }
  };

  // "Separate flow per month": the dialog hands back one flow per selected
  // month; each is stored as its own record with its own id.
  const handleSubmitFlowsSplit = async (
    flows: Array<Omit<ForecastFlow, "id" | "sortOrder">>,
  ) => {
    try {
      const base = manualFlows.length;
      await dataService.addForecastFlows(
        flows.map((f, i) => ({ ...f, sortOrder: base + i })),
      );
      await loadData();
    } catch (e) {
      console.error("Failed to save flows:", e);
    }
  };

  const handleImport = async (
    incoming: Array<Omit<ForecastFlow, "id">>,
  ) => {
    try {
      const base = manualFlows.length;
      await dataService.addForecastFlows(
        incoming.map((f, i) => ({ ...f, sortOrder: base + i })),
      );
      await loadData();
    } catch (e) {
      console.error("Failed to import flows:", e);
    }
  };

  // On/off is available for linked flows too — the forecast is a scratchpad for
  // analysis, so you can mute a real expense without unlinking or deleting it.
  const toggleFlow = async (f: ForecastFlow) => {
    const next = !f.enabled;

    // A computed flow's switch lives on the stored row, so one click mutes
    // every month it expanded into.
    if (f.source?.kind === "rule") {
      const defId = f.source.id;
      setRuleDefs((prev) =>
        prev.map((d) => (d.id === defId ? { ...d, enabled: next } : d)),
      );
      setRuleFlows((prev) =>
        prev.map((x) => (x.source?.id === defId ? { ...x, enabled: next } : x)),
      );
      try {
        await dataService.updateForecastFlow(defId, { enabled: next });
      } catch (e) {
        console.error(e);
        await loadData();
      }
      return;
    }

    const setter = f.source ? setLinkedFlows : setManualFlows;
    setter((prev) =>
      prev.map((x) => (x.id === f.id ? { ...x, enabled: next } : x)),
    );
    try {
      if (f.source) {
        await dataService.setForecastLink(f.source, { forecastEnabled: next });
      } else {
        await dataService.updateForecastFlow(f.id, { enabled: next });
      }
    } catch (e) {
      console.error(e);
      await loadData();
    }
  };

  // Manual flows are deleted outright; linked ones are only unmarked, which
  // takes them off this page and leaves the real record untouched.
  const deleteFlow = async (f: ForecastFlow) => {
    const label = f.name || "flow";

    if (f.source?.kind === "rule") {
      if (
        !confirm(
          `Delete "${label}"?\n\nIt stops totalling on the forecast. None of your expenses, plans or income are touched.`,
        )
      )
        return;
      try {
        await dataService.removeForecastFlow(f.source.id);
        await loadData();
      } catch (e) {
        console.error(e);
      }
      return;
    }

    if (f.source) {
      const kind = SOURCE_LABEL[f.source.kind].toLowerCase();
      if (
        !confirm(
          `Remove "${label}" from the forecast?\n\nThe ${kind} itself stays exactly where it is — this only unmarks it.`,
        )
      )
        return;
      try {
        await dataService.setForecastLink(f.source, { inForecast: false });
        await loadData();
      } catch (e) {
        console.error(e);
      }
      return;
    }

    if (!confirm(`Delete "${label}"?`)) return;
    try {
      await dataService.removeForecastFlow(f.id);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  // Linked flows are read-only here: their amount, name and month belong to the
  // source record, so there is nothing on this page to edit.
  const editFlow = (f: ForecastFlow) => {
    // A computed flow is editable — it's a flow, and the same dialog opens on
    // it. Records linked one-by-one are not: everything about them lives on
    // the record itself.
    if (f.source?.kind === "rule") {
      const def = ruleDefs.find((d) => d.id === f.source!.id);
      if (def) {
        setEditingFlow(def);
        setShowFlowDialog(true);
      }
      return;
    }
    if (f.source) return;
    setEditingFlow(f);
    setShowFlowDialog(true);
  };

  const netBest = model.yearEnd.best - model.start.best;
  const netWorst = model.yearEnd.worst - model.start.worst;

  // How much of this year has actually happened. A past year is wholly behind
  // us, a future one wholly ahead — so "to date" means all twelve months or
  // none of them, and only the current year is genuinely part-way through.
  const monthsElapsed =
    year < CURRENT_YEAR ? 12 : year > CURRENT_YEAR ? 0 : CURRENT_MONTH_IDX + 1;

  const totals = useMemo(() => {
    let outBest = 0, outWorst = 0, inBest = 0, inWorst = 0;
    let ytdOut = 0, ytdIn = 0;
    model.buckets.forEach((b, i) => {
      // Outflow bounds are negative; report them as magnitudes.
      outBest += Math.abs(b.outBest);
      outWorst += Math.abs(b.outWorst);
      inBest += b.inBest;
      inWorst += b.inWorst;
      if (i < monthsElapsed) {
        // Elapsed months are almost always certain, so the mid-point is the
        // honest single figure rather than a band of nearly zero width.
        ytdOut += (Math.abs(b.outBest) + Math.abs(b.outWorst)) / 2;
        ytdIn += (b.inBest + b.inWorst) / 2;
      }
    });
    return { outBest, outWorst, inBest, inWorst, ytdOut, ytdIn };
  }, [model, monthsElapsed]);

  const VIEWS: { key: View; label: string; icon: typeof LineChartIcon }[] = [
    { key: "line", label: "Balance", icon: LineChartIcon },
    { key: "bars", label: "Bars", icon: BarChart3 },
    { key: "table", label: "Columns", icon: TableIcon },
    { key: "calendar", label: "Calendar", icon: CalendarDays },
    { key: "ledger", label: "By Month", icon: Rows3 },
  ];

  return (
    <div className="min-h-screen w-full p-4 md:p-8 max-lg:pb-24 bg-[repeating-linear-gradient(0deg,#fbf6e9,#fbf6e9_28px,#f2e8cf_28px,#f2e8cf_29px)]">
      <div
        className={cn(
          "fixed inset-0 opacity-5 pointer-events-none",
          paperTheme.effects.paperTexture,
        )}
      />
      <div className="max-w-6xl mx-auto relative">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-3 rounded-xl",
                paperTheme.colors.background.white,
                paperTheme.colors.borders.amber,
                paperTheme.effects.shadow.md,
              )}
            >
              <TrendingUp className="w-8 h-8 text-amber-600" />
            </div>
            <div>
              <h1
                className={cn(
                  "text-3xl font-bold",
                  paperTheme.colors.text.accent,
                  paperTheme.fonts.handwriting,
                )}
              >
                Forecast
              </h1>
              <p className="text-stone-500 text-sm">
                Project your cash flow with best / worst uncertainty
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Year nav */}
            <div
              className={cn(
                "flex items-center rounded-xl border-2 bg-white",
                paperTheme.colors.borders.amber,
              )}
            >
              <button
                onClick={() => setYear((y) => y - 1)}
                className="px-2 py-1.5 text-stone-500 hover:text-amber-600 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className={cn("px-2 font-bold text-stone-700", paperTheme.fonts.handwriting)}>
                {year}
              </span>
              <button
                onClick={() => setYear((y) => y + 1)}
                className="px-2 py-1.5 text-stone-500 hover:text-amber-600 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImport(true)}
              className={cn(paperTheme.colors.borders.amber)}
            >
              <Upload className="w-4 h-4 mr-1" />
              Import
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditingFlow(undefined);
                setShowFlowDialog(true);
              }}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              New Flow
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        {/* Five tracks so the two-figure card can take a double slot without
            squeezing the single-figure ones. */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <SummaryCard
            label={year === baseYear ? "Opening balance" : `Start of ${year}`}
            value={formatCurrency(model.start.best)}
            hint={
              year === baseYear
                ? `Jan ${baseYear} · edit`
                : `carried from ${baseYear} · edit`
            }
            tone="neutral"
            onClick={() => setShowStartDialog(true)}
          />
          <RangeCard
            label={`End of ${year}`}
            best={model.yearEnd.best}
            worst={model.yearEnd.worst}
            bestHint={`${netBest >= 0 ? "+" : ""}${formatCurrency(netBest)} net`}
            worstHint={`${netWorst >= 0 ? "+" : ""}${formatCurrency(netWorst)} net`}
            hint={`${formatCurrency(model.yearEnd.best - model.yearEnd.worst)} spread`}
          />
          <SummaryCard
            label={`Total spend · ${year}`}
            value={band(totals.outWorst, totals.outBest)}
            hint={`${band(totals.inWorst, totals.inBest)} in`}
            tone="worst"
          />
          <SummaryCard
            label={
              monthsElapsed === 0
                ? `Spent so far · ${year}`
                : monthsElapsed === 12
                  ? `Spent · all of ${year}`
                  : `Spent so far · through ${MONTHS_SHORT[monthsElapsed - 1]}`
            }
            value={formatCurrency(totals.ytdOut)}
            hint={
              monthsElapsed === 0
                ? "hasn't started yet"
                : `${formatCurrency(totals.ytdIn)} in · ${
                    totals.ytdIn - totals.ytdOut >= 0 ? "+" : "−"
                  }${formatCurrency(Math.abs(totals.ytdIn - totals.ytdOut))} net`
            }
            tone="neutral"
          />
        </div>

        {/* Chart card with view switcher */}
        <div
          className={cn(
            "rounded-2xl p-4 mb-6 relative overflow-hidden",
            paperTheme.colors.background.cardGradient,
            paperTheme.colors.borders.paper,
            paperTheme.effects.shadow.md,
          )}
        >
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-3 text-xs text-stone-500">
              <Legend color="#16a34a" label="Best" />
              <Legend color="#dc2626" label="Worst" />
              <Legend color="#6b7280" label="Expected" dashed />
              {linkedCount > 0 && (
                <span className="flex items-center gap-1 text-sky-600">
                  <Link2 className="w-3 h-3" />
                  Linked
                </span>
              )}
              {ruleRows.length > 0 && (
                <span className="flex items-center gap-1 text-teal-600">
                  <Sigma className="w-3 h-3" />
                  Rule totals
                </span>
              )}
            </div>
            <div className="flex items-center rounded-xl border-2 border-amber-200 bg-white p-0.5">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  onClick={() => setView(v.key)}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer",
                    view === v.key
                      ? "bg-amber-500 text-white"
                      : "text-stone-500 hover:bg-amber-50",
                  )}
                >
                  <v.icon className="w-3.5 h-3.5" />
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <RefreshCw className="w-7 h-7 text-amber-500 animate-spin" />
            </div>
          ) : view === "line" ? (
            <ForecastChart
              series={model.series}
              startBalance={model.start.best}
              todayIndex={todayIndex}
            />
          ) : view === "bars" ? (
            <ForecastBars buckets={model.buckets} />
          ) : view === "table" ? (
            <MonthlyPaymentsTable flows={yearFlows} />
          ) : view === "calendar" ? (
            <CalendarView model={model} />
          ) : (
            <MonthlyLedger flows={yearFlows} model={model} />
          )}
        </div>

        {/* Flows list */}
        <div
          className={cn(
            "rounded-2xl p-3 relative overflow-hidden",
            paperTheme.colors.background.cardGradient,
            paperTheme.colors.borders.paper,
            paperTheme.effects.shadow.md,
          )}
        >
          <div className="flex items-center justify-between px-1 py-1 mb-1 gap-2 flex-wrap">
            <h2 className={cn("text-lg font-bold text-stone-600", paperTheme.fonts.handwriting)}>
              Flows · {year}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-400">
                {yearFlows.length} flows
                {linkedCount > 0 && (
                  <span className="text-sky-600"> · {linkedCount} linked</span>
                )}
                {ruleRows.length > 0 && (
                  <span className="text-teal-600"> · {ruleRows.length} computed</span>
                )}
              </span>
              {(linkedCount > 0 || ruleRows.length > 0) && (
                <div className="flex items-center rounded-lg border-2 border-amber-200 bg-white p-0.5">
                  {(
                    [
                      ["all", "All"],
                      ["manual", "Manual"],
                      ...(linkedCount > 0
                        ? ([["linked", "Linked"]] as [SourceFilter, string][])
                        : []),
                      ...(ruleRows.length > 0
                        ? ([["rules", "Rules"]] as [SourceFilter, string][])
                        : []),
                    ] as [SourceFilter, string][]
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setSourceFilter(key)}
                      className={cn(
                        "px-2 py-0.5 rounded-md text-xs transition-colors cursor-pointer",
                        sourceFilter === key
                          ? key === "linked"
                            ? "bg-sky-500 text-white"
                            : key === "rules"
                              ? "bg-teal-500 text-white"
                              : "bg-amber-500 text-white"
                          : "text-stone-500 hover:bg-amber-50",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center rounded-lg border-2 border-amber-200 bg-white p-0.5">
                <button
                  onClick={() => setFlowsView("flow")}
                  className={cn(
                    "px-2 py-0.5 rounded-md text-xs transition-colors cursor-pointer",
                    flowsView === "flow" ? "bg-amber-500 text-white" : "text-stone-500 hover:bg-amber-50",
                  )}
                >
                  By flow
                </button>
                <button
                  onClick={() => setFlowsView("month")}
                  className={cn(
                    "px-2 py-0.5 rounded-md text-xs transition-colors cursor-pointer",
                    flowsView === "month" ? "bg-amber-500 text-white" : "text-stone-500 hover:bg-amber-50",
                  )}
                >
                  By month
                </button>
              </div>
            </div>
          </div>

          {byFlowList.length === 0 && listedFlows.length === 0 ? (
            <div className="text-center py-10 text-stone-400 text-sm">
              {yearFlows.length === 0
                ? `No flows for ${year}. Add one, import your data, mark an income or expense, or set up a rule.`
                : `No ${sourceFilter} flows for ${year}.`}
            </div>
          ) : flowsView === "flow" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3">
              {byFlowList.map((f) => (
                <FlowRow
                  key={f.id}
                  flow={f}
                  onToggle={() => toggleFlow(f)}
                  onEdit={() => editFlow(f)}
                  onDelete={() => deleteFlow(f)}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
              {flowsByMonth.map(({ month, entries }) => (
                <div
                  key={month}
                  className="rounded-xl border border-stone-200/70 bg-white/60 overflow-hidden"
                >
                  {/* Aggregates cover the entries actually listed, so they
                      track the Manual/Linked filter rather than the whole
                      month. No running balance here for the same reason. */}
                  <div className="flex items-center justify-between gap-3 px-3 py-1.5 bg-amber-50/60 border-b border-stone-100 flex-wrap">
                    <span className={cn("text-sm font-bold text-stone-700", paperTheme.fonts.handwriting)}>
                      {MONTHS_FULL[month - 1]}
                    </span>
                    <MonthStats
                      summary={summarize(entries)}
                      count={entries.length}
                    />
                  </div>
                  <div>
                    {entries.map((f) => (
                      <FlowRow
                        key={`${month}-${f.id}`}
                        flow={f}
                        hideMonths
                        onToggle={() => toggleFlow(f)}
                        onEdit={() => editFlow(f)}
                        onDelete={() => deleteFlow(f)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <ForecastFlowDialog
          open={showFlowDialog}
          onOpenChange={(o) => {
            setShowFlowDialog(o);
            if (!o) setEditingFlow(undefined);
          }}
          onSubmit={handleSubmitFlow}
          onSubmitSplit={handleSubmitFlowsSplit}
          editingFlow={editingFlow}
          defaultYear={year}
          accounts={accounts}
        />
        <ForecastImportDialog
          open={showImport}
          onOpenChange={setShowImport}
          onImport={handleImport}
        />
        <ForecastStartDialog
          open={showStartDialog}
          onOpenChange={setShowStartDialog}
          value={startBalance}
          baseYear={baseYear}
          onSave={saveStartBalance}
        />
      </div>
    </div>
  );
}

// ---- small presentational helpers ----

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1">
      <span
        className="inline-block w-4 h-0"
        style={{ borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}` }}
      />
      {label}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "best" | "worst" | "neutral";
  onClick?: () => void;
}) {
  const valueColor =
    tone === "best" ? "text-green-700" : tone === "worst" ? "text-red-600" : "text-stone-700";
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border border-stone-200/70 bg-white/70 p-3 relative",
        onClick && "cursor-pointer hover:border-amber-300 hover:bg-amber-50/40 transition-colors",
      )}
    >
      {onClick && (
        <Settings2 className="w-3.5 h-3.5 text-stone-300 absolute top-2.5 right-2.5" />
      )}
      <p className="text-xs text-stone-500">{label}</p>
      <p className={cn("text-xl font-bold tabular-nums", valueColor)}>{value}</p>
      <p className="text-[11px] text-stone-400">{hint}</p>
    </div>
  );
}

// Best and worst in one card. They're two readings of the same quantity, so
// sitting them side by side makes the spread legible at a glance — two separate
// cards invited reading them as unrelated numbers.
function RangeCard({
  label,
  best,
  worst,
  bestHint,
  worstHint,
  hint,
}: {
  label: string;
  best: number;
  worst: number;
  bestHint: string;
  worstHint: string;
  hint: string;
}) {
  return (
    <div className="col-span-2 rounded-xl border border-stone-200/70 bg-white/70 p-3">
      <p className="text-xs text-stone-500">{label}</p>
      <div className="flex items-baseline gap-3 flex-wrap mt-0.5">
        <span>
          <span className="text-[10px] uppercase tracking-wide text-stone-400 mr-1">
            best
          </span>
          <span className="text-xl font-bold tabular-nums text-green-700">
            {formatCurrency(best)}
          </span>
        </span>
        <span>
          <span className="text-[10px] uppercase tracking-wide text-stone-400 mr-1">
            worst
          </span>
          <span className="text-xl font-bold tabular-nums text-red-600">
            {formatCurrency(worst)}
          </span>
        </span>
      </div>
      <p className="text-[11px] text-stone-400">
        <span className="text-green-700">{bestHint}</span>
        {" · "}
        <span className="text-red-600">{worstHint}</span>
        {" · "}
        {hint}
      </p>
    </div>
  );
}

// iOS-style slider toggle (matches the original tool's on/off switch)
function ToggleSwitch({
  on,
  onChange,
  title,
}: {
  on: boolean;
  onChange: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      title={title}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer",
        on ? "bg-green-500" : "bg-stone-300",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
          on ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function FlowRow({
  flow,
  onToggle,
  onEdit,
  onDelete,
  hideMonths,
}: {
  flow: ForecastFlow;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  hideMonths?: boolean;
}) {
  const amount = flowDisplayAmount(flow);
  const amountLabel = flow.uncertain
    ? `${formatCurrency(flow.lowValue ?? 0)}–${formatCurrency(flow.highValue ?? 0)}`
    : formatCurrency(amount);
  const linked = flow.source;
  const isRule = linked?.kind === "rule";
  return (
    <div
      className={cn(
        "group/row flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors",
        isRule
          ? "bg-teal-50/70 border-l-[3px] border-teal-400 hover:bg-teal-50"
          : linked
            ? "bg-sky-50/70 border-l-[3px] border-sky-400 hover:bg-sky-50"
            : "hover:bg-white/70",
        !flow.enabled && "opacity-50",
      )}
    >
      <ToggleSwitch
        on={flow.enabled}
        onChange={onToggle}
        title={
          flow.enabled
            ? isRule
              ? "Counted every month — click to mute the whole rule"
              : linked
                ? "Counted in the forecast — click to mute"
                : "Enabled"
            : isRule
              ? "Muted — the rule still exists, it just isn't counted"
              : linked
                ? "Muted — still linked, not counted"
                : "Disabled"
        }
      />
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: flow.type === "in" ? "#22c55e" : "#ef4444" }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-stone-700 truncate">
            {flow.name || (flow.type === "in" ? "Inflow" : "Outflow")}
          </span>
          {linked && <SourceChip kind={linked.kind} />}
          {flow.isGhost && (
            <Ghost className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          )}
          {flow.uncertain && (
            <span className="text-[10px] text-amber-600 bg-amber-50 px-1 rounded shrink-0">
              ±
            </span>
          )}
        </div>
        {!hideMonths && (
          <span className="text-[11px] text-stone-400">{monthsLabel(flow.months)}</span>
        )}
      </div>
      <span
        className={cn(
          "text-sm font-bold tabular-nums shrink-0",
          flow.type === "in" ? "text-green-700" : "text-red-600",
        )}
      >
        {flow.type === "in" ? "+" : "−"}
        {amountLabel}
      </span>
      <div className="flex items-center gap-0.5 shrink-0 invisible group-hover/row:visible">
        {/* Records linked one-by-one have no editable fields here — everything
            about them lives on the record. A rule's definition is editable. */}
        {(!linked || isRule) && (
          <button
            onClick={onEdit}
            title={isRule ? "Edit rule" : "Edit"}
            className="w-6 h-6 rounded-md flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={onDelete}
          title={
            isRule
              ? "Delete rule (keeps every record it totals)"
              : linked
                ? "Remove from forecast (keeps the record)"
                : "Delete"
          }
          className={cn(
            "w-6 h-6 rounded-md flex items-center justify-center text-stone-400 cursor-pointer",
            isRule
              ? "hover:text-teal-700 hover:bg-teal-100"
              : linked
                ? "hover:text-sky-700 hover:bg-sky-100"
                : "hover:text-red-600 hover:bg-red-50",
          )}
        >
          {isRule ? (
            <Trash2 className="w-3.5 h-3.5" />
          ) : linked ? (
            <Link2Off className="w-3.5 h-3.5" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

// Marks a flow as coming from real data rather than being hand-written:
// sky for a single linked record, teal for a rule standing in for many.
function SourceChip({ kind }: { kind: ForecastSourceKind }) {
  const isRule = kind === "rule";
  const Icon = isRule ? Sigma : kind === "deposit" ? Wallet : Link2;
  return (
    <span
      title={
        isRule
          ? "Totalled by a rule"
          : `Linked from ${SOURCE_LABEL[kind].toLowerCase()}`
      }
      className={cn(
        "flex items-center gap-0.5 text-[10px] px-1 py-px rounded shrink-0",
        isRule ? "text-teal-700 bg-teal-100" : "text-sky-700 bg-sky-100",
      )}
    >
      <Icon className="w-2.5 h-2.5" />
      {SOURCE_LABEL[kind]}
    </span>
  );
}

// Monthly Payment Details — 12 month columns listing each named flow,
// color-coded inflow/outflow (dashed when uncertain). Ported from the
// original cash-flow tool's "Monthly Table" view.
function MonthlyPaymentsTable({ flows }: { flows: ForecastFlow[] }) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="grid grid-flow-col auto-cols-[minmax(116px,1fr)] gap-2 min-w-full">
        {MONTHS_FULL.map((label, i) => {
          const month = i + 1;
          const entries = flows.filter(
            (f) => f.enabled !== false && f.months.includes(month),
          );
          return (
            <div
              key={month}
              className="bg-white rounded-lg p-2 border border-stone-200/70"
            >
              <h4 className="text-xs font-bold text-stone-600 text-center pb-1.5 mb-2 border-b-2 border-stone-200">
                {label}
              </h4>
              {entries.length === 0 ? (
                <p className="text-[10px] text-stone-300 text-center py-2">
                  No payments
                </p>
              ) : (
                entries.map((f) => {
                  const amount = f.uncertain
                    ? `${formatCurrency(Math.min(f.lowValue ?? 0, f.highValue ?? 0))} – ${formatCurrency(Math.max(f.lowValue ?? 0, f.highValue ?? 0))}`
                    : formatCurrency(Math.abs(f.value ?? 0));
                  return (
                    <div
                      key={f.id}
                      className={cn(
                        "rounded-md px-2 py-1.5 mb-1.5 border-l-[3px]",
                        // Linked cards keep the green/red tint that encodes
                        // direction but take a sky border + ring so they read
                        // as "from my real data" at a glance.
                        f.type === "in"
                          ? "bg-green-50 border-green-500"
                          : "bg-red-50 border-red-500",
                        f.source &&
                          (f.source.kind === "rule"
                            ? "border-teal-400 ring-1 ring-inset ring-teal-200"
                            : "border-sky-400 ring-1 ring-inset ring-sky-200"),
                        f.uncertain && "border-dashed opacity-80",
                      )}
                    >
                      <div className="text-[11px] font-semibold text-stone-700 leading-tight break-words flex items-center gap-1">
                        {f.name || (f.type === "in" ? "Inflow" : "Outflow")}
                        {f.source?.kind === "rule" ? (
                          <Sigma className="w-3 h-3 text-teal-500 shrink-0" />
                        ) : f.source ? (
                          <Link2 className="w-3 h-3 text-sky-500 shrink-0" />
                        ) : null}
                        {f.isGhost && (
                          <Ghost className="w-3 h-3 text-violet-400 shrink-0" />
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-stone-500 mt-0.5">
                        {f.type === "in" ? "+" : "−"}
                        {amount}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// In / out / net for one month's flows, as best/worst bounds. Mirrors
// monthlyBuckets but over an arbitrary subset, so a filtered list summarises
// what it actually shows rather than what the whole month holds.
type MonthSummary = {
  inBest: number;
  inWorst: number;
  outBest: number; // negative
  outWorst: number; // negative
  netBest: number;
  netWorst: number;
};

function summarize(entries: ForecastFlow[]): MonthSummary {
  let inBest = 0, inWorst = 0, outBest = 0, outWorst = 0;
  for (const f of entries) {
    if (f.enabled === false) continue;
    const b = flowBounds(f);
    if (f.type === "in") {
      inBest += b.best;
      inWorst += b.worst;
    } else {
      outBest += b.best;
      outWorst += b.worst;
    }
  }
  return {
    inBest, inWorst, outBest, outWorst,
    netBest: inBest + outBest,
    netWorst: inWorst + outWorst,
  };
}

// One figure when the best/worst band has no width, a low–high range when it
// does. Always fed magnitudes; the caller owns the sign.
function band(a: number, b: number): string {
  if (Math.abs(a - b) < 0.005) return formatCurrency(Math.abs(a));
  const lo = Math.min(Math.abs(a), Math.abs(b));
  const hi = Math.max(Math.abs(a), Math.abs(b));
  return `${formatCurrency(lo)}–${formatCurrency(hi)}`;
}

function signedBand(worst: number, best: number): string {
  const flat = Math.abs(best - worst) < 0.005;
  if (flat) return `${best >= 0 ? "+" : "−"}${formatCurrency(Math.abs(best))}`;
  const s = (v: number) => `${v >= 0 ? "+" : "−"}${formatCurrency(Math.abs(v))}`;
  return `${s(worst)} → ${s(best)}`;
}

// Compact labelled figure for a month header.
function Stat({
  label,
  value,
  className,
  title,
}: {
  label: string;
  value: string;
  className?: string;
  title?: string;
}) {
  return (
    <span title={title} className="flex items-baseline gap-1 whitespace-nowrap">
      <span className="text-[10px] uppercase tracking-wide text-stone-400">
        {label}
      </span>
      <span className={cn("font-bold tabular-nums", className)}>{value}</span>
    </span>
  );
}

// The aggregate strip that sits on the same line as the month name.
// `balance` is the running end-of-month balance and is only meaningful for the
// full, unfiltered month — omitted where the list is a subset.
function MonthStats({
  summary,
  balance,
  count,
}: {
  summary: MonthSummary;
  balance?: { best: number; worst: number };
  count: number;
}) {
  const hasIn = summary.inBest !== 0 || summary.inWorst !== 0;
  const hasOut = summary.outBest !== 0 || summary.outWorst !== 0;
  return (
    <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap text-[11px] justify-end">
      <Stat
        label="items"
        value={String(count)}
        className="text-stone-500 font-medium"
      />
      {hasIn && (
        <Stat
          label="in"
          value={`+${band(summary.inWorst, summary.inBest)}`}
          className="text-green-700"
          title="Money coming in this month"
        />
      )}
      {hasOut && (
        <Stat
          label="out"
          value={`−${band(summary.outWorst, summary.outBest)}`}
          className="text-red-600"
          title="Money going out this month"
        />
      )}
      <Stat
        label="net"
        value={signedBand(summary.netWorst, summary.netBest)}
        className={summary.netBest >= 0 ? "text-green-700" : "text-red-600"}
        title="In minus out for this month"
      />
      {balance && (
        <Stat
          label="bal"
          value={band(balance.worst, balance.best)}
          className={balance.worst >= 0 ? "text-stone-700" : "text-red-600"}
          title="Running balance at the end of this month"
        />
      )}
    </div>
  );
}

// "By Month" — a vertical agenda: each month with flows, its individual
// payments listed beneath, and the month's aggregates in the header.
function MonthlyLedger({
  flows,
  model,
}: {
  flows: ForecastFlow[];
  model: ReturnType<typeof computeForecast>;
}) {
  const monthsWithFlows = Array.from({ length: 12 }, (_, i) => i + 1)
    .map((month) => ({
      month,
      entries: flows.filter(
        (f) => f.enabled !== false && f.months.includes(month),
      ),
    }))
    .filter((m) => m.entries.length > 0);

  if (monthsWithFlows.length === 0) {
    return (
      <div className="text-center py-10 text-stone-400 text-sm">
        No payments scheduled this year.
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
      {monthsWithFlows.map(({ month, entries }) => {
        const summary = summarize(entries);
        const point = model.series[month - 1];
        return (
          <div
            key={month}
            className="rounded-xl border border-stone-200/70 bg-white/70 overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 px-3 py-2 bg-amber-50/60 border-b border-stone-100 flex-wrap">
              <span className={cn("text-sm font-bold text-stone-700", "handwriting")}>
                {MONTHS_FULL[month - 1]}
              </span>
              <MonthStats
                summary={summary}
                balance={{ best: point.best, worst: point.worst }}
                count={entries.length}
              />
            </div>
            <div className="divide-y divide-stone-100">
              {entries.map((f) => {
                const amount = f.uncertain
                  ? `${formatCurrency(Math.min(f.lowValue ?? 0, f.highValue ?? 0))} – ${formatCurrency(Math.max(f.lowValue ?? 0, f.highValue ?? 0))}`
                  : formatCurrency(Math.abs(f.value ?? 0));
                return (
                  <div
                    key={f.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5",
                      f.source &&
                        (f.source.kind === "rule"
                          ? "bg-teal-50/70 border-l-[3px] border-teal-400"
                          : "bg-sky-50/70 border-l-[3px] border-sky-400"),
                    )}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: f.type === "in" ? "#22c55e" : "#ef4444" }}
                    />
                    <span className="flex-1 min-w-0 text-sm text-stone-700 truncate flex items-center gap-1">
                      {f.name || (f.type === "in" ? "Inflow" : "Outflow")}
                      {f.source && <SourceChip kind={f.source.kind} />}
                      {f.isGhost && <Ghost className="w-3.5 h-3.5 text-violet-400 shrink-0" />}
                      {f.uncertain && (
                        <span className="text-[10px] text-amber-600 bg-amber-50 px-1 rounded shrink-0">±</span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-bold tabular-nums shrink-0",
                        f.type === "in" ? "text-green-700" : "text-red-600",
                      )}
                    >
                      {f.type === "in" ? "+" : "−"}
                      {amount}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CalendarView({ model }: { model: ReturnType<typeof computeForecast> }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {model.buckets.map((b, i) => {
        const pt = model.series[i];
        const net = (b.netBest + b.netWorst) / 2;
        const has = b.inBest !== 0 || b.outBest !== 0 || b.inWorst !== 0 || b.outWorst !== 0;
        return (
          <div
            key={i}
            className={cn(
              "rounded-xl border p-2.5 bg-white/70",
              has ? "border-amber-200" : "border-stone-100",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-stone-600 handwriting">
                {MONTHS_SHORT[i]}
              </span>
              <span
                className={cn(
                  "text-xs font-bold tabular-nums",
                  net >= 0 ? "text-green-700" : "text-red-600",
                )}
              >
                {net >= 0 ? "+" : ""}
                {formatCurrency(net)}
              </span>
            </div>
            {b.inBest > 0 && (
              <div className="text-[11px] text-green-700 tabular-nums mt-1">
                in {formatCurrency((b.inBest + b.inWorst) / 2)}
              </div>
            )}
            {b.outBest < 0 && (
              <div className="text-[11px] text-red-600 tabular-nums">
                out {formatCurrency((b.outBest + b.outWorst) / 2)}
              </div>
            )}
            <div className="text-[11px] text-stone-400 mt-1 pt-1 border-t border-stone-100">
              bal {formatCurrency(pt.worst)}–{formatCurrency(pt.best)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
