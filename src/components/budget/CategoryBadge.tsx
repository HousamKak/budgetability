import { CategoryIcon } from "./CategoryIcon";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/data-service";

interface CategoryBadgeProps {
  category: Category;
  showIcon?: boolean;
  showName?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Displays a category with color dot, icon, and/or name
 * Used in calendar hover cards, expense lists, etc.
 */
export function CategoryBadge({
  category,
  showIcon = true,
  showName = true,
  size = "sm",
  className,
}: CategoryBadgeProps) {
  const sizeClasses = {
    sm: {
      container: "gap-1",
      dot: "w-2 h-2",
      icon: "w-3 h-3",
      text: "text-xs",
    },
    md: {
      container: "gap-1.5",
      dot: "w-2.5 h-2.5",
      icon: "w-4 h-4",
      text: "text-sm",
    },
    lg: {
      container: "gap-2",
      dot: "w-3 h-3",
      icon: "w-5 h-5",
      text: "text-base",
    },
  };

  const sizes = sizeClasses[size];

  return (
    <span
      className={cn(
        "inline-flex items-center",
        sizes.container,
        className
      )}
    >
      {/* Color dot */}
      <span
        className={cn("rounded-full flex-shrink-0", sizes.dot)}
        style={{ backgroundColor: category.color }}
      />

      {/* Icon */}
      {showIcon && (
        <CategoryIcon
          name={category.icon}
          className={cn("flex-shrink-0", sizes.icon)}
          style={{ color: category.color }}
        />
      )}

      {/* Name */}
      {showName && (
        <span className={cn("truncate", sizes.text)}>
          {category.name}
        </span>
      )}
    </span>
  );
}

/**
 * Simple color dot for inline use
 */
export function CategoryDot({
  color,
  size = "sm",
  className,
}: {
  color: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
    lg: "w-3 h-3",
  };

  return (
    <span
      className={cn("rounded-full inline-block flex-shrink-0", sizeClasses[size], className)}
      style={{ backgroundColor: color }}
    />
  );
}

export default CategoryBadge;
