import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ForecastFlow } from "@/lib/data-service";
import { cn } from "@/lib/utils";
import { paperTheme } from "@/styles";
import { parseOldToolData } from "@/utils/forecast";
import { useState } from "react";

interface ForecastImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (flows: Array<Omit<ForecastFlow, "id">>) => void;
}

export function ForecastImportDialog({
  open,
  onOpenChange,
  onImport,
}: ForecastImportDialogProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  let parsed: Array<Omit<ForecastFlow, "id">> = [];
  if (text.trim()) {
    try {
      parsed = parseOldToolData(text.trim());
    } catch {
      parsed = [];
    }
  }
  const years = [...new Set(parsed.map((f) => f.year))].sort();

  const handleImport = () => {
    if (parsed.length === 0) {
      setError("Couldn't find any flows in that text.");
      return;
    }
    onImport(parsed);
    setText("");
    setError(null);
    onOpenChange(false);
  };

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
            Import Forecast Data
          </DialogTitle>
          <DialogDescription className="text-sm text-stone-500">
            Paste the JSON exported from the old cash-flow tool. Amounts in “k”
            are converted to dollars, and identical monthly rows are merged.
          </DialogDescription>
        </DialogHeader>

        <div className="relative space-y-3 pt-1">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            placeholder='{"cashFlowData":"[...]","ghostFlowData":"[...]"}'
            rows={7}
            className="w-full px-3 py-2 rounded-xl border-2 border-amber-200 bg-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          />

          {text.trim() && (
            <div className="text-sm text-stone-600">
              {parsed.length > 0 ? (
                <span>
                  Found <b>{parsed.length}</b> flows
                  {years.length > 0 && <> across {years.join(", ")}</>}. They’ll
                  be added to your forecast.
                </span>
              ) : (
                <span className="text-red-600">No valid flows detected.</span>
              )}
            </div>
          )}
          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl border-2 border-amber-900/20 py-5"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={parsed.length === 0}
              onClick={handleImport}
              className="flex-1 rounded-xl py-5 bg-amber-500 hover:bg-amber-600 text-white"
            >
              Import {parsed.length > 0 ? `${parsed.length} flows` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ForecastImportDialog;
