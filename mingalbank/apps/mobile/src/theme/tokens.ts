/**
 * Tokens compartilhados entre o tema "pai" (sóbrio) e o tema "filho" (lúdico).
 * Mantém espaçamento, raio de borda e escala tipográfica consistentes em todo
 * o app — só a paleta de cores e alguns pesos de fonte mudam por modo.
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 26,
  xxl: 34,
} as const;

export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type FontSize = typeof fontSize;
