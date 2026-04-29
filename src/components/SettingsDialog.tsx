import { CategoryDot } from "@/components/budget/CategoryBadge";
import { CategoryIcon } from "@/components/budget/CategoryIcon";
import { IconPicker } from "@/components/budget/IconPicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dataService, type Category } from "@/lib/data-service";
import { cn } from "@/lib/utils";
import { paperTheme } from "@/styles";
import {
  Calendar,
  Check,
  ChevronRight,
  Coins,
  Database,
  Download,
  GripVertical,
  Moon,
  Pencil,
  Plus,
  Quote,
  RotateCcw,
  Sun,
  Tag,
  Trash,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

type SettingsTab = "categories" | "preferences" | "display" | "data";

const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "\u20ac", name: "Euro" },
  { code: "GBP", symbol: "\u00a3", name: "British Pound" },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "JPY", symbol: "\u00a5", name: "Japanese Yen" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
  { code: "INR", symbol: "\u20b9", name: "Indian Rupee" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso" },
  { code: "TRY", symbol: "\u20ba", name: "Turkish Lira" },
  { code: "SAR", symbol: "SAR", name: "Saudi Riyal" },
  { code: "AED", symbol: "AED", name: "UAE Dirham" },
];

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "categories", label: "Categories", icon: <Tag className="w-4 h-4" /> },
  { id: "preferences", label: "Preferences", icon: <Coins className="w-4 h-4" /> },
  { id: "display", label: "Display", icon: <Sun className="w-4 h-4" /> },
  { id: "data", label: "Data", icon: <Database className="w-4 h-4" /> },
];

