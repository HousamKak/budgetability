import { icons, type LucideIcon } from "lucide-react";

/** Convert PascalCase to kebab-case: "ShoppingCart" -> "shopping-cart" */
function toKebab(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

// Build a full map of kebab-case name -> component from all lucide icons
const iconMap: Record<string, LucideIcon> = {};
for (const [pascalName, component] of Object.entries(icons)) {
  iconMap[toKebab(pascalName)] = component as LucideIcon;
}

// Aliases for renamed icons (backward compat with existing stored values)
const aliases: Record<string, string> = {
  home: "house",
  "more-horizontal": "ellipsis",
  "bar-chart": "chart-bar",
  "pie-chart": "chart-pie",
  "trending-up": "trending-up",
  "trending-down": "trending-down",
};

const fallbackIcon = iconMap["circle-help"] || iconMap["help-circle"] || (Object.values(icons)[0] as LucideIcon);

function resolve(name: string): LucideIcon {
  return iconMap[name] || iconMap[aliases[name]] || fallbackIcon;
}

// Export the list of available icon names for the picker
export const AVAILABLE_ICONS = Object.keys(iconMap).sort();

interface CategoryIconProps extends React.SVGProps<SVGSVGElement> {
  name: string;
}

/**
 * Renders a Lucide icon by kebab-case name string.
 * Falls back to CircleHelp if icon not found.
 */
export function CategoryIcon({ name, ...props }: CategoryIconProps) {
  const IconComponent = resolve(name);
  return <IconComponent {...props} />;
}

export default CategoryIcon;
