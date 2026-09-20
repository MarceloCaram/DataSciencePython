import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { Task } from "../../../../../packages/shared/domain";
import { ApiError, tasksApi } from "../../api/client";
import { CategoryTag, Card, EmptyState, ErrorBanner, LoadingBlock, ScreenContainer, ScreenTitle } from "../../components";
import type { ChildTasksStackParamList } from "../../navigation/types";
import { useAuth } from "../../state/auth";
import { useTaskSubmissions } from "../../state/taskSubmissions";
import { useAppTheme } from "../../theme";

function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function TaskListScreen() {
  const theme = useAppTheme();
  const { session } = useAuth();
  const { submittedIds } = useTaskSubmissions();
  const navigation = useNavigation<NativeStackNavigationProp<ChildTasksStackParamList, "TaskList">>();

  const child = session?.role === "CHILD" ? session.child : null;
  const token = session?.role === "CHILD" ? session.token : "";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!child) return;
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        setTasks(await tasksApi.list(token, { childId: child.id }));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Não foi possível carregar as tarefas.");
      } finally {
        isRefresh ? setRefreshing(false) : setLoading(false);
      }
    },
    [token, child]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingBlock />
      </ScreenContainer>
    );
  }

  const pending = tasks.filter((task) => !submittedIds.has(task.id));
  const submitted = tasks.filter((task) => submittedIds.has(task.id));

  return (
    <ScreenContainer onRefresh={() => load(true)} refreshing={refreshing}>
      <ScreenTitle subtitle="Complete e ganhe pontos!">Minhas tarefas</ScreenTitle>
      {error ? <ErrorBanner message={error} /> : null}

      {pending.length === 0 && submitted.length === 0 ? (
        <EmptyState label="Nenhuma tarefa disponível por enquanto. Volte mais tarde! 🎉" />
      ) : null}

      {pending.map((task) => (
        <TouchableOpacity key={task.id} activeOpacity={0.8} onPress={() => navigation.navigate("TaskDetail", { taskId: task.id })}>
          <Card style={styles.card}>
            <View style={styles.row}>
              <View style={styles.info}>
                <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{task.title}</Text>
                <CategoryTag category={task.category} />
              </View>
              <View style={styles.pointsWrap}>
                <Text style={[styles.points, { color: theme.colors.primary }]}>⭐ {task.points}</Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>até {formatDueDate(task.dueDate)}</Text>
              </View>
            </View>
          </Card>
        </TouchableOpacity>
      ))}

      {submitted.length > 0 ? (
        <>
          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Aguardando aprovação</Text>
          {submitted.map((task) => (
            <Card key={task.id} style={[styles.card, styles.submittedCard]}>
              <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{task.title}</Text>
              <Text style={{ color: theme.colors.textSecondary }}>⏳ Enviada para seu responsável aprovar</Text>
            </Card>
          ))}
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {},
  submittedCard: { opacity: 0.7 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  info: { flex: 1, marginRight: 12 },
  title: { fontSize: 16, fontWeight: "800", marginBottom: 6 },
  pointsWrap: { alignItems: "flex-end" },
  points: { fontSize: 16, fontWeight: "800" },
  sectionLabel: { fontWeight: "800", marginTop: 8, marginBottom: 10 },
});
