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
  ForecastProjection,
  ForecastRule,
  ForecastRuleSource,
} from "@/lib/data-service";
import { cn } from "@/lib/utils";
import { paperTheme } from "@/styles";
import { Sigma } from "lucide-react";
import { useEffect, useState } from "react";

interface ForecastRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (rule: Omit<ForecastRule, "id" | "sortOrder">) => void;
  editingRule?: ForecastRule;
  accounts: Account[];
}

const SOURCES: { key: ForecastRuleSource; label: string; hint: string }[] = [
  { key: "expenses", label: "Expenses", hint: "money out" },
  { key: "deposits", label: "Income", hint: "money in" },
  { key: "plans", label: "Plans", hint: "money out" },
];

const PROJECTIONS: { key: ForecastProjection; label: string; hint: string }[] = [
  { key: "none", label: "Nothing", hint: "Actuals only — a historical overlay" },
  { key: "median", label: "Median", hint: "Typical recent month, ignores spikes" },
  { key: "average", label: "Average", hint: "Mean of recent months" },
  { key: "last", label: "Last month", hint: "Repeat the most recent month" },
  { key: "fixed", label: "Fixed", hint: "A number you set" },
];

/**
 * Create or edit a forecast rule — a saved query that adds one aggregated line
 * per month to the forecast, and keeps itself current as new records land.
 */
export function ForecastRuleDialog({
  open,
  onOpenChange,
  onSubmit,
  editingRule,
  accounts,
}: ForecastRuleDialogProps) {
  const [name, setName] = useState("");
  const [source, setSource] = useState<ForecastRuleSource>("expenses");
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [excludeLinked, setExcludeLinked] = useState(true);
  const [projection, setProjection] = useState<ForecastProjection>("none");
  const [projectionWindow, setProjectionWindow] = useState("3");
  const [fixedValue, setFixedValue] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editingRule) {
      setName(editingRule.name);
      setSource(editingRule.source);
      setAccountIds(editingRule.accountIds);
      setExcludeLinked(editingRule.excludeLinked);
      setProjection(editingRule.projection);
      setProjectionWindow(String(editingRule.projectionWindow));
      setFixedValue(editingRule.fixedValue?.toString() ?? "");
    } else {
      // Defaults describe the common case: total up what you spend, month by
      // month, from whichever accounts you pick.
      setName("Monthly expenses");
      setSource("expenses");
      setAccountIds([]);
      setExcludeLinked(true);
      setProjection("none");
      setProjectionWindow("3");
      setFixedValue("");
    }
  }, [open, editingRule]);

  const toggleAccount = (id: string) =>
    setAccountIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const canSave = name.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onSubmit({
      name: name.trim(),
      source,
      accountIds,
      categoryIds: [],
      excludeLinked,
      projection,
      projectionWindow: Math.max(1, parseInt(projectionWindow, 10) || 3),
      fixedValue: projection === "fixed" ? parseFloat(fixedValue) || 0 : undefined,
      enabled: editingRule?.enabled ?? true,
    });
    onOpenChange(false);
  };

  const inputCls = cn(
    "w-full px-3 py-2 rounded-lg border text-sm",
    paperTheme.colors.borders.amber,
    paperTheme.colors.background.white,
    "focus:outline-none focus:ring-2 focus:ring-teal-400/50",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-lg max-h-[90vh] overflow-y-auto",
          paperTheme.colors.background.cardGradient,
          paperTheme.colors.borders.paper,
        )}
      >
        <DialogHeader className="relative">
          <DialogTitle
            className={cn(
              "text-xl flex items-center gap-2",
              paperTheme.colors.text.accent,
              paperTheme.fonts.handwriting,
            )}
          >
            <Sigma className="w-5 h-5 text-teal-600" />
            {editingRule ? "Edit rule" : "New rule"}
          </DialogTitle>
          <DialogDescription className="text-sm text-stone-500">
            A rule adds one line per month to the forecast, totalled from your
            real records — and keeps itself current as new ones land.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="relative space-y-4 pt-1">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className={paperTheme.fonts.handwriting}>Name</Label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Monthly expenses"
              autoFocus
              className={inputCls}
            />
          </div>

          {/* Source */}
          <div className="space-y-1.5">
            <Label className={paperTheme.fonts.handwriting}>Total up</Label>
            <div className="flex gap-1.5 flex-wrap">
              {SOURCES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSource(s.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer",
                    source === s.key
                      ? "bg-teal-500 border-teal-500 text-white"
                      : "border-stone-200 bg-white/60 text-stone-600 hover:border-teal-300",
                  )}
                >
                  {s.label}
                  <span
                    className={cn(
                      "ml-1",
                      source === s.key ? "text-teal-100" : "text-stone-400",
                    )}
                  >
                    {s.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Accounts */}
          <div className="space-y-1.5">
            <Label className={paperTheme.fonts.handwriting}>
              From accounts
              <span className="ml-1.5 text-xs font-normal text-stone-400">
                {accountIds.length === 0
                  ? "none picked — counts every account"
                  : `${accountIds.length} picked`}
              </span>
            </Label>
            <div className="flex gap-1.5 flex-wrap max-h-40 overflow-y-auto p-0.5">
              {accounts.map((a) => {
                const on = accountIds.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAccount(a.id)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg border text-xs transition-colors cursor-pointer",
                      on
                        ? "bg-teal-50 border-teal-400 text-teal-800"
                        : "border-stone-200 bg-white/60 text-stone-600 hover:border-teal-300",
                    )}
                  >
                    {a.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Exclude linked */}
          <label
            className={cn(
              "flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors",
              excludeLinked
                ? "border-teal-400 bg-teal-50/60"
                : "border-stone-200 bg-white/50 hover:border-teal-300",
            )}
          >
            <input
              type="checkbox"
              checked={excludeLinked}
              onChange={(e) => setExcludeLinked(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-teal-500 cursor-pointer"
            />
            <span className="flex-1">
              <span
                className={cn(
                  "text-sm font-medium",
                  excludeLinked ? "text-teal-800" : "text-stone-600",
                )}
              >
                Skip records already marked
              </span>
              <span className="block text-xs text-stone-500 mt-0.5">
                Leave this on unless you want an item to count both on its own
                and inside this total.
              </span>
            </span>
          </label>

          {/* Projection */}
          <div className="space-y-1.5">
            <Label className={paperTheme.fonts.handwriting}>
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
                      : "border-stone-200 bg-white/60 text-stone-600 hover:border-teal-300",
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
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-stone-500">Learn from the last</span>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={projectionWindow}
                  onChange={(e) => setProjectionWindow(e.target.value)}
                  className={cn(inputCls, "w-20 py-1")}
                />
                <span className="text-xs text-stone-500">closed months</span>
              </div>
            )}
            {projection === "fixed" && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-stone-500">Use</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={fixedValue}
                  onChange={(e) => setFixedValue(e.target.value)}
                  placeholder="0.00"
                  className={cn(inputCls, "w-32 py-1")}
                />
                <span className="text-xs text-stone-500">every month</span>
              </div>
            )}
          </div>

          <p className="text-xs text-stone-400 border-t border-stone-200/70 pt-3">
            Past and current months always use the real total, so this month
            shows what you have actually spent so far.
          </p>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSave}
              className="flex-1 bg-teal-500 hover:bg-teal-600 text-white"
            >
              {editingRule ? "Save rule" : "Create rule"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ForecastRuleDialog;
