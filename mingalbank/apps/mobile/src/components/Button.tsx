import React from "react";
import { ActivityIndicator, GestureResponderEvent, StyleSheet, Text, TouchableOpacity, ViewStyle } from "react-native";

import { useAppTheme } from "../theme";

type Variant = "primary" | "secondary" | "outline" | "danger" | "ghost";

interface ButtonProps {
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  size?: "md" | "lg";
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  fullWidth = true,
  style,
  size = "md",
}: ButtonProps) {
  const theme = useAppTheme();
  const isDisabled = disabled || loading;

  const backgroundColor = {
    primary: theme.colors.primary,
    secondary: theme.colors.secondary,
    danger: theme.colors.danger,
    outline: "transparent",
    ghost: "transparent",
  }[variant];

  const textColor = variant === "outline" || variant === "ghost" ? theme.colors.primary : theme.colors.onPrimary;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[
        styles.base,
        {
          backgroundColor,
          borderRadius: theme.playful ? theme.radius.pill : theme.radius.sm,
          borderWidth: variant === "outline" ? 2 : 0,
          borderColor: theme.colors.primary,
          paddingVertical: size === "lg" ? theme.spacing.lg : theme.spacing.md,
          opacity: isDisabled ? 0.55 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text
          style={[
            styles.label,
            {
              color: textColor,
              fontSize: size === "lg" ? theme.fontSize.lg : theme.fontSize.md,
              fontWeight: theme.playful ? "800" : "700",
            },
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  label: {
    textAlign: "center",
  },
});
