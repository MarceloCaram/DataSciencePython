import React from "react";
import { StyleSheet, View, ViewProps } from "react-native";

import { useAppTheme } from "../theme";

export function Card({ style, children, ...rest }: ViewProps) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.playful ? theme.radius.lg : theme.radius.md,
          borderColor: theme.colors.border,
          padding: theme.spacing.lg,
          marginBottom: theme.spacing.md,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
});
