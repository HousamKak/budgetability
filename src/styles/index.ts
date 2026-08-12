/**
 * Central styles export file
 * Import everything you need from here
 */

// Theme and design tokens
export { paperTheme, paperStyles } from './themes/paper-theme';

// Component styles
export { calendarStyles } from './components/calendar';
export { dialogStyles } from './components/dialog';
export { layoutStyles } from './components/layout';
export { plannerStyles } from './components/planner';
export { summaryCardStyles } from './components/summary-card';

// Utilities
export { cn, conditional, variant, size, state } from './utils/classNames';

// Common style combinations for quick use
export const commonStyles = {
  // Paper card with all effects
  paperCard: 'relative bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border-2 border-amber-300/70 rounded-2xl p-6 shadow-xl overflow-hidden',

  // Paper texture overlay
  paperTexture: 'absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_1px_1px,rgba(139,69,19,0.3)_1px,transparent_0)] bg-[length:12px_12px] rounded-2xl pointer-events-none',

  // Yellow tape effect
  yellowTape: 'absolute -top-2 left-1/2 -translate-x-1/2 w-16 h-6 bg-yellow-300/60 rounded-sm shadow-sm transform rotate-3',

  // Torn edge effect
  tornEdge: 'absolute -top-1 left-4 right-4 h-3 bg-[repeating-linear-gradient(90deg,#fcd34d,#fcd34d_8px,#fde68a_8px,#fde68a_16px)] rounded-t-2xl opacity-70',

  // Handwriting font
  handwriting: '"Patrick Hand", "Comic Sans MS", "Dirham", cursive',

  // Primary button
  primaryButton: 'bg-amber-200/80 hover:bg-amber-300/80 text-stone-900 border border-amber-300 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer',

  // Form input
  formInput: 'bg-white/80 border border-amber-200 focus:border-amber-400 focus:ring-amber-200 rounded-xl',

  // Icon
  icon: 'w-4 h-4 text-stone-600',
} as const;