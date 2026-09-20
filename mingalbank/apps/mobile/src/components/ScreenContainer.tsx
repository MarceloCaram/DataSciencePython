import React from "react";
import { RefreshControl, ScrollView, StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppTheme } from "../theme";

interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  style?: ViewStyle;
}

/** Container de tela padrão: respeita safe area, aplica o fundo do tema
 * atual (pai/filho/neutro) e opcionalmente vira scroll-to-refresh. */
export function ScreenContainer({ children, scroll = true, onRefresh, refreshing, style }: ScreenContainerProps) {
  const theme = useAppTheme();

  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { padding: theme.spacing.lg }, style]}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, { padding: theme.spacing.lg }, style]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={["top", "left", "right"]}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 48 },
});
