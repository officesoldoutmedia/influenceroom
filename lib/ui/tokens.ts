// Design tokens for Influence Room.
// See docs/DESIGN-SYSTEM.md for the rationale.
//
// These are TypeScript constants; for Tailwind 4 the same values are mirrored
// in app/globals.css under @theme so utility classes can reference them.

export const tokens = {
  color: {
    brand: {
      50: '#FFF7ED',
      100: '#FFEDD5',
      200: '#FED7AA',
      300: '#FDBA74',
      400: '#FB923C',
      500: '#F97316',
      600: '#EA580C',
      700: '#C2410C', // canonical brand
      800: '#9A3412',
      900: '#7C2D12',
    },
    neutral: {
      50: '#FAFAF9',
      100: '#F5F5F4',
      200: '#E7E5E4',
      300: '#D6D3D1',
      400: '#A8A29E',
      500: '#78716C',
      600: '#57534E',
      700: '#44403C',
      800: '#292524',
      900: '#1C1917',
      950: '#0C0A09',
    },
    success: { 50: '#ECFDF5', 500: '#10B981', 700: '#047857' },
    warning: { 50: '#FFFBEB', 500: '#F59E0B', 700: '#B45309' },
    error: { 50: '#FFF1F2', 500: '#F43F5E', 700: '#BE123C' },
    info: { 50: '#F0F9FF', 500: '#0EA5E9', 700: '#0369A1' },
  },

  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    '2xl': '24px',
    full: '9999px',
  },

  shadow: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
    md: '0 2px 6px -1px rgb(0 0 0 / 0.06), 0 1px 3px -1px rgb(0 0 0 / 0.04)',
    lg: '0 8px 24px -4px rgb(0 0 0 / 0.10), 0 4px 10px -4px rgb(0 0 0 / 0.06)',
    xl: '0 16px 40px -8px rgb(0 0 0 / 0.14), 0 6px 16px -6px rgb(0 0 0 / 0.08)',
  },

  // Tailwind utility class fragments — used inside components so we keep
  // a single source of truth even though Tailwind classes are strings.
  cls: {
    focusRing:
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
    cardBase:
      'bg-white border border-stone-200 rounded-xl shadow-[0_1px_2px_0_rgb(0_0_0_/_0.04)]',
    inputBase:
      'w-full px-3 py-2 border border-stone-300 rounded-md text-[15px] bg-white text-stone-900 placeholder:text-stone-400 transition-colors duration-150 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-stone-50 disabled:text-stone-400',
  },
} as const

export type Tokens = typeof tokens
