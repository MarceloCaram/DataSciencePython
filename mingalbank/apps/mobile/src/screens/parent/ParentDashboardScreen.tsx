import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ApiError, dashboardApi, tasksApi, walletApi } from "../../api/client";
import type { DashboardOverview } from "../../api/types";
import { Avatar, Button, Card, EmptyState, ErrorBanner, LoadingBlock, ScreenContainer, SectionTitle, ScreenTitle } from "../../components";
import { useAuth } from "../../state/auth";
import { useAppTheme } from "../../theme";

export function ParentDashboardScreen() {
  const theme = useAppTheme();
  const { session } = useAuth();
  const token = session?.role === "PARENT" ? session.token : "";
  const parentName = session?.role === "PARENT" ? session.parent.name : "";

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        const data = await dashboardApi.get(token);
        setOverview(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Não foi possível carregar o dashboard.");
      } finally {
        isRefresh ? setRefreshing(false) : setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  async function reviewTask(taskId: string, completionId: string, approve: boolean) {
    setBusyId(completionId);
    try {
      await tasksApi.review(token, taskId, completionId, approve);
      await load(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível revisar a tarefa.");
    } finally {
      setBusyId(null);
    }
  }

  async function reviewRedemption(redemptionId: string, approve: boolean) {
    setBusyId(redemptionId);
    try {
      await walletApi.reviewRedemption(token, redemptionId, approve);
      await load(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível revisar o resgate.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingBlock />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer onRefresh={() => load(true)} refreshing={refreshing}>
      <ScreenTitle subtitle={overview?.family.name}>Olá, {parentName.split(" ")[0]} 👋</ScreenTitle>
      {error ? <ErrorBanner message={error} /> : null}

      <SectionTitle>Seus filhos</SectionTitle>
      {overview?.children.length ? (
        overview.children.map((child) => (
          <Card key={child.id} style={styles.childCard}>
            <Avatar name={child.name} photoUrl={child.photoUrl} size={52} />
            <View style={styles.childInfo}>
              <Text style={[styles.childName, { color: theme.colors.textPrimary }]}>{child.name}</Text>
              <Text style={{ color: theme.colors.textSecondary }}>
                ⭐ {child.pointsBalance} pts · R$ {child.walletBalance.toFixed(2)}
              </Text>
            </View>
            {child.currentStreak > 0 ? (
              <Text style={styles.streak}>🔥 {child.currentStreak}</Text>
            ) : null}
          </Card>
        ))
      ) : (
        <EmptyState label="Cadastre o primeiro filho na aba 'Filhos'." />
      )}

      <SectionTitle>Tarefas para aprovar</SectionTitle>
      {overview?.pendingTaskApprovals.length ? (
        overview.pendingTaskApprovals.map((item) => (
          <Card key={item.id}>
            <Text style={[styles.itemTitle, { color: theme.colors.textPrimary }]}>{item.taskTitle}</Text>
            <Text style={{ color: theme.colors.textSecondary, marginBottom: 10 }}>
              {item.childName} ·{" "}
              {item.effectivePoints > item.points
                ? `${item.effectivePoints} pts (base ${item.points} + bônus)`
                : `${item.points} pts`}
            </Text>
            <View style={styles.actionsRow}>
              <Button
                label="Rejeitar"
                variant="outline"
                onPress={() => reviewTask(item.taskId, item.id, false)}
                loading={busyId === item.id}
                fullWidth={false}
                style={styles.actionButton}
              />
              <Button
                label="Aprovar"
                onPress={() => reviewTask(item.taskId, item.id, true)}
                loading={busyId === item.id}
                fullWidth={false}
                style={styles.actionButton}
              />
            </View>
          </Card>
        ))
      ) : (
        <EmptyState label="Nenhuma tarefa aguardando aprovação." />
      )}

      <SectionTitle>Resgates pendentes</SectionTitle>
      {overview?.pendingRedemptions.length ? (
        overview.pendingRedemptions.map((item) => (
          <Card key={item.id}>
            <Text style={[styles.itemTitle, { color: theme.colors.textPrimary }]}>{item.childName}</Text>
            <Text style={{ color: theme.colors.textSecondary, marginBottom: 10 }}>
              Solicitou resgatar {item.amount} pontos
            </Text>
            <View style={styles.actionsRow}>
              <Button
                label="Rejeitar"
                variant="outline"
                onPress={() => reviewRedemption(item.id, false)}
                loading={busyId === item.id}
                fullWidth={false}
                style={styles.actionButton}
              />
              <Button
                label="Aprovar"
                onPress={() => reviewRedemption(item.id, true)}
                loading={busyId === item.id}
                fullWidth={false}
                style={styles.actionButton}
              />
            </View>
          </Card>
        ))
      ) : (
        <EmptyState label="Nenhum resgate pendente." />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  childCard: { flexDirection: "row", alignItems: "center" },
  childInfo: { flex: 1, marginLeft: 12 },
  childName: { fontSize: 16, fontWeight: "800" },
  streak: { fontSize: 16, fontWeight: "800" },
  itemTitle: { fontSize: 16, fontWeight: "800" },
  actionsRow: { flexDirection: "row", gap: 10 },
  actionButton: { flex: 1 },
});
