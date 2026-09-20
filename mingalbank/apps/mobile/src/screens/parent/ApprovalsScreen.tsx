import React, { useCallback, useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { ApiError, dashboardApi, tasksApi } from "../../api/client";
import type { PendingApproval } from "../../api/types";
import { Button, Card, EmptyState, ErrorBanner, LoadingBlock, ScreenContainer, ScreenTitle } from "../../components";
import { useAuth } from "../../state/auth";
import { useAppTheme } from "../../theme";

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function ApprovalsScreen() {
  const theme = useAppTheme();
  const { session } = useAuth();
  const token = session?.role === "PARENT" ? session.token : "";

  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        const overview = await dashboardApi.get(token);
        setApprovals(overview.pendingTaskApprovals);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Não foi possível carregar as aprovações.");
      } finally {
        isRefresh ? setRefreshing(false) : setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  async function review(item: PendingApproval, approve: boolean) {
    setBusyId(item.id);
    setError(null);
    try {
      await tasksApi.review(token, item.taskId, item.id, approve);
      setApprovals((current) => current.filter((entry) => entry.id !== item.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível revisar essa tarefa.");
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
      <ScreenTitle subtitle="Valide as evidências antes de creditar os pontos">Aprovações</ScreenTitle>
      {error ? <ErrorBanner message={error} /> : null}

      {approvals.length === 0 ? (
        <EmptyState label="Nenhuma tarefa aguardando aprovação no momento." />
      ) : (
        approvals.map((item) => (
          <Card key={item.id}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{item.taskTitle}</Text>
            <Text style={{ color: theme.colors.textSecondary, marginBottom: 8 }}>
              {item.childName} · {item.points} pts · concluído em {formatDateTime(item.completedAt)}
            </Text>
            {item.evidenceUrl ? (
              <Image source={{ uri: item.evidenceUrl }} style={styles.evidence} resizeMode="cover" />
            ) : (
              <View style={[styles.noEvidence, { borderColor: theme.colors.border }]}>
                <Text style={{ color: theme.colors.textSecondary }}>Sem foto de evidência</Text>
              </View>
            )}
            <View style={styles.actionsRow}>
              <Button
                label="Rejeitar"
                variant="outline"
                onPress={() => review(item, false)}
                loading={busyId === item.id}
                fullWidth={false}
                style={styles.actionButton}
              />
              <Button
                label="Aprovar"
                onPress={() => review(item, true)}
                loading={busyId === item.id}
                fullWidth={false}
                style={styles.actionButton}
              />
            </View>
          </Card>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: "800" },
  evidence: { width: "100%", height: 160, borderRadius: 12, marginBottom: 12 },
  noEvidence: {
    height: 60,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  actionsRow: { flexDirection: "row", gap: 10 },
  actionButton: { flex: 1 },
});
