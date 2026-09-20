import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { TaskCategory } from "../../../../packages/shared/domain";
import { useAppTheme } from "../theme";

const CATEGORY_META: Record<TaskCategory, { label: string; emoji: string; color: string }> = {
  HEALTH: { label: "Saúde", emoji: "🩺", color: "#31C574" },
  STUDY: { label: "Estudos", emoji: "📚", color: "#3E7C97" },
  HOME: { label: "Casa", emoji: "🏠", color: "#F2A93B" },
  CREATIVITY: { label: "Criatividade", emoji: "🎨", color: "#7C4DFF" },
};

export function categoryLabel(category: TaskCategory): string {
  return CATEGORY_META[category].label;
}

export function CategoryTag({ category }: { category: TaskCategory }) {
  const theme = useAppTheme();
  const meta = CATEGORY_META[category];
  return (
    <View style={[styles.tag, { backgroundColor: `${meta.color}22`, borderRadius: theme.radius.pill }]}>
      <Text style={[styles.text, { color: meta.color }]}>
        {meta.emoji} {meta.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" },
  text: { fontSize: 12, fontWeight: "700" },
});
