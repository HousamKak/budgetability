import { CategoryDot } from "@/components/budget/CategoryBadge";
import { CategoryIcon } from "@/components/budget/CategoryIcon";
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
import { Check, GripVertical, Pencil, Plus, Trash, X } from "lucide-react";
import { useEffect, useState } from "react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", color: "", icon: "" });
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newForm, setNewForm] = useState({
    name: "",
    color: "#3b82f6",
    icon: "circle",
  });

  useEffect(() => {
    if (open) {
      loadCategories();
    }
  }, [open]);

  async function loadCategories() {
    try {
      setLoading(true);
      let cats = await dataService.getCategories();

      if (cats.length === 0) {
        await dataService.seedDefaultCategories();
        cats = await dataService.getCategories();
      }

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
      alert("Failed to update category");
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ name: "", color: "", icon: "" });
  }

  async function addNewCategory() {
    if (!newForm.name.trim()) {
      alert("Category name is required");
      return;
    }

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
      alert("Failed to add category");
    }
  }

  async function deleteCategory(id: string) {
    if (
      !confirm(
        "Delete this category? Existing expenses with this category will keep their category name."
      )
    ) {
      return;
    }

    try {
      await dataService.removeCategory(id);
      await loadCategories();
    } catch (error) {
      console.error("Failed to delete category:", error);
      alert("Failed to delete category");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-2xl max-h-[80vh] overflow-y-auto",
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

        <DialogHeader className="relative z-10">
          <DialogTitle className="text-2xl font-bold handwriting text-stone-800">
            Settings
          </DialogTitle>
          <DialogDescription className="text-sm text-stone-500">
            Manage your budget categories and preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4 relative z-10">
          {/* Categories Section */}
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
                        <Label className="text-xs">Icon (Lucide name)</Label>
                        <Input
                          value={newForm.icon}
                          onChange={(e) =>
                            setNewForm({ ...newForm, icon: e.target.value })
                          }
                          placeholder="circle"
                          className="h-8 text-sm"
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
                          setNewForm({
                            name: "",
                            color: "#3b82f6",
                            icon: "circle",
                          });
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
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white border border-stone-200 hover:shadow-sm transition-all"
                  >
                    {editingId === category.id ? (
                      <>
                        {/* Edit Mode */}
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
                              setEditForm({
                                ...editForm,
                                color: e.target.value,
                              })
                            }
                            className="h-8 cursor-pointer"
                          />
                          <Input
                            value={editForm.icon}
                            onChange={(e) =>
                              setEditForm({ ...editForm, icon: e.target.value })
                            }
                            className="h-8 text-sm"
                            placeholder="icon-name"
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
                        {/* Display Mode */}
                        <GripVertical className="w-4 h-4 text-stone-400 cursor-move" />
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
                ))}
              </div>
            )}
          </div>

          {/* Future Settings Sections */}
          <div className="pt-4 border-t border-stone-200">
            <p className="text-sm text-stone-500 italic">
              More settings coming soon...
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
