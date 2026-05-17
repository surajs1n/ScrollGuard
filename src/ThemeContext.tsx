import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { MonitorService } from './modules/MonitorService';
import { IntensityLevel, DEFAULT_INTENSITY } from './config/intensityPresets';
import { ACCENT, SG, spacing, font } from './theme';

export interface AppColors {
  bg: string;
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentLight: string;
  success: string;
  warning: string;
  danger: string;
}

interface ThemeContextValue {
  colors: AppColors;
  intensity: IntensityLevel;
  accent: string;
  accentSoft: string;
  accentLine: string;
  refreshTheme: () => Promise<void>;
}

function makeColors(accent: string): AppColors {
  return {
    bg:            SG.bg,
    surface:       SG.surface,
    border:        SG.lineSoft,
    textPrimary:   SG.fg,
    textSecondary: SG.fg3,
    accent,
    accentLight:   accent,
    success:       SG.gentle,
    warning:       SG.amber,
    danger:        SG.strict,
  };
}

const defaultAccent = ACCENT[DEFAULT_INTENSITY];

const ThemeContext = createContext<ThemeContextValue>({
  colors:      makeColors(defaultAccent.accent),
  intensity:   DEFAULT_INTENSITY,
  accent:      defaultAccent.accent,
  accentSoft:  defaultAccent.soft,
  accentLine:  defaultAccent.line,
  refreshTheme: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [intensity, setIntensity] = useState<IntensityLevel>(DEFAULT_INTENSITY);

  const refreshTheme = useCallback(async () => {
    const lvl = await MonitorService.getIntensity();
    setIntensity(lvl);
  }, []);

  useEffect(() => { refreshTheme(); }, [refreshTheme]);

  const { accent, soft: accentSoft, line: accentLine } = ACCENT[intensity];

  return (
    <ThemeContext.Provider value={{
      colors:     makeColors(accent),
      intensity,
      accent,
      accentSoft,
      accentLine,
      refreshTheme,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { spacing, font };
