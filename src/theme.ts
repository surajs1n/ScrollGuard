// ScrollGuard V2 design tokens — companion-era redesign.
// Colors derived from oklch source (theme.css) via accurate sRGB conversion.

export const SG = {
  // Canvas — warm near-black, layered surfaces.
  bg:           '#0E1017',
  bg2:          '#131620',
  surface:      '#181B23',
  surface2:     '#1E212C',
  surfaceElev:  '#232737',
  line:         '#2D3242',
  lineSoft:     '#1D2130',

  // Text — warm off-white, never pure white. fg matches shield stroke.
  fg:           '#F4F1EA',
  fg2:          '#ACB2C4',
  fg3:          '#7D8398',
  fg4:          '#545B70',

  // Profile accents — same chroma/lightness, only hue varies.
  balanced:     '#6E66F0',
  balancedSoft: 'rgba(110,102,240,0.14)',
  balancedLine: 'rgba(110,102,240,0.35)',

  gentle:       '#2EB789',
  gentleSoft:   'rgba(46,183,137,0.13)',
  gentleLine:   'rgba(46,183,137,0.35)',

  strict:       '#E25E48',
  strictSoft:   'rgba(226,94,72,0.13)',
  strictLine:   'rgba(226,94,72,0.35)',

  // Amber — dev/testing callouts only.
  amber:        '#C9901E',
  amberSoft:    'rgba(201,144,30,0.12)',

  // Border radii.
  rSm: 10,
  rMd: 14,
  rLg: 20,
  rXl: 28,
} as const;

// Font family identifiers — must match keys in Font.useFonts.
export const SgFonts = {
  display:       'InstrumentSerif-Regular',
  displayItalic: 'InstrumentSerif-Italic',
  ui:            'Geist-Regular',
  uiMedium:      'Geist-Medium',
  uiSemiBold:    'Geist-SemiBold',
  mono:          'JetBrainsMono-Regular',
  monoMedium:    'JetBrainsMono-Medium',
} as const;

// Accent triplet keyed by intensity level.
export const ACCENT = {
  balanced: { accent: SG.balanced, soft: SG.balancedSoft, line: SG.balancedLine },
  gentle:   { accent: SG.gentle,   soft: SG.gentleSoft,   line: SG.gentleLine },
  strict:   { accent: SG.strict,   soft: SG.strictSoft,   line: SG.strictLine },
} as const;

// Legacy compat exports kept so any missed import site still compiles.
export const colors = {
  bg:            SG.bg,
  surface:       SG.surface,
  border:        SG.lineSoft,
  textPrimary:   SG.fg,
  textSecondary: SG.fg3,
  accent:        SG.balanced,
  accentLight:   SG.balanced,
  success:       SG.gentle,
  warning:       SG.amber,
  danger:        SG.strict,
};
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const font = { xs: 12, sm: 14, md: 16, lg: 20, xl: 24, xxl: 32 };
