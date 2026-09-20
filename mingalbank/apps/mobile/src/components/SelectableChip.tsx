import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

import { useAppTheme } from "../theme";

interface SelectableChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

/** Chip de seleção única/múltipla reutilizado em categoria de tarefa,
 * periodicidade de mesada, nível de confiança, filtros, etc. */
export function SelectableChip({ label, selected, onPress }: SelectableChipProps) {
  const theme = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.chip,
        {
          borderRadius: theme.radius.pill,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
        },
      ]}
    >
      <Text style={[styles.text, { color: selected ? theme.colors.onPrimary : theme.colors.textPrimary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1.5, marginRight: 8, marginBottom: 8 },
  text: { fontWeight: "700", fontSize: 13 },
});
