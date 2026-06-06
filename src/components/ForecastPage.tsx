import { Button } from "@/components/ui/button";
import type { Account, ForecastFlow } from "@/lib/data-service";
import { dataService } from "@/lib/data-service";
import { cn, formatCurrency } from "@/lib/utils";
import { paperTheme } from "@/styles";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Ghost,
  LineChart as LineChartIcon,
  Pencil,
  Plus,
  RefreshCw,
  Table as TableIcon,
  Trash2,
  TrendingUp,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ForecastBars } from "./forecast/ForecastBars";
import { ForecastChart } from "./forecast/ForecastChart";
import { ForecastFlowDialog } from "./forecast/ForecastFlowDialog";
import { ForecastImportDialog } from "./forecast/ForecastImportDialog";
import {
  MONTHS_SHORT,
  computeForecast,
  flowDisplayAmount,
} from "@/utils/forecast";

type View = "line" | "bars" | "table" | "calendar";

const BASE_YEAR = new Date().getFullYear();

function monthsLabel(months: number[]): string {
  if (months.length === 12) return "All year";
  return months.map((m) => MONTHS_SHORT[m - 1]).join(" ");
}

export default function ForecastPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [flows, setFlows] = useState<ForecastFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(BASE_YEAR);
  const [view, setView] = useState<View>("line");

  const [showFlowDialog, setShowFlowDialog] = useState(false);
  const [editingFlow, setEditingFlow] = useState<ForecastFlow | undefined>();
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [accts, fl] = await Promise.all([
        dataService.getAccounts(),
        dataService.getForecastFlows(),
      ]);
      setAccounts(accts);
      setFlows(fl);
    } catch (e) {
      console.error("Failed to load forecast:", e);
    } finally {
      setLoading(false);
    }
  }

  // Anchor = current real accounts total (the "today" balance).
  const anchor = useMemo(
    () => accounts.reduce((s, a) => s + a.currentBalance, 0),
    [accounts],
  );

  const model = useMemo(
    () => computeForecast(flows, year, anchor, BASE_YEAR),
    [flows, year, anchor],
  );

  const yearFlows = useMemo(
    () =>
      flows
        .filter((f) => f.year === year)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [flows, year],
  );

  // ---- handlers ----
  const handleSubmitFlow = async (
    flow: Omit<ForecastFlow, "id" | "sortOrder">,
  ) => {
    try {
      if (editingFlow) {
        await dataService.updateForecastFlow(editingFlow.id, flow);
      } else {
        await dataService.addForecastFlow({ ...flow, sortOrder: flows.length });
      }
      setEditingFlow(undefined);
      await loadData();
    } catch (e) {
      console.error("Failed to save flow:", e);
    }
  };

  const handleImport = async (
    incoming: Array<Omit<ForecastFlow, "id">>,
  ) => {
    try {
      const base = flows.length;
      await dataService.addForecastFlows(
        incoming.map((f, i) => ({ ...f, sortOrder: base + i })),
      );
      await loadData();
    } catch (e) {
      console.error("Failed to import flows:", e);
    }
  };

  const toggleFlow = async (f: ForecastFlow) => {
    setFlows((prev) =>
      prev.map((x) => (x.id === f.id ? { ...x, enabled: !x.enabled } : x)),
    );
    try {
      await dataService.updateForecastFlow(f.id, { enabled: !f.enabled });
    } catch (e) {
      console.error(e);
      await loadData();
    }
  };

  const deleteFlow = async (f: ForecastFlow) => {
    if (!confirm(`Delete "${f.name || "flow"}"?`)) return;
    try {
      await dataService.removeForecastFlow(f.id);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const netBest = model.yearEnd.best - model.start.best;
  const netWorst = model.yearEnd.worst - model.start.worst;

  const VIEWS: { key: View; label: string; icon: typeof LineChartIcon }[] = [
    { key: "line", label: "Balance", icon: LineChartIcon },
    { key: "bars", label: "Monthly", icon: BarChart3 },
    { key: "table", label: "Table", icon: TableIcon },
    { key: "calendar", label: "Calendar", icon: CalendarDays },
  ];

  return (
    <div className="min-h-screen w-full p-4 md:p-8 bg-[repeating-linear-gradient(0deg,#fbf6e9,#fbf6e9_28px,#f2e8cf_28px,#f2e8cf_29px)]">
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <SummaryCard
            label={`Starting (${year})`}
            value={formatCurrency(model.start.best)}
            hint="from your accounts"
            tone="neutral"
          />
          <SummaryCard
            label={`Best case · end ${year}`}
            value={formatCurrency(model.yearEnd.best)}
            hint={`${netBest >= 0 ? "+" : ""}${formatCurrency(netBest)} net`}
            tone="best"
          />
          <SummaryCard
            label={`Worst case · end ${year}`}
            value={formatCurrency(model.yearEnd.worst)}
            hint={`${netWorst >= 0 ? "+" : ""}${formatCurrency(netWorst)} net`}
            tone="worst"
          />
          <SummaryCard
            label="Uncertainty spread"
            value={formatCurrency(model.yearEnd.best - model.yearEnd.worst)}
            hint="best − worst at year end"
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
            <ForecastChart series={model.series} startBalance={model.start.best} />
          ) : view === "bars" ? (
            <ForecastBars buckets={model.buckets} />
          ) : view === "table" ? (
            <MonthlyTable model={model} />
          ) : (
            <CalendarView model={model} />
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
          <div className="flex items-center justify-between px-1 py-1 mb-1">
            <h2 className={cn("text-lg font-bold text-stone-600", paperTheme.fonts.handwriting)}>
              Flows · {year}
            </h2>
            <span className="text-xs text-stone-400">{yearFlows.length} flows</span>
          </div>

          {yearFlows.length === 0 ? (
            <div className="text-center py-10 text-stone-400 text-sm">
              No flows for {year}. Add one or import your data.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3">
              {yearFlows.map((f) => (
                <FlowRow
                  key={f.id}
                  flow={f}
                  onToggle={() => toggleFlow(f)}
                  onEdit={() => {
                    setEditingFlow(f);
                    setShowFlowDialog(true);
                  }}
                  onDelete={() => deleteFlow(f)}
                />
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
          editingFlow={editingFlow}
          defaultYear={year}
        />
        <ForecastImportDialog
          open={showImport}
          onOpenChange={setShowImport}
          onImport={handleImport}
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
}: {
  label: string;
  value: string;
  hint: string;
  tone: "best" | "worst" | "neutral";
}) {
  const valueColor =
    tone === "best" ? "text-green-700" : tone === "worst" ? "text-red-600" : "text-stone-700";
  return (
    <div className="rounded-xl border border-stone-200/70 bg-white/70 p-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p className={cn("text-xl font-bold tabular-nums", valueColor)}>{value}</p>
      <p className="text-[11px] text-stone-400">{hint}</p>
    </div>
  );
}

function FlowRow({
  flow,
  onToggle,
  onEdit,
  onDelete,
}: {
  flow: ForecastFlow;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const amount = flowDisplayAmount(flow);
  const amountLabel = flow.uncertain
    ? `${formatCurrency(flow.lowValue ?? 0)}–${formatCurrency(flow.highValue ?? 0)}`
    : formatCurrency(amount);
  return (
    <div
      className={cn(
        "group/row flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/70 transition-colors",
        !flow.enabled && "opacity-50",
      )}
    >
      <input
        type="checkbox"
        checked={flow.enabled}
        onChange={onToggle}
        title={flow.enabled ? "Enabled" : "Disabled"}
        className="w-4 h-4 rounded border-2 border-amber-300 text-amber-500 cursor-pointer shrink-0"
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
          {flow.isGhost && (
            <Ghost className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          )}
          {flow.uncertain && (
            <span className="text-[10px] text-amber-600 bg-amber-50 px-1 rounded shrink-0">
              ±
            </span>
          )}
        </div>
        <span className="text-[11px] text-stone-400">{monthsLabel(flow.months)}</span>
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
        <button
          onClick={onEdit}
          title="Edit"
          className="w-6 h-6 rounded-md flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          title="Delete"
          className="w-6 h-6 rounded-md flex items-center justify-center text-stone-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function MonthlyTable({ model }: { model: ReturnType<typeof computeForecast> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-stone-400 text-xs border-b border-stone-200">
            <th className="text-left py-2 px-2 font-medium">Month</th>
            <th className="text-right py-2 px-2 font-medium">In</th>
            <th className="text-right py-2 px-2 font-medium">Out</th>
            <th className="text-right py-2 px-2 font-medium">Net (exp.)</th>
            <th className="text-right py-2 px-2 font-medium">Balance (worst→best)</th>
          </tr>
        </thead>
        <tbody>
          {model.buckets.map((b, i) => {
            const pt = model.series[i + 1];
            const net = (b.netBest + b.netWorst) / 2;
            return (
              <tr key={i} className="border-b border-stone-100 last:border-0">
                <td className="py-1.5 px-2 text-stone-600">{MONTHS_SHORT[i]}</td>
                <td className="py-1.5 px-2 text-right text-green-700 tabular-nums">
                  {b.inBest ? formatCurrency((b.inBest + b.inWorst) / 2) : "—"}
                </td>
                <td className="py-1.5 px-2 text-right text-red-600 tabular-nums">
                  {b.outBest ? formatCurrency((b.outBest + b.outWorst) / 2) : "—"}
                </td>
                <td
                  className={cn(
                    "py-1.5 px-2 text-right tabular-nums",
                    net >= 0 ? "text-green-700" : "text-red-600",
                  )}
                >
                  {net >= 0 ? "+" : ""}
                  {formatCurrency(net)}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums text-stone-600">
                  {formatCurrency(pt.worst)} → {formatCurrency(pt.best)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CalendarView({ model }: { model: ReturnType<typeof computeForecast> }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {model.buckets.map((b, i) => {
        const pt = model.series[i + 1];
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