// ─── Component ──────────────────────────────────────────────────────────────

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("categories");

  // Category state
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", color: "", icon: "" });
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [newForm, setNewForm] = useState({
    name: "",
    color: "#3b82f6",
    icon: "circle",
  });

  // Preferences state (placeholders)
  const [currency, setCurrency] = useState("USD");
  const [weekStart, setWeekStart] = useState<"monday" | "sunday">("monday");
  const [defaultBudget, setDefaultBudget] = useState("");

  // Display state (placeholders)
  const [darkMode, setDarkMode] = useState(false);
  const [showQuotes, setShowQuotes] = useState(true);

  useEffect(() => {
    if (open) {
      loadCategories();
    }
  }, [open]);

  // ─── Category handlers ──────────────────────────────────────────────────

  async function loadCategories() {
    try {
      setLoading(true);
      await dataService.ensureDefaults();
      const cats = await dataService.getCategories();
      setCategories(cats);
    } catch (error) {
      console.error("Failed to load categories:", error);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setEditForm({
      name: category.name,
      color: category.color,
      icon: category.icon,
    });
  }

  async function saveEdit(id: string) {
    try {
      await dataService.updateCategory(id, {
        name: editForm.name,
        color: editForm.color,
        icon: editForm.icon,
      });
      await loadCategories();
      setEditingId(null);
    } catch (error) {
      console.error("Failed to update category:", error);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ name: "", color: "", icon: "" });
  }

  async function addNewCategory() {
    if (!newForm.name.trim()) return;
    try {
      await dataService.addCategory({
        name: newForm.name,
        color: newForm.color,
        icon: newForm.icon,
        sortOrder: categories.length,
        isDefault: false,
      });
      await loadCategories();
      setIsAddingNew(false);
      setNewForm({ name: "", color: "#3b82f6", icon: "circle" });
    } catch (error) {
      console.error("Failed to add category:", error);
    }
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    // Required for Firefox to register the drag.
    e.dataTransfer.setData("text/plain", id);
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    if (!draggingId || draggingId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(id);
  }

  function handleDragLeave(id: string) {
    setDragOverId((prev) => (prev === id ? null : prev));
  }

  async function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    const sourceId = draggingId;
    setDraggingId(null);
    setDragOverId(null);
    if (!sourceId || sourceId === targetId) return;

    const sourceIdx = categories.findIndex((c) => c.id === sourceId);
    const targetIdx = categories.findIndex((c) => c.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const reordered = [...categories];
    const [moved] = reordered.splice(sourceIdx, 1);
    reordered.splice(targetIdx, 0, moved);

    // Optimistic update; persist in background.
    setCategories(reordered);
    try {
      await dataService.reorderCategories(reordered.map((c) => c.id));
    } catch (error) {
      console.error("Failed to reorder categories:", error);
      await loadCategories();
    }
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverId(null);
  }

  async function deleteCategory(id: string) {
    if (
      !confirm(
        "Delete this category? Existing expenses with this category will keep their category name."
      )
    )
      return;
    try {
      await dataService.removeCategory(id);
      await loadCategories();
    } catch (error) {
      console.error("Failed to delete category:", error);
    }
  }

  // ─── Render helpers ──────────────────────────────────────────────────────

  function SettingRow({
    icon,
    label,
    description,
    children,
  }: {
    icon: React.ReactNode;
    label: string;
    description?: string;
    children: React.ReactNode;
  }) {
    return (
      <div className="flex items-center gap-4 p-3 rounded-xl bg-white border border-stone-200 hover:shadow-sm transition-all">
        <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-stone-800">{label}</p>
          {description && (
            <p className="text-xs text-stone-500 mt-0.5">{description}</p>
          )}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    );
  }

  function Toggle({
    enabled,
    onChange,
  }: {
    enabled: boolean;
    onChange: (v: boolean) => void;
  }) {
    return (
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={cn(
          "relative w-11 h-6 rounded-full transition-colors",
          enabled ? "bg-amber-500" : "bg-stone-300"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
            enabled && "translate-x-5"
          )}
        />
      </button>
    );
  }

  function ComingSoonBadge() {
    return (
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-600 border border-amber-200">
        Soon
      </span>
    );
  }

  // ─── Tab content ─────────────────────────────────────────────────────────

  function renderCategories() {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold handwriting text-stone-700">
            Categories
          </h3>
          <Button
            onClick={() => setIsAddingNew(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl h-9 px-4 shadow-sm hover:shadow-md transition-all"
            disabled={isAddingNew}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Category
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-stone-500">Loading...</div>
        ) : (
          <div className="space-y-2">
            {/* Add New Form */}
            {isAddingNew && (
              <div className="p-3 border-2 border-amber-300 rounded-xl bg-amber-50/50 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={newForm.name}
                      onChange={(e) =>
                        setNewForm({ ...newForm, name: e.target.value })
                      }
                      placeholder="Category name"
                      className="h-8 text-sm"
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Color</Label>
                    <Input
                      type="color"
                      value={newForm.color}
                      onChange={(e) =>
                        setNewForm({ ...newForm, color: e.target.value })
                      }
                      className="h-8 w-full cursor-pointer"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Icon</Label>
                    <IconPicker
                      value={newForm.icon}
                      onChange={(icon) => setNewForm({ ...newForm, icon })}
                      color={newForm.color}
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    onClick={addNewCategory}
                    className="h-8 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-sm hover:shadow-md transition-all"
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                  <Button
                    onClick={() => {
                      setIsAddingNew(false);
                      setNewForm({ name: "", color: "#3b82f6", icon: "circle" });
                    }}
                    variant="ghost"
                    className="h-8 px-3 rounded-xl hover:bg-stone-100"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Category List */}
            {categories.map((category) => {
              const isEditing = editingId === category.id;
              const isDragging = draggingId === category.id;
              const isDragOver = dragOverId === category.id;
              return (
              <div
                key={category.id}
                draggable={!isEditing}
                onDragStart={(e) => handleDragStart(e, category.id)}
                onDragOver={(e) => handleDragOver(e, category.id)}
                onDragLeave={() => handleDragLeave(category.id)}
                onDrop={(e) => handleDrop(e, category.id)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl bg-white border border-stone-200 hover:shadow-sm transition-all",
                  isDragging && "opacity-40",
                  isDragOver && "border-amber-400 ring-2 ring-amber-200",
                )}
              >
                {isEditing ? (
                  <>
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <Input
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                        className="h-8 text-sm"
                        autoFocus
                      />
                      <Input
                        type="color"
                        value={editForm.color}
                        onChange={(e) =>
                          setEditForm({ ...editForm, color: e.target.value })
                        }
                        className="h-8 cursor-pointer"
                      />
                      <IconPicker
                        value={editForm.icon}
                        onChange={(icon) =>
                          setEditForm({ ...editForm, icon })
                        }
                        color={editForm.color}
                      />
                    </div>
                    <div className="flex gap-1">
                      <Button
                        onClick={() => saveEdit(category.id)}
                        className="h-8 w-8 p-0 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-sm hover:shadow-md transition-all"
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                      <Button
                        onClick={cancelEdit}
                        variant="ghost"
                        className="h-8 w-8 p-0 border-2 border-amber-900/20 bg-white rounded-xl shadow-sm hover:shadow-md transition-all"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <GripVertical className="w-4 h-4 text-stone-400 cursor-grab active:cursor-grabbing" />
                    <CategoryDot color={category.color} size="md" />
                    <CategoryIcon
                      name={category.icon}
                      className="w-5 h-5"
                      style={{ color: category.color }}
                    />
                    <span className="flex-1 font-medium text-stone-800">
                      {category.name}
                    </span>
                    {category.isDefault && (
                      <span className="text-xs px-2 py-0.5 bg-stone-100 text-stone-600 rounded">
                        Default
                      </span>
                    )}
                    <div className="flex gap-1">
                      <Button
                        onClick={() => startEdit(category)}
                        variant="ghost"
                        className="h-8 w-8 p-0 rounded-xl bg-white border-2 border-amber-900/20 hover:shadow-md transition-all"
                      >
                        <Pencil className="w-3 h-3 text-amber-600" />
                      </Button>
                      <Button
                        onClick={() => deleteCategory(category.id)}
                        variant="ghost"
                        className="h-8 w-8 p-0 rounded-xl bg-white border-2 border-red-300 hover:bg-red-50 hover:shadow-md transition-all"
                        disabled={category.isDefault}
                        title={
                          category.isDefault
                            ? "Cannot delete default category"
                            : "Delete category"
                        }
                      >
                        <Trash className="w-3 h-3 text-red-500" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderPreferences() {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold handwriting text-stone-700 mb-4">
          Preferences
        </h3>

        {/* Currency */}
        <SettingRow
          icon={<Coins className="w-4 h-4" />}
          label="Currency"
          description="Used for all amounts across the app"
        >
          <div className="flex items-center gap-2">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="h-8 px-2 pr-7 text-sm rounded-lg border border-stone-300 bg-white text-stone-700 focus:outline-none focus:border-amber-400 appearance-none cursor-pointer"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.code}
                </option>
              ))}
            </select>
            <ComingSoonBadge />
          </div>
        </SettingRow>

        {/* Week starts on */}
        <SettingRow
          icon={<Calendar className="w-4 h-4" />}
          label="Week starts on"
          description="First day shown in the calendar"
        >
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-stone-300 overflow-hidden">
              <button
                type="button"
                onClick={() => setWeekStart("monday")}
                className={cn(
                  "px-3 h-8 text-xs font-medium transition-colors",
                  weekStart === "monday"
                    ? "bg-amber-500 text-white"
                    : "bg-white text-stone-600 hover:bg-stone-50"
                )}
              >
                Mon
              </button>
              <button
                type="button"
                onClick={() => setWeekStart("sunday")}
                className={cn(
                  "px-3 h-8 text-xs font-medium transition-colors border-l border-stone-300",
                  weekStart === "sunday"
                    ? "bg-amber-500 text-white"
                    : "bg-white text-stone-600 hover:bg-stone-50"
                )}
              >
                Sun
              </button>
            </div>
            <ComingSoonBadge />
          </div>
        </SettingRow>

        {/* Default monthly budget */}
        <SettingRow
          icon={<Coins className="w-4 h-4" />}
          label="Default monthly budget"
          description="Auto-fill amount for new months"
        >
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-stone-400">
                $
              </span>
              <Input
                type="number"
                value={defaultBudget}
                onChange={(e) => setDefaultBudget(e.target.value)}
                placeholder="0"
                className="h-8 w-24 pl-5 text-sm text-right"
              />
            </div>
            <ComingSoonBadge />
          </div>
        </SettingRow>
      </div>
    );
  }

  function renderDisplay() {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold handwriting text-stone-700 mb-4">
          Display
        </h3>

        {/* Dark mode */}
        <SettingRow
          icon={darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          label="Dark mode"
          description="Switch between light and dark theme"
        >
          <div className="flex items-center gap-2">
            <Toggle enabled={darkMode} onChange={setDarkMode} />
            <ComingSoonBadge />
          </div>
        </SettingRow>

        {/* Show daily quotes */}
        <SettingRow
          icon={<Quote className="w-4 h-4" />}
          label="Daily quotes"
          description="Show motivational quotes on the calendar"
        >
          <div className="flex items-center gap-2">
            <Toggle enabled={showQuotes} onChange={setShowQuotes} />
            <ComingSoonBadge />
          </div>
        </SettingRow>
      </div>
    );
  }

  function renderData() {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold handwriting text-stone-700 mb-4">
          Data Management
        </h3>

        {/* Export */}
        <SettingRow
          icon={<Download className="w-4 h-4" />}
          label="Export data"
          description="Download all your data as a JSON file"
        >
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="h-8 px-3 text-xs rounded-lg border border-stone-300 bg-white hover:bg-stone-50"
              disabled
            >
              Export
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
            <ComingSoonBadge />
          </div>
        </SettingRow>

        {/* Import */}
        <SettingRow
          icon={<Upload className="w-4 h-4" />}
          label="Import data"
          description="Restore data from a JSON backup"
        >
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="h-8 px-3 text-xs rounded-lg border border-stone-300 bg-white hover:bg-stone-50"
              disabled
            >
              Import
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
            <ComingSoonBadge />
          </div>
        </SettingRow>

        {/* Clear data */}
        <SettingRow
          icon={<RotateCcw className="w-4 h-4" />}
          label="Reset all data"
          description="Permanently delete all budgets, expenses, and plans"
        >
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="h-8 px-3 text-xs rounded-lg border border-red-300 bg-white text-red-600 hover:bg-red-50"
              disabled
            >
              Reset
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
            <ComingSoonBadge />
          </div>
        </SettingRow>
      </div>
    );
  }

  // ─── Main render ─────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-3xl max-h-[85vh] overflow-hidden p-0",
          paperTheme.colors.background.cardGradient,
          paperTheme.colors.borders.paper
        )}
      >
        {/* Paper texture */}
        <div
          className={cn(
            "absolute inset-0 opacity-15 pointer-events-none rounded-2xl",
            paperTheme.effects.paperTexture
          )}
        />

        {/* Yellow tape effect at top */}
        <div
          className={cn(
            "absolute -top-2 left-1/2 -translate-x-1/2 w-16 h-4 z-20",
            paperTheme.effects.yellowTape
          )}
        />

        <div className="flex h-[70vh] relative z-10">
          {/* Sidebar */}
          <div className="w-44 shrink-0 border-r border-amber-200/60 p-4 flex flex-col gap-1">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-xl font-bold handwriting text-stone-800">
                Settings
              </DialogTitle>
              <DialogDescription className="text-xs text-stone-500">
                Customize your experience
              </DialogDescription>
            </DialogHeader>

            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                  activeTab === tab.id
                    ? "bg-amber-100 text-amber-800 shadow-sm border border-amber-200"
                    : "text-stone-600 hover:bg-amber-50 hover:text-stone-800"
                )}
              >
                <span className={cn(
                  "shrink-0",
                  activeTab === tab.id ? "text-amber-600" : "text-stone-400"
                )}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content area */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === "categories" && renderCategories()}
            {activeTab === "preferences" && renderPreferences()}
            {activeTab === "display" && renderDisplay()}
            {activeTab === "data" && renderData()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
