import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { ForecastFlow } from "@/lib/data-service";
import { cn } from "@/lib/utils";
import { paperTheme } from "@/styles";
import { MONTHS_SHORT } from "@/utils/forecast";
import { useEffect, useState } from "react";

interface ForecastFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (flow: Omit<ForecastFlow, "id" | "sortOrder">) => void;
  editingFlow?: ForecastFlow;
  defaultYear: number;
}

export function ForecastFlowDialog({
  open,
  onOpenChange,
  onSubmit,
  editingFlow,
  defaultYear,
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
    }
  }, [open, editingFlow, defaultYear]);

  const toggleMonth = (m: number) =>
    setMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b),
    );
  const allOn = months.length === 12;
  const toggleAll = () => setMonths(allOn ? [] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (months.length === 0) return;
    const flow: Omit<ForecastFlow, "id" | "sortOrder"> = {
      year,
      months: [...months].sort((a, b) => a - b),
      type,
      name: name.trim() || undefined,
      uncertain,
      isGhost,
      enabled: editingFlow?.enabled ?? true,
      value: uncertain ? undefined : Math.abs(parseFloat(amount) || 0),
      lowValue: uncertain ? Math.abs(parseFloat(low) || 0) : undefined,
      highValue: uncertain ? Math.abs(parseFloat(high) || 0) : undefined,
    };
    onSubmit(flow);
    onOpenChange(false);
  };

  const valid =
    months.length > 0 && (uncertain ? low !== "" && high !== "" : amount !== "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-lg",
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
          {/* Type + Year */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label className={cn("text-sm", paperTheme.fonts.handwriting)}>Type</Label>
              <div className="flex rounded-xl border-2 border-amber-200 p-0.5 bg-white">
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
            <Label className={cn("text-sm", paperTheme.fonts.handwriting)}>Name (optional)</Label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Salary, Rent, Project payment"
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

          {/* Amount / uncertainty */}
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
              className="flex-1 rounded-xl py-5 bg-amber-500 hover:bg-amber-600 text-white"
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
