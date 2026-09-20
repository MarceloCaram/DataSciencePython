/**
 * Duas paletas distintas para reforçar visualmente "quem está usando o app":
 * - `parentColors`: sóbria, azul/grafite, transmite controle e confiança.
 * - `childColors`: lúdica, quente e saturada, transmite jogo/recompensa.
 * `neutralColors` é usada na tela de login, antes de sabermos o papel do usuário.
 */

export interface ColorPalette {
  mode: "parent" | "child" | "neutral";
  background: string;
  surface: string;
  surfaceAlt: string;
  primary: string;
  primaryDark: string;
  onPrimary: string;
  secondary: string;
  accent: string;
  success: string;
  danger: string;
  warning: string;
  textPrimary: string;
  textSecondary: string;
  textOnDark: string;
  border: string;
  badgeBronze: string;
  badgeSilver: string;
  badgeGold: string;
}

export const parentColors: ColorPalette = {
  mode: "parent",
  background: "#F3F6F9",
  surface: "#FFFFFF",
  surfaceAlt: "#E9EEF3",
  primary: "#22506B",
  primaryDark: "#153847",
  onPrimary: "#FFFFFF",
  secondary: "#3E7C97",
  accent: "#F2A93B",
  success: "#2E8B57",
  danger: "#C0392B",
  warning: "#C9971F",
  textPrimary: "#1B2430",
  textSecondary: "#5B6B79",
  textOnDark: "#EAF2F6",
  border: "#DCE4EA",
  badgeBronze: "#B5793B",
  badgeSilver: "#8FA0AD",
  badgeGold: "#D8A93D",
};

export const childColors: ColorPalette = {
  mode: "child",
  background: "#FFF6E9",
  surface: "#FFFFFF",
  surfaceAlt: "#FFEACB",
  primary: "#FF7A45",
  primaryDark: "#E4602F",
  onPrimary: "#FFFFFF",
  secondary: "#7C4DFF",
  accent: "#FFC93C",
  success: "#31C574",
  danger: "#FF5C7A",
  warning: "#FFA63C",
  textPrimary: "#33223F",
  textSecondary: "#7A6685",
  textOnDark: "#FFF6E9",
  border: "#FFE1B8",
  badgeBronze: "#C97B3E",
  badgeSilver: "#9AA5B1",
  badgeGold: "#E5B94B",
};

export const neutralColors: ColorPalette = {
  mode: "neutral",
  background: "#101828",
  surface: "#182233",
  surfaceAlt: "#212D42",
  primary: "#7C4DFF",
  primaryDark: "#5A32D6",
  onPrimary: "#FFFFFF",
  secondary: "#3E7C97",
  accent: "#FFC93C",
  success: "#31C574",
  danger: "#FF5C7A",
  warning: "#FFA63C",
  textPrimary: "#F5F7FA",
  textSecondary: "#A9B4C4",
  textOnDark: "#F5F7FA",
  border: "#2B3750",
  badgeBronze: "#C97B3E",
  badgeSilver: "#9AA5B1",
  badgeGold: "#E5B94B",
};

export const badgeTierLabel: Record<"BRONZE" | "SILVER" | "GOLD", string> = {
  BRONZE: "Bronze",
  SILVER: "Prata",
  GOLD: "Ouro",
};
