/**
 * Paper Theme Design Tokens
 * Central place for all paper-themed styling variables
 */

export const paperTheme = {
  // Colors
  colors: {
    background: {
      paper: 'repeating-linear-gradient(0deg,#fbf6e9,#fbf6e9_28px,#f2e8cf_28px,#f2e8cf_29px)',
      cardGradient: 'bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50',
      sticker: 'bg-gradient-to-br from-orange-100 via-amber-100 to-yellow-100',
      beta: 'bg-gradient-to-br from-yellow-200 via-amber-200 to-orange-200',
      white: 'bg-white/70',
      whiteTransparent: 'bg-white/60',
    },
    borders: {
      paper: 'border-2 border-amber-300/70',
      amber: 'border border-amber-200',
      amberStrong: 'border-2 border-amber-200',
    },
    text: {
      primary: 'text-stone-900',
      secondary: 'text-stone-700',
      muted: 'text-stone-600',
      accent: 'text-amber-600',
    },
    interactive: {
      amber: 'bg-amber-200/80 hover:bg-amber-300/80 text-stone-900 border border-amber-300',
      red: 'bg-red-600 hover:bg-red-700 text-white',
      ghost: 'hover:bg-amber-100',
    }
  },

  // Typography
  fonts: {
    handwriting: '"Patrick Hand", "Comic Sans MS", "Dirham", cursive',
    system: '"Dirham", system-ui, sans-serif',
  },

  // Shadows and Effects
  effects: {
    paperTexture: 'bg-[radial-gradient(circle_at_1px_1px,rgba(139,69,19,0.3)_1px,transparent_0)] bg-[length:12px_12px]',
    paperTextureSmall: 'bg-[radial-gradient(circle_at_1px_1px,rgba(139,69,19,0.3)_1px,transparent_0)] bg-[length:8px_8px]',
    paperTextureLarge: 'bg-[radial-gradient(circle_at_1px_1px,rgba(139,69,19,0.3)_1px,transparent_0)] bg-[length:16px_16px]',
    yellowTape: 'bg-yellow-300/60 rounded-sm shadow-sm transform rotate-3',
    tornEdge: 'bg-[repeating-linear-gradient(90deg,#fcd34d,#fcd34d_8px,#fde68a_8px,#fde68a_16px)] rounded-t-2xl opacity-70',
    shadow: {
      sm: 'shadow-sm',
      md: 'shadow-md',
      lg: 'shadow-lg',
      xl: 'shadow-xl',
    }
  },

  // Spacing and Layout
  spacing: {
    padding: {
      card: 'p-6',
      compact: 'p-3',
      dialog: 'p-4',
    },
    margin: {
      section: 'mb-4',
      compact: 'mb-2',
    }
  },

  // Border Radius
  radius: {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
  },

  // Animations
  animations: {
    rotate: {
      slight: 'transform rotate-2 hover:rotate-0 transition-transform duration-300',
      reverse: 'transform -rotate-6 hover:-rotate-3 transition-transform duration-300',
      tape: 'transform rotate-3',
    },
    hover: 'hover:shadow-md transition-all duration-200',
    scale: 'hover:scale-105 transition-all duration-200',
  }
} as const;

// CSS-in-JS style strings for dynamic usage
export const paperStyles = {
  // Common paper card wrapper
  paperCard: `relative ${paperTheme.colors.background.cardGradient} ${paperTheme.colors.borders.paper} ${paperTheme.radius.lg} ${paperTheme.spacing.padding.card} ${paperTheme.effects.shadow.xl} overflow-hidden`,

  // Paper texture overlay
  paperTexture: `absolute inset-0 opacity-15 ${paperTheme.effects.paperTexture} ${paperTheme.radius.lg} pointer-events-none`,

  // Yellow tape effect
  yellowTape: `absolute -top-2 left-1/2 -translate-x-1/2 w-16 h-6 bg-yellow-300/60 rounded-sm shadow-sm transform rotate-3`,

  // Torn edge effect
  tornEdge: `absolute -top-1 left-4 right-4 h-3 ${paperTheme.effects.tornEdge}`,

  // Handwriting text
  handwriting: `${paperTheme.fonts.handwriting}`,

  // Common button styles
  primaryButton: `apple-button ${paperTheme.colors.interactive.amber} ${paperTheme.radius.md} ${paperTheme.effects.shadow.sm} cursor-pointer`,

  // Auth notification sticker container (fixed positioning)
  authSticker: `fixed right-2 top-32 z-20 w-48 sm:w-56`,

  // Auth sticker inner wrapper (background and effects)
  authStickerWrapper: `relative ${paperTheme.colors.background.sticker} ${paperTheme.colors.borders.paper} ${paperTheme.radius.lg} p-4 ${paperTheme.effects.shadow.lg} ${paperTheme.animations.rotate.slight} overflow-hidden`,

  // Auth sticker paper texture
  authStickerTexture: `absolute inset-0 opacity-15 ${paperTheme.effects.paperTexture} ${paperTheme.radius.lg} pointer-events-none`,

  // Auth sticker tape
  authStickerTape: `absolute -top-2 left-1/2 w-16 h-6 bg-yellow-300/60 rounded-sm shadow-sm transform -translate-x-1/2 rotate-3`,

  // Beta badge container (fixed positioning)
  betaBadge: `fixed left-4 top-24 z-20 hidden md:block`,

  // Beta badge inner wrapper (background and effects)
  betaBadgeWrapper: `relative ${paperTheme.colors.background.beta} ${paperTheme.colors.borders.paper} ${paperTheme.radius.lg} px-6 py-3 ${paperTheme.effects.shadow.lg} ${paperTheme.animations.rotate.reverse} overflow-hidden`,

  // Beta badge paper texture
  betaBadgeTexture: `absolute inset-0 opacity-20 ${paperTheme.effects.paperTextureLarge} ${paperTheme.radius.lg} pointer-events-none`,

  // Beta badge tape
  betaBadgeTape: `absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-4 bg-amber-100/80 rounded-sm shadow-sm border border-amber-300/50`,
} as const;