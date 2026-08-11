import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn, currencySymbol } from "@/lib/utils";
import { paperTheme } from "@/styles";
import { useEffect, useState } from "react";

interface ForecastStartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: number;
  baseYear: number;
  onSave: (value: number) => void;
}

/**
 * Edit the opening balance the forecast builds from (independent of accounts).
 */
export function ForecastStartDialog({
  open,
  onOpenChange,
  value,
  baseYear,
  onSave,
}: ForecastStartDialogProps) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (open) setText(String(value ?? 0));
  }, [open, value]);

  const handleSave = () => {
    onSave(parseFloat(text) || 0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-sm",
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
            Opening balance
          </DialogTitle>
          <DialogDescription className="text-sm text-stone-500">
            The balance the forecast starts from in January {baseYear}. Your
            flows build on top of it; nothing else feeds the graph.
          </DialogDescription>
        </DialogHeader>

        <form
          className="relative space-y-3 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <div className="space-y-1.5">
            <Label className={cn("text-sm", paperTheme.fonts.handwriting)}>
              Starting amount ({currencySymbol()})
            </Label>
            <input
              type="number"
              step="0.01"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 rounded-xl border-2 border-amber-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            />
          </div>
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
              type="submit"
              className="flex-1 rounded-xl py-5 bg-amber-500 hover:bg-amber-600 text-white"
            >
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ForecastStartDialog;
