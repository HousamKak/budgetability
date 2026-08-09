import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type {
  Account,
  ForecastFlow,
  ForecastProjection,
  ForecastRuleSource,
} from "@/lib/data-service";
import { cn } from "@/lib/utils";
import { paperTheme } from "@/styles";
import { MONTHS_SHORT } from "@/utils/forecast";
import { Pencil, Sigma } from "lucide-react";
import { useEffect, useState } from "react";

interface ForecastFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (flow: Omit<ForecastFlow, "id" | "sortOrder">) => void;
  editingFlow?: ForecastFlow;
  defaultYear: number;
  accounts: Account[];
}

// Where a flow's amount comes from. Everything else about a flow — name, year,
// months, on/off — is identical either way, which is exactly why this is a mode
// on one dialog rather than a second kind of thing.
type AmountMode = "typed" | "computed";

const RULE_SOURCES: {
  key: ForecastRuleSource;
  label: string;
  type: "in" | "out";
}[] = [
  { key: "expenses", label: "Expenses", type: "out" },
  { key: "deposits", label: "Income", type: "in" },
  { key: "plans", label: "Plans", type: "out" },
];

const PROJECTIONS: { key: ForecastProjection; label: string; hint: string }[] = [
  { key: "none", label: "Nothing", hint: "Actuals only — a historical overlay" },
  { key: "median", label: "Median", hint: "Typical recent month, ignores spikes" },
  { key: "average", label: "Average", hint: "Mean of recent months" },
  { key: "last", label: "Last month", hint: "Repeat the most recent month" },
  { key: "fixed", label: "Fixed", hint: "A number you set" },
];

