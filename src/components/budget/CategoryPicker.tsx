import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category } from "@/lib/data-service";
import { dataService, DEFAULT_CATEGORIES } from "@/lib/data-service";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { CategoryDot } from "./CategoryBadge";
import { CategoryIcon } from "./CategoryIcon";

interface CategoryPickerProps {
  value?: string;
  onChange: (value: string, category?: Category) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  /** If true, uses category name as value instead of ID (for backwards compatibility) */
  useNameAsValue?: boolean;
}

/**
 * Dropdown selector for categories with colored icons
 * Loads categories from dataService and seeds defaults if needed
 */
export function CategoryPicker({
  value,
  onChange,
  placeholder = "Select category",
  className,
  triggerClassName,
  disabled = false,
  useNameAsValue = false,
}: CategoryPickerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      setLoading(true);
      let cats = await dataService.getCategories();

      // Seed default categories if none exist
      if (cats.length === 0) {
        await dataService.seedDefaultCategories();
        cats = await dataService.getCategories();
      }

      setCategories(cats);
    } catch (error) {
      console.error("Failed to load categories:", error);
      // Fallback to DEFAULT_CATEGORIES with generated IDs
      const fallback: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({
        ...c,
        id: `fallback-${i}`,
      }));
      setCategories(fallback);
    } finally {
      setLoading(false);
    }
  }

  // Find selected category by ID or name depending on mode
  const selectedCategory = useNameAsValue
    ? categories.find((c) => c.name.toLowerCase() === value?.toLowerCase())
    : categories.find((c) => c.id === value);

  // Get the value to use for the Select (always use name for internal consistency)
  const selectValue = selectedCategory?.name || value;

  const handleChange = (selectedName: string) => {
    const category = categories.find((c) => c.name === selectedName);
    if (category) {
      // Return name if useNameAsValue, otherwise return ID
      const returnValue = useNameAsValue ? category.name : category.id;
      onChange(returnValue, category);
    }
  };

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger className={cn("w-full", triggerClassName)}>
          <SelectValue placeholder="Loading..." />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <div className={className}>
      <Select
        value={selectValue}
        onValueChange={handleChange}
        disabled={disabled}
      >
        <SelectTrigger className={cn("w-full", triggerClassName)}>
          <SelectValue placeholder={placeholder}>
            {selectedCategory && (
              <span className="flex items-center gap-2">
                <CategoryDot color={selectedCategory.color} size="sm" />
                <CategoryIcon
                  name={selectedCategory.icon}
                  className="w-4 h-4"
                  style={{ color: selectedCategory.color }}
                />
                <span>{selectedCategory.name}</span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.name}>
              <span className="flex items-center gap-2">
                <CategoryDot color={category.color} size="sm" />
                <CategoryIcon
                  name={category.icon}
                  className="w-4 h-4"
                  style={{ color: category.color }}
                />
                <span>{category.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Hook to get categories with caching
 */
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      setLoading(true);
      setError(null);
      let cats = await dataService.getCategories();

      if (cats.length === 0) {
        await dataService.seedDefaultCategories();
        cats = await dataService.getCategories();
      }

      setCategories(cats);
    } catch (err) {
      setError(err as Error);
      // Fallback
      const fallback: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({
        ...c,
        id: `fallback-${i}`,
      }));
      setCategories(fallback);
    } finally {
      setLoading(false);
    }
  }

  const getCategoryById = (id: string): Category | undefined => {
    return categories.find((c) => c.id === id);
  };

  const getCategoryByName = (name: string): Category | undefined => {
    return categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
  };

  return {
    categories,
    loading,
    error,
    reload: loadCategories,
    getCategoryById,
    getCategoryByName,
  };
}

export default CategoryPicker;
