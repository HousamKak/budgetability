import { Target, Calendar, MoreVertical, Pencil, Trash2, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ProgressRing, ProgressBar } from "./ProgressRing";
import { paperTheme } from "@/styles";
import { cn } from "@/lib/utils";
import type { SavingsGoal } from "@/lib/data-service";

interface SavingsGoalCardProps {
  goal: SavingsGoal;
  onEdit?: (goal: SavingsGoal) => void;
  onDelete?: (goal: SavingsGoal) => void;
  onContribute?: (goal: SavingsGoal) => void;
}

/**
 * Display a savings goal with image, progress, and actions
 */
export function SavingsGoalCard({
  goal,
  onEdit,
  onDelete,
  onContribute,
}: SavingsGoalCardProps) {
  const progress = goal.targetAmount > 0
    ? (goal.currentAmount / goal.targetAmount) * 100
    : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDaysRemaining = (deadline: string) => {
    const now = new Date();
    const end = new Date(deadline);
    const diff = end.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  const daysRemaining = goal.deadline ? getDaysRemaining(goal.deadline) : null;
  const isOverdue = daysRemaining !== null && daysRemaining < 0;
  const isUrgent = daysRemaining !== null && daysRemaining <= 7 && daysRemaining >= 0;

  return (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden",
        paperTheme.colors.background.cardGradient,
        paperTheme.colors.borders.paper,
        paperTheme.effects.shadow.md,
        "transition-transform duration-200 hover:scale-[1.02]",
        goal.isCompleted && "ring-2 ring-green-400"
      )}
    >
      {/* Paper texture overlay */}
      <div
        className={cn(
          "absolute inset-0 opacity-15 pointer-events-none",
          paperTheme.effects.paperTexture
        )}
      />

      {/* Image or placeholder */}
      <div className="relative h-40 bg-gradient-to-br from-amber-100 to-amber-200">
        {goal.imageUrl ? (
          <img
            src={goal.imageUrl}
            alt={goal.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Target className="w-16 h-16 text-amber-300" />
          </div>
        )}

        {/* Completed overlay */}
        {goal.isCompleted && (
          <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
            <div className="bg-green-500 text-white rounded-full p-3">
              <Check className="w-8 h-8" />
            </div>
          </div>
        )}

        {/* Actions menu */}
        <div className="absolute top-2 right-2">
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 bg-white/80 hover:bg-white"
              >
                <MoreVertical className="w-4 h-4 text-stone-600" />
              </Button>
            </HoverCardTrigger>
            <HoverCardContent align="end" className="w-36 p-1">
              <div className="flex flex-col gap-0.5">
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start h-8 text-xs"
                    onClick={() => onEdit(goal)}
                  >
                    <Pencil className="w-3 h-3 mr-2" />
                    Edit
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => onDelete(goal)}
                  >
                    <Trash2 className="w-3 h-3 mr-2" />
                    Delete
                  </Button>
                )}
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>

        {/* Yellow tape */}
        <div
          className={cn(
            "absolute -top-1 left-4 w-12 h-4",
            paperTheme.effects.yellowTape
          )}
        />
      </div>

      {/* Content */}
      <div className="relative p-4">
        {/* Title */}
        <h3
          className={cn(
            "text-lg font-bold mb-1 truncate",
            paperTheme.colors.text.accent,
            paperTheme.fonts.handwriting
          )}
        >
          {goal.name}
        </h3>

        {/* Deadline */}
        {goal.deadline && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs mb-3",
              isOverdue
                ? "text-red-500"
                : isUrgent
                ? "text-orange-500"
                : "text-stone-500"
            )}
          >
            <Calendar className="w-3 h-3" />
            {isOverdue ? (
              <span>Overdue by {Math.abs(daysRemaining!)} days</span>
            ) : (
              <span>
                {formatDate(goal.deadline)} ({daysRemaining} days left)
              </span>
            )}
          </div>
        )}

        {/* Progress section */}
        <div className="flex items-center gap-4 mb-4">
          <ProgressRing
            progress={progress}
            size={60}
            strokeWidth={6}
            color={goal.isCompleted ? "#22c55e" : goal.color || "#f59e0b"}
          >
            <span className="text-xs font-bold">{Math.round(progress)}%</span>
          </ProgressRing>

          <div className="flex-1">
            <p className="text-sm text-stone-500">Progress</p>
            <p
              className={cn(
                "text-lg font-bold",
                paperTheme.fonts.handwriting,
                goal.isCompleted ? "text-green-600" : paperTheme.colors.text.accent
              )}
            >
              {formatCurrency(goal.currentAmount)}
            </p>
            <p className="text-xs text-stone-400">
              of {formatCurrency(goal.targetAmount)}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <ProgressBar
          progress={progress}
          height={6}
          color={goal.isCompleted ? "#22c55e" : goal.color || "#f59e0b"}
          className="mb-4"
        />

        {/* Contribute button */}
        {!goal.isCompleted && onContribute && (
          <Button
            size="sm"
            className={cn(
              "w-full",
              "bg-amber-500 hover:bg-amber-600 text-white"
            )}
            onClick={() => onContribute(goal)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Money
          </Button>
        )}

        {goal.isCompleted && (
          <div className="text-center text-sm text-green-600 font-medium">
            Goal completed!
          </div>
        )}
      </div>

      {/* Decorative tape */}
      <div className="absolute -bottom-1 -right-1 w-10 h-3 bg-red-400/60 rounded-sm shadow-sm transform rotate-12" />
    </div>
  );
}

export default SavingsGoalCard;
