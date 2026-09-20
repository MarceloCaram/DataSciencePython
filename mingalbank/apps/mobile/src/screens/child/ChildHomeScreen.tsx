import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { GAMIFICATION_DEFAULTS } from "../../../../../packages/shared/domain";
import { BadgeTierChip, Card, ScreenContainer, SectionTitle, ScreenTitle, StreakBanner } from "../../components";
import { useAuth } from "../../state/auth";
import { useAppTheme } from "../../theme";

function nextTierProgress(points: number) {
  const { badgeThresholds } = GAMIFICATION_DEFAULTS;
  if (points < badgeThresholds.SILVER) {
    return { nextLabel: "Prata", remaining: badgeThresholds.SILVER - points, progress: points / badgeThresholds.SILVER };
  }
  if (points < badgeThresholds.GOLD) {
    return {
      nextLabel: "Ouro",
      remaining: badgeThresholds.GOLD - points,
      progress: (points - badgeThresholds.SILVER) / (badgeThresholds.GOLD - badgeThresholds.SILVER),
    };
  }
  return { nextLabel: null, remaining: 0, progress: 1 };
}

export function ChildHomeScreen() {
  const theme = useAppTheme();
  const { session, refreshChild } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const child = session?.role === "CHILD" ? session.child : null;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshChild();
    setRefreshing(false);
  }, [refreshChild]);

  if (!child) return null;

  const tierProgress = nextTierProgress(child.pointsBalance);

  return (
    <ScreenContainer onRefresh={onRefresh} refreshing={refreshing}>
      <ScreenTitle subtitle="Continue completando tarefas para ganhar mais!">Oi, {child.name}! 👋</ScreenTitle>

      <StreakBanner days={child.currentStreak} />

      <View style={{ height: 16 }} />

      <View style={styles.balanceRow}>
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceEmoji}>⭐</Text>
          <Text style={[styles.balanceValue, { color: theme.colors.textPrimary }]}>{child.pointsBalance}</Text>
          <Text style={{ color: theme.colors.textSecondary }}>pontos</Text>
        </Card>
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceEmoji}>💰</Text>
          <Text style={[styles.balanceValue, { color: theme.colors.textPrimary }]}>
            R$ {child.walletBalance.toFixed(2)}
          </Text>
          <Text style={{ color: theme.colors.textSecondary }}>carteira</Text>
        </Card>
      </View>

      <SectionTitle>Seu nível</SectionTitle>
      <Card>
        <BadgeTierChip tier={child.badgeTier} />
        {tierProgress.nextLabel ? (
          <>
            <View style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceAlt, marginTop: 14 }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, Math.max(4, tierProgress.progress * 100))}%`, backgroundColor: theme.colors.primary },
                ]}
              />
            </View>
            <Text style={{ color: theme.colors.textSecondary, marginTop: 8 }}>
              Faltam {tierProgress.remaining} pontos para o nível {tierProgress.nextLabel}!
            </Text>
          </>
        ) : (
          <Text style={{ color: theme.colors.textSecondary, marginTop: 14 }}>
            Você chegou ao nível máximo! Você é um(a) verdadeiro(a) Mestre Capivara 🐹
          </Text>
        )}
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  balanceRow: { flexDirection: "row", gap: 12 },
  balanceCard: { flex: 1, alignItems: "center" },
  balanceEmoji: { fontSize: 28, marginBottom: 4 },
  balanceValue: { fontSize: 22, fontWeight: "800" },
  progressTrack: { height: 12, borderRadius: 6, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 6 },
});
