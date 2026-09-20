import React, { createContext, useContext, useMemo } from "react";

import { fontSize, radius, spacing } from "./tokens";
import { ColorPalette, childColors, neutralColors, parentColors } from "./palettes";

export type ThemeMode = "parent" | "child" | "neutral";

export interface AppTheme {
  mode: ThemeMode;
  colors: ColorPalette;
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
  /** Filhos usam pesos de fonte mais fortes e cantos mais arredondados. */
  playful: boolean;
}

function buildTheme(mode: ThemeMode): AppTheme {
  const colors =
    mode === "parent" ? parentColors : mode === "child" ? childColors : neutralColors;
  return {
    mode,
    colors,
    spacing,
    radius,
    fontSize,
    playful: mode === "child",
  };
}

const ThemeContext = createContext<AppTheme>(buildTheme("neutral"));

export function ThemeProvider({
  mode,
  children,
}: {
  mode: ThemeMode;
  children: React.ReactNode;
}) {
  const theme = useMemo(() => buildTheme(mode), [mode]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): AppTheme {
  return useContext(ThemeContext);
}
