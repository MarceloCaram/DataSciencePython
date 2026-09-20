import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { BadgeTier } from "../../../../packages/shared/domain";
import { badgeTierLabel, useAppTheme } from "../theme";

const TIER_EMOJI: Record<BadgeTier, string> = { BRONZE: "🥉", SILVER: "🥈", GOLD: "🥇" };

export function BadgeTierChip({ tier }: { tier: BadgeTier }) {
  const theme = useAppTheme();
  const color =
    tier === "GOLD" ? theme.colors.badgeGold : tier === "SILVER" ? theme.colors.badgeSilver : theme.colors.badgeBronze;

  return (
    <View style={[styles.chip, { backgroundColor: color, borderRadius: theme.radius.pill }]}>
      <Text style={styles.text}>
        {TIER_EMOJI[tier]} Nível {badgeTierLabel[tier]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 6, alignSelf: "flex-start" },
  text: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
});
