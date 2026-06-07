import { paperTheme } from '../themes/paper-theme';

export const calendarStyles = {
  // Calendar day cell.
  // Phones (< lg): taller auto-height "day cards" so the metrics are readable.
  // Desktop (lg+): the classic square 7-column grid cell — unchanged.
  dayCell: `calendar-day group relative min-h-[96px] lg:min-h-0 lg:aspect-square w-full ${paperTheme.radius.md} ${paperTheme.colors.borders.paper} bg-[radial-gradient(circle_at_20%_0%,#fff,rgba(255,255,255,0.92))] ${paperTheme.effects.shadow.sm}`,

  // Today highlight
  todayHighlight: 'ring-2 ring-amber-400 ring-offset-1',

  // Plan animation glow
  planGlow: 'animate-plan-glow',

  // Expense animation glow
  expenseGlow: 'animate-expense-glow',

  // Day cell torn edge
  dayTornEdge: `absolute inset-x-0 -top-1 h-3 ${paperTheme.effects.tornEdge}`,

  // Day number
  dayNumber: `text-lg lg:text-xl font-bold ${paperTheme.fonts.handwriting}`,

  // Today sticker
  todaySticker: 'absolute -top-1 -right-1 today-sticker',

  // Day stats
  dayStats: {
    container: 'mt-auto w-full flex justify-between',
    leftStats: 'text-left space-y-0.5',
    rightStats: 'text-left',
    label: 'text-[9px] sm:text-[8px] md:text-[9px] opacity-60 leading-none',
    spent: 'text-[12px] sm:text-[10px] md:text-[11px] font-bold mt-0.5 text-red-600',
    remaining: 'text-[12px] sm:text-[10px] md:text-[11px] font-bold mt-0.5 text-emerald-600',
    planned: 'text-[12px] sm:text-[10px] md:text-[11px] font-bold mt-0.5 text-blue-600',
  },

  // Hover add icon
  hoverIcon: 'absolute right-1.5 bottom-1.5 opacity-0 group-hover:opacity-100 transition-opacity',

  // Weekday header — only meaningful for the 7-column desktop grid; hidden on phones.
  weekdayHeader: `hidden lg:grid grid-cols-7 gap-0.5 xs:gap-1 sm:gap-2 px-1 text-center font-medium ${paperTheme.colors.text.muted}`,
  weekdayCell: 'py-0.5 xs:py-1 sm:py-1.5 text-xs xs:text-sm md:text-base',

  // Calendar grid — day-card flow on phones (3 across), 7-col on desktop.
  // Flows naturally (single page scroll); no inner scroll on phones.
  calendarGrid:
    'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-1.5 sm:gap-2 flex-1 content-start overflow-visible pb-2 lg:pb-0',
} as const;

