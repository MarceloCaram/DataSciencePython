import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useAppTheme } from "../theme";

interface PinPadProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

/** Teclado numérico grande e amigável para crianças digitarem o PIN de 4
 * dígitos (fluxo do filho descrito no PRD, seção 8). */
export function PinPad({ value, onChange, length = 4, disabled }: PinPadProps) {
  const theme = useAppTheme();

  function press(key: string) {
    if (disabled) return;
    if (key === "back") {
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length >= length) return;
    onChange(value + key);
  }

  return (
    <View>
      <View style={styles.dots}>
        {Array.from({ length }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                borderColor: theme.colors.primary,
                backgroundColor: index < value.length ? theme.colors.primary : "transparent",
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.grid}>
        {KEYS.map((key, index) => {
          if (key === "") return <View key={`spacer-${index}`} style={styles.key} />;
          const isBack = key === "back";
          return (
            <TouchableOpacity
              key={key}
              accessibilityRole="button"
              accessibilityLabel={isBack ? "Apagar" : `Dígito ${key}`}
              style={[
                styles.key,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.playful ? theme.radius.lg : theme.radius.md,
                },
              ]}
              onPress={() => press(key)}
              activeOpacity={0.6}
            >
              <Text style={[styles.keyText, { color: theme.colors.textPrimary }]}>{isBack ? "⌫" : key}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: "row", justifyContent: "center", gap: 16, marginBottom: 24 },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 14 },
  key: {
    width: 78,
    height: 78,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  keyText: { fontSize: 28, fontWeight: "700" },
});
