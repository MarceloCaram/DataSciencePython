import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../theme";

export function ScreenTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ marginBottom: theme.spacing.lg }}>
      <Text style={[styles.title, { color: theme.colors.textPrimary, fontSize: theme.fontSize.xl }]}>{children}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const theme = useAppTheme();
  return (
    <Text style={[styles.section, { color: theme.colors.textPrimary, marginTop: theme.spacing.lg }]}>{children}</Text>
  );
}

export function EmptyState({ label }: { label: string }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.empty, { borderColor: theme.colors.border }]}>
      <Text style={{ color: theme.colors.textSecondary, textAlign: "center" }}>{label}</Text>
    </View>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.error, { backgroundColor: `${theme.colors.danger}18`, borderColor: theme.colors.danger }]}>
      <Text style={{ color: theme.colors.danger, fontWeight: "600" }}>{message}</Text>
    </View>
  );
}

export function LoadingBlock() {
  const theme = useAppTheme();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={theme.colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontWeight: "800" },
  subtitle: { marginTop: 4, fontSize: 14 },
  section: { fontWeight: "800", fontSize: 16, marginBottom: 10 },
  empty: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    marginTop: 8,
  },
  error: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  loading: { paddingVertical: 48, alignItems: "center" },
});
