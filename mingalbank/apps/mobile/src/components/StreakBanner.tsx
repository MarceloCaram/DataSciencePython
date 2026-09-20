import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../theme";

/** Destaque visual de streak, conforme PRD seção 4: "7 dias seguidos! 🔥". */
export function StreakBanner({ days }: { days: number }) {
  const theme = useAppTheme();

  if (days <= 0) {
    return (
      <View style={[styles.wrap, { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.lg }]}>
        <Text style={[styles.text, { color: theme.colors.textSecondary }]}>
          Complete uma tarefa hoje para começar sua sequência! 💪
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { backgroundColor: theme.colors.accent, borderRadius: theme.radius.lg }]}>
      <Text style={styles.fire}>🔥</Text>
      <Text style={[styles.text, { color: theme.colors.textPrimary }]}>
        {days} {days === 1 ? "dia seguido" : "dias seguidos"}!
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", padding: 14, gap: 8 },
  fire: { fontSize: 26 },
  text: { fontSize: 16, fontWeight: "800" },
});
