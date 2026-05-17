import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { MonitorService } from './modules/MonitorService';
import {
  INTENSITY_COLORS,
  IntensityLevel,
  DEFAULT_INTENSITY,
} from './config/intensityPresets';
import { colors as baseColors, spacing, font } from './theme';

export type AppColors = typeof baseColors;

interface ThemeContextValue {
  colors: AppColors;
  intensity: IntensityLevel;
  refreshTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: baseColors,
  intensity: DEFAULT_INTENSITY,
  refreshTheme: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [intensity, setIntensity] = useState<IntensityLevel>(DEFAULT_INTENSITY);

  const refreshTheme = useCallback(async () => {
    const lvl = await MonitorService.getIntensity();
    setIntensity(lvl);
  }, []);

  useEffect(() => { refreshTheme(); }, [refreshTheme]);

  const iColors = INTENSITY_COLORS[intensity];
  const themedColors: AppColors = {
    ...baseColors,
    bg:          iColors.bg,
    surface:     iColors.surface,
    border:      iColors.border,
    accent:      iColors.accent,
    accentLight: iColors.accentLight,
  };

  return (
    <ThemeContext.Provider value={{ colors: themedColors, intensity, refreshTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { spacing, font };
