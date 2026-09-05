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
  PickableExpense,
} from "@/lib/data-service";
import { dataService } from "@/lib/data-service";
import { cn, currencySymbol, formatCurrency } from "@/lib/utils";
import { paperTheme } from "@/styles";
import { MONTHS_FULL, MONTHS_SHORT } from "@/utils/forecast";
import { Lock, Pencil, RefreshCw, Search, Sigma, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface ForecastFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    flow: Omit<ForecastFlow, "id" | "sortOrder">,
    memberIds?: string[],
  ) => void;
  /**
   * Used instead of onSubmit when "separate flow per month" is checked:
   * one independent flow per selected month, editable and deletable alone.
   */
  onSubmitSplit?: (
    flows: Array<Omit<ForecastFlow, "id" | "sortOrder">>,
  ) => void;
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
  { key: "picked", label: "Picked records", type: "out" },
];

const PROJECTIONS: { key: ForecastProjection; label: string; hint: string }[] = [
  { key: "none", label: "Nothing", hint: "Actuals only, a historical overlay" },
  { key: "median", label: "Median", hint: "Typical recent month, ignores spikes" },
  { key: "average", label: "Average", hint: "Mean of recent months" },
  { key: "last", label: "Last month", hint: "Repeat the most recent month" },
  { key: "fixed", label: "Fixed", hint: "A number you set" },
];

