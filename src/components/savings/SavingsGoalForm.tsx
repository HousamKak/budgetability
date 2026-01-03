import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { SavingsGoal } from "@/lib/data-service";
import { cn } from "@/lib/utils";
import { paperTheme } from "@/styles";
import { Target } from "lucide-react";
import { useEffect, useState } from "react";
import { ImageUploader } from "./ImageUploader";

// Color options for goals
const COLOR_OPTIONS = [
  { value: "#f59e0b", label: "Amber" },
  { value: "#22c55e", label: "Green" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#06b6d4", label: "Cyan" },
];

interface SavingsGoalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    goal: Omit<
      SavingsGoal,
      "id" | "currentAmount" | "isCompleted" | "completedAt"
    >
  ) => void;
  editingGoal?: SavingsGoal;
}

/**
 * Dialog for creating or editing a savings goal
 */
export function SavingsGoalForm({
  open,
  onOpenChange,
  onSubmit,
  editingGoal,
}: SavingsGoalFormProps) {
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [deadline, setDeadline] = useState("");
  const [color, setColor] = useState("#f59e0b");

  const isEditing = !!editingGoal;

  useEffect(() => {
    if (open) {
      if (editingGoal) {
        setName(editingGoal.name);
        setTargetAmount(editingGoal.targetAmount.toString());
        setImageUrl(editingGoal.imageUrl);
        setDeadline(editingGoal.deadline || "");
        setColor(editingGoal.color || "#f59e0b");
      } else {
        setName("");
        setTargetAmount("");
        setImageUrl(undefined);
        setDeadline("");
        setColor("#f59e0b");
      }
    }
  }, [open, editingGoal]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(targetAmount) || 0;
    if (amount <= 0) return;

    onSubmit({
      name: name.trim(),
      targetAmount: amount,
      imageUrl,
      deadline: deadline || undefined,
      color,
    });

    onOpenChange(false);
  };

  // Get minimum date (today)
  const today = new Date().toISOString().split("T")[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-md max-h-[90vh] overflow-y-auto",
          paperTheme.colors.background.cardGradient,
          paperTheme.colors.borders.paper
        )}
        aria-describedby={undefined}
      >
        <div
          className={cn(
            "absolute inset-0 opacity-15 pointer-events-none rounded-lg",
            paperTheme.effects.paperTexture
          )}
        />

        <DialogHeader className="relative">
          <DialogTitle
            className={cn(
              "text-xl flex items-center gap-2",
              paperTheme.colors.text.accent,
              paperTheme.fonts.handwriting
            )}
          >
            <Target className="w-5 h-5" />
            {isEditing ? "Edit Goal" : "New Savings Goal"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="relative space-y-4 pt-2">
          {/* Goal Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className={paperTheme.fonts.handwriting}>
              What are you saving for?
            </Label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., New MacBook, Vacation, Emergency Fund"
              required
              className={cn(
                "w-full px-3 py-2 rounded-lg border text-sm",
                paperTheme.colors.borders.amber,
                paperTheme.colors.background.white,
                "focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              )}
            />
          </div>

          {/* Target Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="amount" className={paperTheme.fonts.handwriting}>
              Target Amount
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">
                $
              </span>
              <input
                id="amount"
                type="number"
                step="0.01"
                min="1"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="1000.00"
                required
                className={cn(
                  "w-full pl-7 pr-3 py-2 rounded-lg border text-sm",
                  paperTheme.colors.borders.amber,
                  paperTheme.colors.background.white,
                  "focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                )}
              />
            </div>
          </div>

          {/* Deadline */}
          <div className="space-y-1.5">
            <Label htmlFor="deadline" className={paperTheme.fonts.handwriting}>
              Target Date (optional)
            </Label>
            <input
              id="deadline"
              type="date"
              value={deadline}
              min={today}
              onChange={(e) => setDeadline(e.target.value)}
              className={cn(
                "w-full px-3 py-2 rounded-lg border text-sm",
                paperTheme.colors.borders.amber,
                paperTheme.colors.background.white,
                "focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              )}
            />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label className={paperTheme.fonts.handwriting}>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setColor(option.value)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-all",
                    color === option.value
                      ? "ring-2 ring-offset-2 ring-stone-400 scale-110"
                      : "hover:scale-105"
                  )}
                  style={{ backgroundColor: option.value }}
                  title={option.label}
                />
              ))}
            </div>
          </div>

          {/* Image */}
          <div className="space-y-1.5">
            <Label className={paperTheme.fonts.handwriting}>
              Image (optional)
            </Label>
            <p className="text-xs text-stone-500 mb-2">
              Add an image of what you're saving for to stay motivated!
            </p>
            <ImageUploader value={imageUrl} onChange={setImageUrl} />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
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
              className={cn(
                "flex-1",
                "bg-amber-500 hover:bg-amber-600 text-white"
              )}
              disabled={
                !name.trim() || !targetAmount || parseFloat(targetAmount) <= 0
              }
            >
              {isEditing ? "Save Changes" : "Create Goal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default SavingsGoalForm;
