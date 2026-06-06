import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { AccountGroup } from "@/lib/data-service";
import { cn } from "@/lib/utils";
import { paperTheme } from "@/styles";
import { useEffect, useState } from "react";
import { IconPicker } from "@/components/budget/IconPicker";
import { CategoryIcon } from "@/components/budget/CategoryIcon";

// Preset colors for groups (mother accounts)
const GROUP_COLORS = [
  "#f59e0b", // amber
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ef4444", // red
  "#14b8a6", // teal
  "#6b7280", // stone
];

const DEFAULT_GROUP_ICON = "layers";

interface GroupFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (group: Omit<AccountGroup, "id" | "sortOrder">) => void;
  editingGroup?: AccountGroup;
}

/**
 * Dialog for creating or editing an account group ("mother account").
 * A group is purely organizational — it holds no balance of its own.
 */
export function GroupForm({
  open,
  onOpenChange,
  onSubmit,
  editingGroup,
}: GroupFormProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(GROUP_COLORS[0]);
  const [icon, setIcon] = useState(DEFAULT_GROUP_ICON);

  const isEditing = !!editingGroup;

  useEffect(() => {
    if (open) {
      if (editingGroup) {
        setName(editingGroup.name);
        setColor(editingGroup.color || GROUP_COLORS[0]);
        setIcon(editingGroup.icon || DEFAULT_GROUP_ICON);
      } else {
        setName("");
        setColor(GROUP_COLORS[0]);
        setIcon(DEFAULT_GROUP_ICON);
      }
    }
  }, [open, editingGroup]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), color, icon });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-md",
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

        <DialogHeader className="relative pb-2">
          <DialogTitle
            className={cn(
              "text-2xl",
              paperTheme.colors.text.accent,
              paperTheme.fonts.handwriting,
            )}
          >
            {isEditing ? "Edit Group" : "New Group"}
          </DialogTitle>
          <DialogDescription className="text-sm text-stone-500">
            A group gathers several accounts under one mother account. Its
            balance is the sum of its members.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="relative space-y-5 pt-2">
          {/* Group Name */}
          <div className="space-y-2">
            <Label
              htmlFor="group-name"
              className={cn("text-base", paperTheme.fonts.handwriting)}
            >
              Group Name
            </Label>
            <input
              id="group-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Global Savings"
              required
              className={cn(
                "w-full px-4 py-3 rounded-xl border-2 text-sm shadow-sm",
                paperTheme.colors.borders.amber,
                paperTheme.colors.background.white,
                "focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:shadow-md transition-shadow",
              )}
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label className={cn("text-base", paperTheme.fonts.handwriting)}>
              Color
            </Label>
            <div className="flex flex-wrap gap-2">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-transform",
                    color === c
                      ? "border-stone-700 scale-110"
                      : "border-white/60 hover:scale-105",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <Label className={cn("text-base", paperTheme.fonts.handwriting)}>
              Icon
            </Label>
            <IconPicker value={icon} onChange={setIcon} color={color} />
          </div>

          {/* Preview */}
          <div
            className={cn(
              "p-4 rounded-xl border-2 shadow-sm",
              paperTheme.colors.borders.amber,
              "bg-white/50",
            )}
          >
            <p className="text-xs text-stone-500 mb-2">Preview</p>
            <div className="flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: color + "20" }}
              >
                <CategoryIcon
                  name={icon}
                  className="w-5 h-5"
                  style={{ color }}
                />
              </div>
              <p className={cn("font-medium", paperTheme.fonts.handwriting)}>
                {name || "Group Name"}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl border-2 border-amber-900/20 shadow-sm hover:shadow-md transition-all py-5"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className={cn(
                "flex-1 rounded-xl shadow-sm hover:shadow-md transition-all py-5",
                "bg-amber-500 hover:bg-amber-600 text-white",
              )}
              disabled={!name.trim()}
            >
              {isEditing ? "Save Changes" : "Create Group"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default GroupForm;
