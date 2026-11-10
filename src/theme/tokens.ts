/**
 * Design tokens — single source of truth for colors.
 *
 * Consumed by tailwind.config.ts (as utility classes like `bg-canvas`, `border-line`,
 * `text-ink-muted`, `bg-gold`) and directly by Recharts, which needs raw hex values.
 * Components should never hard-code hex colors; add a token here instead.
 */

export const palette = {
  // Surfaces
  canvas: '#FBF9F5',      // page background (warm cream)
  surface: '#FFFFFF',     // cards
  surfaceHover: '#F5F2EB',
  line: '#ECE7DE',        // 1px hairline borders on cream

  // Text
  ink: '#0F172A',         // primary text (slate-900)
  inkMuted: '#64748B',    // secondary text, axis labels (slate-500)
  inkSubtle: '#94A3B8',   // captions, minor ticks (slate-400)

  // Brand
  primary: '#0D9488',     // teal-600
  primaryStrong: '#0F766E', // teal-700
  primaryDeep: '#042F2E', // selected bars
  primarySoft: '#2DD4BF', // in-progress month

  // Accents
  gold: '#E5A93C',
  goldStrong: '#D4982E',
  goldDeep: '#B87C1E',
  warning: '#F59E0B',     // averages / large amounts (amber-500)
  danger: '#E11D48',      // over budget (rose-600)
  compare: '#6366F1',     // comparison series, e.g. last month (indigo-500)

  // Dark sidebar
  night: '#111A18',
  nightRaised: '#182622',
  nightCard: '#14201D',
  nightLine: '#233530',

  // Chart chrome
  grid: '#F1F5F9',        // slate-100
  axis: '#E2E8F0',        // slate-200
  hover: '#F8FAFC',       // slate-50
} as const;

/**
 * Category colors (chart fills and legend dots). Validated with the dataviz palette checker in the
 * fixed stack order below (生活 → 雜支): lightness band, chroma floor, adjacent CVD separation, 3:1 contrast.
 */
export const categoryColors: Record<string, string> = {
  '生活': '#0D9488', // teal-600
  '家用': '#2563EB', // blue-600
  '社交': '#EC4899', // pink-500
  '娛樂': '#D97706', // amber-600 (amber-500 failed 3:1 contrast on white)
  '雜支': '#4A3AA7', // deep violet (slate read as gray and failed the chroma floor)
};

export const categoryFallback = palette.inkSubtle;

export const categoryColor = (category: string): string =>
  categoryColors[category] ?? categoryFallback;

/** Darker category hues for small text on white or on the tint below (≥4.5:1). */
export const categoryTextColors: Record<string, string> = {
  '生活': '#0F766E', // teal-700
  '家用': '#1D4ED8', // blue-700
  '社交': '#BE185D', // pink-700
  '娛樂': '#B45309', // amber-700
  '雜支': '#4A3AA7',
};

export const categoryTextColor = (category: string): string =>
  categoryTextColors[category] ?? palette.inkMuted;

/** Category color at 10% opacity — icon chips and tag backgrounds. */
export const categoryTint = (category: string): string => `${categoryColor(category)}1A`;

/**
 * Calendar heat scale (sequential, one hue, light → dark). Index = heat level 1–5;
 * text colors keep ≥4.5:1 contrast on each step (white only on the two darkest).
 */
export const heatScale: { bg: string; fg: string }[] = [
  { bg: '#F8FAFC', fg: '#64748B' }, // 0: nothing spent
  { bg: '#CCFBF1', fg: '#134E4A' },
  { bg: '#99F6E4', fg: '#134E4A' },
  { bg: '#2DD4BF', fg: '#0F172A' },
  { bg: '#0F766E', fg: '#FFFFFF' },
  { bg: '#134E4A', fg: '#FFFFFF' },
];

/** Lighter category hues for dark surfaces (e.g. the review hero card on palette.night). */
export const categoryColorsOnDark: Record<string, string> = {
  '生活': '#2DD4BF',
  '家用': '#60A5FA',
  '社交': '#F472B6',
  '娛樂': '#FBBF24',
  '雜支': '#A78BFA',
};