export function ForecastFlowDialog({
  open,
  onOpenChange,
  onSubmit,
  onSubmitSplit,
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
  const [targetValue, setTargetValue] = useState("");

  // Member picking
  const [pickable, setPickable] = useState<PickableExpense[]>([]);
  const [pickLoading, setPickLoading] = useState(false);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filterMonth, setFilterMonth] = useState(0); // 0 = every month
  const [filterAccount, setFilterAccount] = useState(""); // "" = every account
  const [filterCategory, setFilterCategory] = useState(""); // "" = every category
  const [pickedOnly, setPickedOnly] = useState(false);

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
      setTargetValue(r?.targetValue?.toString() ?? "");
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
      setTargetValue("");
    }
    setPickable([]);
    setMemberIds([]);
    setQuery("");
    setFilterMonth(0);
    setFilterAccount("");
    setFilterCategory("");
    setPickedOnly(false);
    setSplitPerMonth(false);
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
  const toggleMember = (id: string) =>
    setMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const isPicked = ruleSource === "picked";

  // Load the year's expenses only when the picker is actually on screen.
  useEffect(() => {
    if (!open || mode !== "computed" || !isPicked) return;
    let cancelled = false;
    setPickLoading(true);
    dataService
      .getPickableExpenses(`${year}-01`, `${year}-12`)
      .then((rows) => {
        if (cancelled) return;
        setPickable(rows);
        // Whatever already belongs to this flow starts ticked.
        if (editingFlow) {
          setMemberIds(
            rows.filter((r) => r.forecastFlowId === editingFlow.id).map((r) => r.id),
          );
        }
      })
      .catch((e) => console.error("Failed to load expenses:", e))
      .finally(() => !cancelled && setPickLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, mode, isPicked, year, editingFlow]);

  const picked = useMemo(
    () => pickable.filter((p) => memberIds.includes(p.id)),
    [pickable, memberIds],
  );
  const pickedTotal = picked.reduce((s, p) => s + p.amount, 0);

  // Filter options come from the records actually loaded, not from every
  // account or category that exists — offering a filter that matches nothing
  // is just noise.
  const monthOptions = useMemo(
    () =>
      [...new Set(pickable.map((p) => Number(p.date.slice(5, 7))))].sort(
        (a, b) => a - b,
      ),
    [pickable],
  );
  const accountOptions = useMemo(() => {
    const ids = [...new Set(pickable.map((p) => p.accountId).filter(Boolean))];
    return ids
      .map((id) => ({
        id: id as string,
        name: accounts.find((a) => a.id === id)?.name ?? "Unknown account",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [pickable, accounts]);
  // Categories are legacy free text, so "Groceries" and "groceries" are the
  // same thing — fold on case and show the first spelling seen.
  const categoryOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of pickable) {
      const c = p.category?.trim();
      if (!c) continue;
      const key = c.toLowerCase();
      if (!seen.has(key)) seen.set(key, c);
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [pickable]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pickable.filter((p) => {
      if (pickedOnly && !memberIds.includes(p.id)) return false;
      if (filterMonth && Number(p.date.slice(5, 7)) !== filterMonth) return false;
      if (filterAccount && p.accountId !== filterAccount) return false;
      if (
        filterCategory &&
        (p.category ?? "").trim().toLowerCase() !== filterCategory
      )
        return false;
      if (!q) return true;
      // Date is searchable too, so "08-02" finds a particular day.
      return (
        (p.note ?? "").toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q) ||
        p.date.includes(q) ||
        String(p.amount).includes(q)
      );
    });
  }, [
    pickable,
    query,
    filterMonth,
    filterAccount,
    filterCategory,
    pickedOnly,
    memberIds,
  ]);

  // Already claimed by a different grouped line, so unavailable here.
  const takenElsewhere = (p: PickableExpense) =>
    !!p.forecastFlowId && p.forecastFlowId !== editingFlow?.id;

  const selectableShown = useMemo(
    () => filtered.filter((p) => !takenElsewhere(p)).map((p) => p.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, editingFlow?.id],
  );
  const allShownPicked =
    selectableShown.length > 0 &&
    selectableShown.every((id) => memberIds.includes(id));

  const toggleAllShown = () =>
    setMemberIds((prev) =>
      allShownPicked
        ? prev.filter((id) => !selectableShown.includes(id))
        : [...new Set([...prev, ...selectableShown])],
    );

  const filtersActive =
    !!query.trim() ||
    filterMonth !== 0 ||
    !!filterAccount ||
    !!filterCategory ||
    pickedOnly;
  const clearFilters = () => {
    setQuery("");
    setFilterMonth(0);
    setFilterAccount("");
    setFilterCategory("");
    setPickedOnly(false);
  };

  // Grouped by month, so a group spanning months is obvious while picking.
  const pickableByMonth = useMemo(() => {
    const map = new Map<number, PickableExpense[]>();
    for (const p of filtered) {
      const m = Number(p.date.slice(5, 7));
      if (!map.has(m)) map.set(m, []);
      map.get(m)!.push(p);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  // One record spanning the chosen months (default), or one independent flow
  // per month so each can be edited or deleted on its own.
  const [splitPerMonth, setSplitPerMonth] = useState(false);

  const toggleMonth = (m: number) =>
    setMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b),
    );
  const allOn = months.length === 12;
  const toggleAll = () => setMonths(allOn ? [] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

  const computed = mode === "computed";

  const pickedMode = computed && isPicked;

  // A picked group lives wherever its members fall — their dates decide, not
  // the month grid. Stored anyway so the row still knows where it belongs even
  // if every member is later deleted.
  const memberMonths = useMemo(
    () =>
      [...new Set(picked.map((p) => Number(p.date.slice(5, 7))))].sort(
        (a, b) => a - b,
      ),
    [picked],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveMonths = pickedMode ? memberMonths : months;
    if (effectiveMonths.length === 0) return;
    const flow: Omit<ForecastFlow, "id" | "sortOrder"> = {
      year,
      months: [...effectiveMonths].sort((a, b) => a - b),
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
            targetValue:
              !pickedMode && targetValue.trim() !== ""
                ? Math.abs(parseFloat(targetValue) || 0)
                : undefined,
          }
        : undefined,
    };
    if (
      !isEditing &&
      !pickedMode &&
      splitPerMonth &&
      effectiveMonths.length > 1 &&
      onSubmitSplit
    ) {
      onSubmitSplit(effectiveMonths.map((m) => ({ ...flow, months: [m] })));
    } else {
      onSubmit(flow, pickedMode ? memberIds : undefined);
    }
    onOpenChange(false);
  };

  const valid = computed
    ? name.trim().length > 0 &&
      (pickedMode ? memberIds.length > 0 : months.length > 0)
    : months.length > 0 && (uncertain ? low !== "" && high !== "" : amount !== "");

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

          {/* Months — a picked group takes its months from its members */}
          {pickedMode ? (
            <div className="space-y-1.5">
              <Label className={cn("text-sm", paperTheme.fonts.handwriting)}>
                Months
              </Label>
              <p className="flex items-center gap-1.5 text-xs text-stone-500 px-3 py-2 rounded-xl border-2 border-dashed border-teal-200 bg-white/60">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                {memberMonths.length === 0
                  ? "Taken from whichever records you pick below."
                  : `From the records picked: ${memberMonths
                      .map((m) => MONTHS_SHORT[m - 1])
                      .join(", ")}`}
              </p>
            </div>
          ) : (
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
            {!isEditing && months.length > 1 && (
              <label className="flex items-start gap-2 pt-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={splitPerMonth}
                  onChange={(e) => setSplitPerMonth(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-amber-500 cursor-pointer"
                />
                <span className="text-xs text-stone-600">
                  <span className="font-medium">Separate flow per month</span>
                  <span className="block text-stone-400">
                    Creates {months.length} individual flows, one per selected
                    month, so each can be edited or deleted on its own.
                  </span>
                </span>
              </label>
            )}
          </div>
          )}

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

              {/* Picked: choose the individual records that make up the line */}
              {isPicked ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className={cn("text-sm", paperTheme.fonts.handwriting)}>
                      Records in {year}
                    </Label>
                    <span className="text-xs font-bold tabular-nums text-teal-700">
                      {memberIds.length} picked · {formatCurrency(pickedTotal)}
                    </span>
                  </div>

                  {/* Search + filters. A year is hundreds of expenses, so
                      finding the handful that belong together needs more than
                      scrolling. */}
                  {!pickLoading && pickable.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search note, category, date or amount…"
                          className="w-full pl-7 pr-7 py-1.5 rounded-lg border border-stone-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                        />
                        {query && (
                          <button
                            type="button"
                            onClick={() => setQuery("")}
                            title="Clear search"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-stone-400 hover:text-stone-700 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex gap-1.5 flex-wrap items-center">
                        <select
                          value={filterMonth}
                          onChange={(e) => setFilterMonth(Number(e.target.value))}
                          className="px-1.5 py-1 rounded-lg border border-stone-200 bg-white text-xs text-stone-600 focus:outline-none focus:ring-2 focus:ring-teal-400/50 cursor-pointer"
                        >
                          <option value={0}>Any month</option>
                          {monthOptions.map((m) => (
                            <option key={m} value={m}>
                              {MONTHS_FULL[m - 1]}
                            </option>
                          ))}
                        </select>

                        {accountOptions.length > 1 && (
                          <select
                            value={filterAccount}
                            onChange={(e) => setFilterAccount(e.target.value)}
                            className="px-1.5 py-1 rounded-lg border border-stone-200 bg-white text-xs text-stone-600 max-w-[9rem] focus:outline-none focus:ring-2 focus:ring-teal-400/50 cursor-pointer"
                          >
                            <option value="">Any account</option>
                            {accountOptions.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                        )}

                        {categoryOptions.length > 1 && (
                          <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="px-1.5 py-1 rounded-lg border border-stone-200 bg-white text-xs text-stone-600 max-w-[9rem] focus:outline-none focus:ring-2 focus:ring-teal-400/50 cursor-pointer"
                          >
                            <option value="">Any category</option>
                            {categoryOptions.map(([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ))}
                          </select>
                        )}

                        <button
                          type="button"
                          onClick={() => setPickedOnly((v) => !v)}
                          className={cn(
                            "px-2 py-1 rounded-lg border text-xs transition-colors cursor-pointer",
                            pickedOnly
                              ? "bg-teal-500 border-teal-500 text-white"
                              : "border-stone-200 bg-white text-stone-600 hover:border-teal-300",
                          )}
                        >
                          Picked only
                        </button>

                        {filtersActive && (
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="text-xs text-stone-400 hover:text-stone-700 underline cursor-pointer"
                          >
                            Reset
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 text-[11px] text-stone-400">
                        <span>
                          Showing {filtered.length} of {pickable.length}
                        </span>
                        {selectableShown.length > 0 && (
                          <button
                            type="button"
                            onClick={toggleAllShown}
                            className="text-teal-600 hover:underline cursor-pointer"
                          >
                            {allShownPicked
                              ? `Unpick these ${selectableShown.length}`
                              : `Pick all ${selectableShown.length} shown`}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {pickLoading ? (
                    <div className="flex justify-center py-6">
                      <RefreshCw className="w-5 h-5 text-teal-500 animate-spin" />
                    </div>
                  ) : pickable.length === 0 ? (
                    <p className="text-xs text-stone-400 py-4 text-center">
                      No expenses recorded in {year}.
                    </p>
                  ) : pickableByMonth.length === 0 ? (
                    <p className="text-xs text-stone-400 py-4 text-center">
                      Nothing matches. <button
                        type="button"
                        onClick={clearFilters}
                        className="text-teal-600 hover:underline cursor-pointer"
                      >
                        Reset filters
                      </button>
                    </p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-stone-200 bg-white divide-y divide-stone-100">
                      {pickableByMonth.map(([month, rows]) => (
                        <div key={month}>
                          <div className="sticky top-0 px-2 py-1 bg-stone-50 border-b border-stone-100 text-[11px] font-bold text-stone-500">
                            {MONTHS_FULL[month - 1]}
                          </div>
                          {rows.map((p) => {
                            const on = memberIds.includes(p.id);
                            const taken = takenElsewhere(p);
                            return (
                              <label
                                key={p.id}
                                title={
                                  taken
                                    ? "Already part of another grouped forecast line"
                                    : p.inForecast
                                      ? "Marked on its own. Picking it here moves it into this group"
                                      : undefined
                                }
                                className={cn(
                                  "flex items-center gap-2 px-2 py-1 text-xs",
                                  taken
                                    ? "opacity-40 cursor-not-allowed"
                                    : "cursor-pointer hover:bg-teal-50/60",
                                  on && "bg-teal-50",
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={on}
                                  disabled={taken}
                                  onChange={() => toggleMember(p.id)}
                                  className="w-3.5 h-3.5 accent-teal-500 shrink-0"
                                />
                                <span className="w-10 shrink-0 text-stone-400 tabular-nums">
                                  {p.date.slice(8, 10)}/{p.date.slice(5, 7)}
                                </span>
                                <span className="flex-1 min-w-0 truncate text-stone-700">
                                  {p.note || p.category || "Expense"}
                                </span>
                                {p.inForecast && !on && (
                                  <span className="text-[9px] text-sky-700 bg-sky-100 px-1 rounded shrink-0">
                                    marked
                                  </span>
                                )}
                                <span className="shrink-0 tabular-nums font-medium text-stone-600">
                                  {formatCurrency(p.amount)}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-stone-500">
                    These add up to one line. Edit or delete any of them and the
                    total follows; nothing here is copied.
                  </p>
                </div>
              ) : (
              <>
              <div className="space-y-1.5">
                <Label className={cn("text-sm", paperTheme.fonts.handwriting)}>
                  From accounts
                  <span className="ml-1.5 text-xs font-normal text-stone-400">
                    {ruleAccounts.length === 0
                      ? "none picked, every account"
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
                    Otherwise an item you marked counts twice: alone and in
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

              <div className="space-y-1.5 border-t border-teal-200/70 pt-2">
                <Label className={cn("text-sm", paperTheme.fonts.handwriting)}>
                  Monthly target (optional)
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500">I plan for</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder="e.g. 1235"
                    className="w-32 px-2 py-1 rounded-lg border-2 border-teal-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                  />
                  <span className="text-xs text-stone-500">every month</span>
                </div>
                <p className="text-xs text-stone-500">
                  When set, the graph and forecast use this number from the
                  current month on, and the real total shows beside it. Closed
                  months keep what actually happened. Leave empty to forecast
                  from the totals alone.
                </p>
              </div>
              </>
              )}

              <p className="text-xs text-stone-500 border-t border-teal-200/70 pt-2">
                {isPicked
                  ? "Picking a record moves it here from wherever else it sat on the forecast, so nothing is counted twice."
                  : "Past and current months always use the real total, so this month shows what you have actually spent so far. Only the months selected above are affected."}
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
                  <Label className="text-xs text-stone-500">Low ({currencySymbol()})</Label>
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
                  <Label className="text-xs text-stone-500">High ({currencySymbol()})</Label>
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
                <Label className="text-xs text-stone-500">Amount ({currencySymbol()})</Label>
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
