import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { Reward } from "../../../../../packages/shared/domain";
import { ApiError, rewardsApi } from "../../api/client";
import { Button, Card, EmptyState, ErrorBanner, LoadingBlock, ScreenContainer, ScreenTitle } from "../../components";
import { useAuth } from "../../state/auth";
import { useAppTheme } from "../../theme";

export function RewardsScreen() {
  const theme = useAppTheme();
  const { session, refreshChild } = useAuth();
  const child = session?.role === "CHILD" ? session.child : null;
  const token = session?.role === "CHILD" ? session.token : "";

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        setRewards(await rewardsApi.list(token));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Não foi possível carregar as recompensas.");
      } finally {
        isRefresh ? setRefreshing(false) : setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function claim(reward: Reward) {
    setClaimingId(reward.id);
    setError(null);
    setSuccess(null);
    try {
      await rewardsApi.claim(token, reward.id);
      await refreshChild();
      setSuccess(`"${reward.title}" resgatada! 🎉`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível resgatar essa recompensa.");
    } finally {
      setClaimingId(null);
    }
  }

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingBlock />
      </ScreenContainer>
    );
  }

  const pointsBalance = child?.pointsBalance ?? 0;

  return (
    <ScreenContainer onRefresh={() => load(true)} refreshing={refreshing}>
      <ScreenTitle subtitle={`Você tem ⭐ ${pointsBalance} pontos para gastar`}>Recompensas</ScreenTitle>
      {error ? <ErrorBanner message={error} /> : null}
      {success ? (
        <View style={[styles.success, { backgroundColor: `${theme.colors.success}18`, borderColor: theme.colors.success }]}>
          <Text style={{ color: theme.colors.success, fontWeight: "700" }}>{success}</Text>
        </View>
      ) : null}

      {rewards.length === 0 ? (
        <EmptyState label="Seus responsáveis ainda não cadastraram recompensas." />
      ) : (
        rewards.map((reward) => {
          const canClaim = pointsBalance >= reward.pointsCost;
          return (
            <Card key={reward.id} style={styles.card}>
              <Text style={styles.rewardEmoji}>{reward.type === "CASH" ? "💵" : "🎁"}</Text>
              <View style={styles.info}>
                <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{reward.title}</Text>
                <Text style={{ color: theme.colors.textSecondary }}>
                  {reward.pointsCost} pts{reward.cashValue ? ` · R$ ${reward.cashValue.toFixed(2)}` : ""}
                </Text>
              </View>
              <Button
                label={canClaim ? "Resgatar" : "Faltam pts"}
                onPress={() => claim(reward)}
                disabled={!canClaim}
                loading={claimingId === reward.id}
                fullWidth={false}
                style={styles.claimButton}
              />
            </Card>
          );
        })
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center" },
  rewardEmoji: { fontSize: 30, marginRight: 12 },
  info: { flex: 1, marginRight: 12 },
  title: { fontSize: 16, fontWeight: "800", marginBottom: 2 },
  claimButton: { minWidth: 100 },
  success: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
});
