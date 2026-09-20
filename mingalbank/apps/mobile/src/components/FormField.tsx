import React from "react";
import { KeyboardTypeOptions, StyleSheet, Text, TextInput, View } from "react-native";

import { useAppTheme } from "../theme";

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = "sentences",
}: FormFieldProps) {
  const theme = useAppTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={[
          styles.input,
          {
            borderColor: theme.colors.border,
            borderRadius: theme.playful ? theme.radius.md : theme.radius.sm,
            color: theme.colors.textPrimary,
            backgroundColor: theme.colors.surface,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  input: { borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
});
