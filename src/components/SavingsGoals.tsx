import { useState, useEffect } from "react";
import { PiggyBank, Plus, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SavingsGoalCard } from "./savings/SavingsGoalCard";
import { SavingsGoalForm } from "./savings/SavingsGoalForm";
import { ContributeDialog } from "./savings/ContributeDialog";
import { paperTheme } from "@/styles";
import { cn, formatCurrency } from "@/lib/utils";
import { dataService } from "@/lib/data-service";
import type { SavingsGoal } from "@/lib/data-service";

/**
 * Savings Goals page - track savings goals with images and progress
 */
export default function SavingsGoals() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | undefined>();
  const [contributeDialogOpen, setContributeDialogOpen] = useState(false);
  const [contributingGoal, setContributingGoal] = useState<SavingsGoal | null>(null);

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      setLoading(true);
      const data = await dataService.getSavingsGoals();
      setGoals(data);
    } catch (error) {
      console.error("Failed to load savings goals:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGoal = async (
    goal: Omit<SavingsGoal, "id" | "currentAmount" | "isCompleted" | "completedAt">
  ) => {
    try {
      await dataService.addSavingsGoal(goal);
      await loadGoals();
    } catch (error) {
      console.error("Failed to create goal:", error);
    }
  };

  const handleUpdateGoal = async (
    goal: Omit<SavingsGoal, "id" | "currentAmount" | "isCompleted" | "completedAt">
  ) => {
    if (!editingGoal) return;
    try {
      await dataService.updateSavingsGoal(editingGoal.id, goal);
      await loadGoals();
      setEditingGoal(undefined);
    } catch (error) {
      console.error("Failed to update goal:", error);
    }
  };

  const handleDeleteGoal = async (goal: SavingsGoal) => {
    if (!confirm(`Delete "${goal.name}"? This action cannot be undone.`)) return;
    try {
      await dataService.removeSavingsGoal(goal.id);
      await loadGoals();
    } catch (error) {
      console.error("Failed to delete goal:", error);
    }
  };

  const handleEditGoal = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setFormOpen(true);
  };

  const handleContribute = (goal: SavingsGoal) => {
    setContributingGoal(goal);
    setContributeDialogOpen(true);
  };

  const handleContributeSubmit = async (
    goalId: string,
    accountId: string,
    amount: number,
    note?: string
  ) => {
    try {
      await dataService.contributeToSavingsGoal(goalId, accountId, amount, note);
      await loadGoals();
    } catch (error) {
      console.error("Failed to contribute:", error);
      throw error;
    }
  };

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setEditingGoal(undefined);
    }
  };

  // Calculate summary stats
  const activeGoals = goals.filter((g) => !g.isCompleted);
  const completedGoals = goals.filter((g) => g.isCompleted);
  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  return (
    <div
      className="min-h-screen w-full py-8 px-4 md:px-8 bg-[repeating-linear-gradient(0deg,#fbf6e9,#fbf6e9_28px,#f2e8cf_28px,#f2e8cf_29px)]"
    >
      {/* Background texture */}
      <div
        className={cn(
          "fixed inset-0 opacity-5 pointer-events-none",
          paperTheme.effects.paperTexture
        )}
      />

      <div className="max-w-6xl mx-auto relative">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1
              className={cn(
                "text-3xl md:text-4xl font-bold flex items-center gap-3",
                paperTheme.colors.text.accent,
                paperTheme.fonts.handwriting
              )}
            >
              <PiggyBank className="w-8 h-8" />
              Savings Goals
            </h1>
            <p className={cn("mt-1", paperTheme.colors.text.muted)}>
              Track your progress towards your financial dreams
            </p>
          </div>

          <Button
            onClick={() => setFormOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Goal
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Total Saved */}
          <div
            className={cn(
              "relative p-4 rounded-xl",
              paperTheme.colors.background.cardGradient,
              paperTheme.colors.borders.paper,
              paperTheme.effects.shadow.md
            )}
          >
            <div
              className={cn(
                "absolute inset-0 opacity-15 pointer-events-none rounded-xl",
                paperTheme.effects.paperTexture
              )}
            />
            <div
              className={cn(
                "absolute -top-1 left-4 w-10 h-3",
                paperTheme.effects.yellowTape
              )}
            />
            <div className="relative">
              <div className="flex items-center gap-2 text-stone-500 text-sm mb-1">
                <TrendingUp className="w-4 h-4" />
                Total Saved
              </div>
              <p
                className={cn(
                  "text-2xl font-bold",
                  paperTheme.colors.text.accent,
                  paperTheme.fonts.handwriting
                )}
              >
                {formatCurrency(totalSaved)}
              </p>
              <p className="text-xs text-stone-400 mt-1">
                of {formatCurrency(totalTarget)} target
              </p>
            </div>
          </div>

          {/* Overall Progress */}
          <div
            className={cn(
              "relative p-4 rounded-xl",
              paperTheme.colors.background.cardGradient,
              paperTheme.colors.borders.paper,
              paperTheme.effects.shadow.md
            )}
          >
            <div
              className={cn(
                "absolute inset-0 opacity-15 pointer-events-none rounded-xl",
                paperTheme.effects.paperTexture
              )}
            />
            <div className="absolute -bottom-1 -right-1 w-8 h-2 bg-red-400/60 rounded-sm shadow-sm transform rotate-12" />
            <div className="relative">
              <div className="flex items-center gap-2 text-stone-500 text-sm mb-1">
                <Target className="w-4 h-4" />
                Overall Progress
              </div>
              <p
                className={cn(
                  "text-2xl font-bold",
                  paperTheme.colors.text.accent,
                  paperTheme.fonts.handwriting
                )}
              >
                {overallProgress.toFixed(1)}%
              </p>
              <div className="mt-2 h-2 bg-stone-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, overallProgress)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Goals Count */}
          <div
            className={cn(
              "relative p-4 rounded-xl",
              paperTheme.colors.background.cardGradient,
              paperTheme.colors.borders.paper,
              paperTheme.effects.shadow.md
            )}
          >
            <div
              className={cn(
                "absolute inset-0 opacity-15 pointer-events-none rounded-xl",
                paperTheme.effects.paperTexture
              )}
            />
            <div className="relative">
              <div className="flex items-center gap-2 text-stone-500 text-sm mb-1">
                <PiggyBank className="w-4 h-4" />
                Goals
              </div>
              <div className="flex items-baseline gap-2">
                <p
                  className={cn(
                    "text-2xl font-bold",
                    paperTheme.colors.text.accent,
                    paperTheme.fonts.handwriting
                  )}
                >
                  {activeGoals.length}
                </p>
                <span className="text-stone-400 text-sm">active</span>
                {completedGoals.length > 0 && (
                  <>
                    <span className="text-stone-300">•</span>
                    <span className="text-green-600 text-sm font-medium">
                      {completedGoals.length} completed
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Goals Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : goals.length === 0 ? (
          <div
            className={cn(
              "relative p-12 rounded-xl text-center",
              paperTheme.colors.background.cardGradient,
              paperTheme.colors.borders.paper,
              paperTheme.effects.shadow.md
            )}
          >
            <div
              className={cn(
                "absolute inset-0 opacity-15 pointer-events-none rounded-xl",
                paperTheme.effects.paperTexture
              )}
            />
            <div
              className={cn(
                "absolute -top-2 left-1/2 -translate-x-1/2 w-16 h-4",
                paperTheme.effects.yellowTape
              )}
            />
            <div className="relative">
              <PiggyBank className="w-16 h-16 text-amber-300 mx-auto mb-4" />
              <h2
                className={cn(
                  "text-xl font-bold mb-2",
                  paperTheme.colors.text.accent,
                  paperTheme.fonts.handwriting
                )}
              >
                No savings goals yet
              </h2>
              <p className="text-stone-500 mb-6 max-w-md mx-auto">
                Create your first savings goal to start tracking your progress towards
                your financial dreams!
              </p>
              <Button
                onClick={() => setFormOpen(true)}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Goal
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Active Goals */}
            {activeGoals.length > 0 && (
              <div className="mb-8">
                <h2
                  className={cn(
                    "text-xl font-bold mb-4 flex items-center gap-2",
                    paperTheme.colors.text.accent,
                    paperTheme.fonts.handwriting
                  )}
                >
                  <Target className="w-5 h-5" />
                  Active Goals
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeGoals.map((goal) => (
                    <SavingsGoalCard
                      key={goal.id}
                      goal={goal}
                      onEdit={handleEditGoal}
                      onDelete={handleDeleteGoal}
                      onContribute={handleContribute}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Completed Goals */}
            {completedGoals.length > 0 && (
              <div>
                <h2
                  className={cn(
                    "text-xl font-bold mb-4 flex items-center gap-2 text-green-600",
                    paperTheme.fonts.handwriting
                  )}
                >
                  <PiggyBank className="w-5 h-5" />
                  Completed Goals
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {completedGoals.map((goal) => (
                    <SavingsGoalCard
                      key={goal.id}
                      goal={goal}
                      onEdit={handleEditGoal}
                      onDelete={handleDeleteGoal}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create/Edit Goal Dialog */}
      <SavingsGoalForm
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        onSubmit={editingGoal ? handleUpdateGoal : handleCreateGoal}
        editingGoal={editingGoal}
      />

      {/* Contribute Dialog */}
      <ContributeDialog
        open={contributeDialogOpen}
        onOpenChange={setContributeDialogOpen}
        goal={contributingGoal}
        onContribute={handleContributeSubmit}
      />
    </div>
  );
}