export function ForecastFlowDialog({
  open,
  onOpenChange,
  onSubmit,
  editingFlow,
  defaultYear,
  accounts,
}: ForecastFlowDialogProps) {
  const [name, setName] = useState("");
  const [year, setYear] = useState(defaultYear);
  const [type, setType] = useState<"in" | "out">("in");
  const [months, setMonths] = useState<number[]>([]);
  const [uncertain, setUncertain] = useState(false);
  const [isGhost, setIsGhost] = useState(false);
  const [amount, setAmount] = useState("");
  const [low, setLow] = useState("");
  const [high, setHigh] = useState("");

  const [mode, setMode] = useState<AmountMode>("typed");
  const [ruleSource, setRuleSource] = useState<ForecastRuleSource>("expenses");
  const [ruleAccounts, setRuleAccounts] = useState<string[]>([]);
  const [excludeLinked, setExcludeLinked] = useState(true);
  const [projection, setProjection] = useState<ForecastProjection>("none");
  const [projectionWindow, setProjectionWindow] = useState("3");
  const [fixedValue, setFixedValue] = useState("");

  const isEditing = !!editingFlow;

  useEffect(() => {
    if (!open) return;
    if (editingFlow) {
      setName(editingFlow.name ?? "");
      setYear(editingFlow.year);
      setType(editingFlow.type);
      setMonths([...editingFlow.months]);
      setUncertain(editingFlow.uncertain);
      setIsGhost(editingFlow.isGhost);
      setAmount(editingFlow.value != null ? String(editingFlow.value) : "");
      setLow(editingFlow.lowValue != null ? String(editingFlow.lowValue) : "");
      setHigh(editingFlow.highValue != null ? String(editingFlow.highValue) : "");

      const r = editingFlow.rule;
      setMode(r ? "computed" : "typed");
      setRuleSource(r?.source ?? "expenses");
      setRuleAccounts(r?.accountIds ?? []);
      setExcludeLinked(r?.excludeLinked ?? true);
      setProjection(r?.projection ?? "none");
      setProjectionWindow(String(r?.projectionWindow ?? 3));
      setFixedValue(r?.fixedValue?.toString() ?? "");
    } else {
      setName("");
      setYear(defaultYear);
      setType("in");
      setMonths([]);
      setUncertain(false);
      setIsGhost(false);
      setAmount("");
      setLow("");
      setHigh("");

      setMode("typed");
      setRuleSource("expenses");
      setRuleAccounts([]);
      setExcludeLinked(true);
      setProjection("none");
      setProjectionWindow("3");
      setFixedValue("");
    }
  }, [open, editingFlow, defaultYear]);

  // Direction follows the source for a computed flow: expenses and plans go
  // out, income comes in. Nothing to get wrong by hand.
  const pickSource = (key: ForecastRuleSource) => {
    setRuleSource(key);
    setType(RULE_SOURCES.find((s) => s.key === key)!.type);
  };
  const enterComputed = () => {
    setMode("computed");
    setUncertain(false);
    setType(RULE_SOURCES.find((s) => s.key === ruleSource)!.type);
    if (!name.trim()) setName("Monthly expenses");
  };
  const toggleRuleAccount = (id: string) =>
    setRuleAccounts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const toggleMonth = (m: number) =>
    setMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b),
    );
  const allOn = months.length === 12;
  const toggleAll = () => setMonths(allOn ? [] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

  const computed = mode === "computed";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (months.length === 0) return;
    const flow: Omit<ForecastFlow, "id" | "sortOrder"> = {
      year,
      months: [...months].sort((a, b) => a - b),
      type,
      name: name.trim() || undefined,
      // A computed flow carries no amount of its own — the months hold the
      // totals, filled in per month when the forecast is built.
      uncertain: computed ? false : uncertain,
      isGhost,
      enabled: editingFlow?.enabled ?? true,
      value: computed || uncertain ? undefined : Math.abs(parseFloat(amount) || 0),
      lowValue: !computed && uncertain ? Math.abs(parseFloat(low) || 0) : undefined,
      highValue: !computed && uncertain ? Math.abs(parseFloat(high) || 0) : undefined,
      rule: computed
        ? {
            source: ruleSource,
            accountIds: ruleAccounts,
            categoryIds: [],
            excludeLinked,
            projection,
            projectionWindow: Math.max(1, parseInt(projectionWindow, 10) || 3),
            fixedValue:
              projection === "fixed" ? parseFloat(fixedValue) || 0 : undefined,
          }
        : undefined,
    };
    onSubmit(flow);
    onOpenChange(false);
  };

  const valid =
    months.length > 0 &&
    (computed
      ? name.trim().length > 0
      : uncertain
        ? low !== "" && high !== ""
        : amount !== "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-lg max-h-[90vh] overflow-y-auto",
          paperTheme.colors.background.cardGradient,
          paperTheme.colors.borders.paper,
          paperTheme.effects.shadow,
        )}
      >
        <div
          className={cn(
            "absolute inset-0 opacity-15 pointer-events-none rounded-2xl",
            paperTheme.effects.paperTexture,
          )}
        />
        <DialogHeader className="relative pb-1">
          <DialogTitle
            className={cn("text-2xl", paperTheme.colors.text.accent, paperTheme.fonts.handwriting)}
          >
            {isEditing ? "Edit Flow" : "New Flow"}
          </DialogTitle>
          <DialogDescription className="text-sm text-stone-500">
            A projected inflow or outflow across one or more months.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="relative space-y-4 pt-1">
          {/* Where the amount comes from. Everything below is shared. */}
          <div className="flex rounded-xl border-2 border-amber-200 p-0.5 bg-white">
            <button
              type="button"
              onClick={() => setMode("typed")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                !computed
                  ? "bg-amber-500 text-white"
                  : "text-stone-500 hover:bg-stone-50",
              )}
            >
              <Pencil className="w-3.5 h-3.5" />
              Amount I type
            </button>
            <button
              type="button"
              onClick={enterComputed}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                computed
                  ? "bg-teal-500 text-white"
                  : "text-stone-500 hover:bg-stone-50",
              )}
            >
              <Sigma className="w-3.5 h-3.5" />
              Total from my data
            </button>
          </div>

          {/* Type + Year */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label className={cn("text-sm", paperTheme.fonts.handwriting)}>Type</Label>
              <div
                className={cn(
                  "flex rounded-xl border-2 border-amber-200 p-0.5 bg-white",
                  computed && "opacity-60 pointer-events-none",
                )}
                title={
                  computed ? "Direction follows what you're totalling" : undefined
                }
              >
                {(["in", "out"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                      type === t
                        ? t === "in"
                          ? "bg-green-500 text-white"
                          : "bg-red-500 text-white"
                        : "text-stone-500 hover:bg-stone-50",
                    )}
                  >
                    {t === "in" ? "Inflow" : "Outflow"}
                  </button>
                ))}
              </div>
            </div>
            <div className="w-28 space-y-1.5">
              <Label className={cn("text-sm", paperTheme.fonts.handwriting)}>Year</Label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value) || defaultYear)}
                className="w-full px-3 py-2 rounded-xl border-2 border-amber-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label className={cn("text-sm", paperTheme.fonts.handwriting)}>
              Name {computed ? "" : "(optional)"}
            </Label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                computed
                  ? "e.g., Monthly expenses"
                  : "e.g., Salary, Rent, Project payment"
              }
              className="w-full px-3 py-2 rounded-xl border-2 border-amber-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            />
          </div>

          {/* Months */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className={cn("text-sm", paperTheme.fonts.handwriting)}>Months</Label>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-amber-600 hover:underline cursor-pointer"
              >
                {allOn ? "Clear" : "All year"}
              </button>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {MONTHS_SHORT.map((m, i) => {
                const mn = i + 1;
                const on = months.includes(mn);
                return (
                  <button
                    key={mn}
                    type="button"
                    onClick={() => toggleMonth(mn)}
                    className={cn(
                      "py-1.5 rounded-lg text-xs font-medium border-2 transition-colors cursor-pointer",
                      on
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-white text-stone-500 border-amber-100 hover:border-amber-300",
                    )}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Computed: what to total, and from where */}
          {computed && (
            <div className="space-y-3 rounded-xl border-2 border-teal-200 bg-teal-50/40 p-3">
              <div className="space-y-1.5">
                <Label className={cn("text-sm", paperTheme.fonts.handwriting)}>
                  Total up
                </Label>
                <div className="flex gap-1.5 flex-wrap">
                  {RULE_SOURCES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => pickSource(s.key)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer",
                        ruleSource === s.key
                          ? "bg-teal-500 border-teal-500 text-white"
                          : "border-stone-200 bg-white text-stone-600 hover:border-teal-300",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className={cn("text-sm", paperTheme.fonts.handwriting)}>
                  From accounts
                  <span className="ml-1.5 text-xs font-normal text-stone-400">
                    {ruleAccounts.length === 0
                      ? "none picked — every account"
                      : `${ruleAccounts.length} picked`}
                  </span>
                </Label>
                <div className="flex gap-1.5 flex-wrap max-h-32 overflow-y-auto p-0.5">
                  {accounts.map((a) => {
                    const on = ruleAccounts.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleRuleAccount(a.id)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg border text-xs transition-colors cursor-pointer",
                          on
                            ? "bg-teal-100 border-teal-400 text-teal-800"
                            : "border-stone-200 bg-white text-stone-600 hover:border-teal-300",
                        )}
                      >
                        {a.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={excludeLinked}
                  onChange={(e) => setExcludeLinked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-teal-500 cursor-pointer"
                />
                <span className="flex-1">
                  <span className="text-sm text-stone-700">
                    Skip records already marked
                  </span>
                  <span className="block text-xs text-stone-500">
                    Otherwise an item you marked counts twice — alone and in
                    this total.
                  </span>
                </span>
              </label>

              <div className="space-y-1.5">
                <Label className={cn("text-sm", paperTheme.fonts.handwriting)}>
                  Months with no data yet show
                </Label>
                <div className="flex gap-1.5 flex-wrap">
                  {PROJECTIONS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      title={p.hint}
                      onClick={() => setProjection(p.key)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg border text-xs transition-colors cursor-pointer",
                        projection === p.key
                          ? "bg-teal-500 border-teal-500 text-white"
                          : "border-stone-200 bg-white text-stone-600 hover:border-teal-300",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-stone-500">
                  {PROJECTIONS.find((p) => p.key === projection)?.hint}
                </p>
                {(projection === "median" ||
                  projection === "average" ||
                  projection === "last") && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-500">
                      Learn from the last
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={projectionWindow}
                      onChange={(e) => setProjectionWindow(e.target.value)}
                      className="w-20 px-2 py-1 rounded-lg border-2 border-teal-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                    />
                    <span className="text-xs text-stone-500">closed months</span>
                  </div>
                )}
                {projection === "fixed" && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-500">Use</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={fixedValue}
                      onChange={(e) => setFixedValue(e.target.value)}
                      placeholder="0.00"
                      className="w-32 px-2 py-1 rounded-lg border-2 border-teal-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                    />
                    <span className="text-xs text-stone-500">every month</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-stone-500 border-t border-teal-200/70 pt-2">
                Past and current months always use the real total, so this month
                shows what you have actually spent so far. Only the months
                selected above are affected.
              </p>
            </div>
          )}

          {/* Amount / uncertainty */}
          {!computed && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={uncertain}
                onChange={(e) => setUncertain(e.target.checked)}
                className="w-4 h-4 rounded border-2 border-amber-300 text-amber-500"
              />
              <span className={cn("text-sm", paperTheme.fonts.handwriting)}>
                Uncertain amount (low / high range)
              </span>
            </label>

            {uncertain ? (
              <div className="flex gap-3">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-stone-500">Low ($)</Label>
                  <input
                    type="number"
                    step="0.01"
                    value={low}
                    onChange={(e) => setLow(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-xl border-2 border-amber-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-stone-500">High ($)</Label>
                  <input
                    type="number"
                    step="0.01"
                    value={high}
                    onChange={(e) => setHigh(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-xl border-2 border-amber-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs text-stone-500">Amount ($)</Label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-xl border-2 border-amber-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                />
              </div>
            )}
          </div>
          )}

          {/* Ghost */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isGhost}
              onChange={(e) => setIsGhost(e.target.checked)}
              className="w-4 h-4 rounded border-2 border-amber-300 text-amber-500"
            />
            <span className={cn("text-sm", paperTheme.fonts.handwriting)}>
              Ghost flow (hypothetical what-if)
            </span>
          </label>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl border-2 border-amber-900/20 py-5"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!valid}
              className={cn(
                "flex-1 rounded-xl py-5 text-white",
                computed
                  ? "bg-teal-500 hover:bg-teal-600"
                  : "bg-amber-500 hover:bg-amber-600",
              )}
            >
              {isEditing ? "Save" : "Add Flow"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ForecastFlowDialog;
