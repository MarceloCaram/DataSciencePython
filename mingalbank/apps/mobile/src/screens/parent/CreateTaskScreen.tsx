import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { Child, TaskCategory } from "../../../../../packages/shared/domain";
import { ApiError, childrenApi, tasksApi } from "../../api/client";
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  FormField,
  LoadingBlock,
  ScreenContainer,
  SectionTitle,
  ScreenTitle,
  SelectableChip,
} from "../../components";
import { categoryLabel } from "../../components/CategoryTag";
import { useAuth } from "../../state/auth";
import { useAppTheme } from "../../theme";

const CATEGORIES: TaskCategory[] = ["HEALTH", "STUDY", "HOME", "CREATIVITY"];

function isoInDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function CreateTaskScreen() {
  const theme = useAppTheme();
  const { session } = useAuth();
  const token = session?.role === "PARENT" ? session.token : "";

  const [children, setChildren] = useState<Child[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TaskCategory>("HOME");
  const [points, setPoints] = useState(5);
  const [childId, setChildId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState(isoInDays(0));

  const load = useCallback(async () => {
    setLoadingChildren(true);
    try {
      const list = await childrenApi.list(token);
      setChildren(list);
      setChildId((current) => current ?? list[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar os filhos.");
    } finally {
      setLoadingChildren(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  async function submit() {
    setSuccess(null);
    if (!title.trim() || !childId) {
      setError("Escolha um título e um filho para a tarefa.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await tasksApi.create(token, {
        childId,
        title: title.trim(),
        category,
        points,
        dueDate: new Date(dueDate).toISOString(),
      });
      setTitle("");
      setPoints(5);
      setSuccess("Tarefa criada com sucesso!");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível criar a tarefa.");
    } finally {
      setSaving(false);
    }
  }

  if (loadingChildren) {
    return (
      <ScreenContainer>
        <LoadingBlock />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenTitle subtitle="Templates, pontos e prazo para motivar seus filhos">Nova tarefa</ScreenTitle>
      {error ? <ErrorBanner message={error} /> : null}
      {success ? (
        <View style={[styles.success, { backgroundColor: `${theme.colors.success}18`, borderColor: theme.colors.success }]}>
          <Text style={{ color: theme.colors.success, fontWeight: "700" }}>{success}</Text>
        </View>
      ) : null}

      {children.length === 0 ? (
        <EmptyState label="Cadastre um filho antes de criar tarefas." />
      ) : (
        <Card>
          <FormField label="Título da tarefa" value={title} onChangeText={setTitle} placeholder="Ex.: Arrumar a cama" />

          <SectionTitle>Categoria</SectionTitle>
          <View style={styles.chipsRow}>
            {CATEGORIES.map((cat) => (
              <SelectableChip key={cat} label={categoryLabel(cat)} selected={category === cat} onPress={() => setCategory(cat)} />
            ))}
          </View>

          <SectionTitle>Filho destino</SectionTitle>
          <View style={styles.chipsRow}>
            {children.map((child) => (
              <SelectableChip key={child.id} label={child.name} selected={childId === child.id} onPress={() => setChildId(child.id)} />
            ))}
          </View>

          <SectionTitle>Pontos</SectionTitle>
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={[styles.stepperButton, { borderColor: theme.colors.border }]}
              onPress={() => setPoints((value) => Math.max(1, value - 1))}
            >
              <Text style={styles.stepperText}>−</Text>
            </TouchableOpacity>
            <Text style={[styles.pointsValue, { color: theme.colors.textPrimary }]}>{points} pts</Text>
            <TouchableOpacity
              style={[styles.stepperButton, { borderColor: theme.colors.border }]}
              onPress={() => setPoints((value) => Math.min(50, value + 1))}
            >
              <Text style={styles.stepperText}>+</Text>
            </TouchableOpacity>
          </View>

          <SectionTitle>Prazo</SectionTitle>
          <View style={styles.chipsRow}>
            <SelectableChip label="Hoje" selected={dueDate === isoInDays(0)} onPress={() => setDueDate(isoInDays(0))} />
            <SelectableChip label="Amanhã" selected={dueDate === isoInDays(1)} onPress={() => setDueDate(isoInDays(1))} />
            <SelectableChip label="Esta semana" selected={dueDate === isoInDays(6)} onPress={() => setDueDate(isoInDays(6))} />
          </View>

          <View style={{ height: 8 }} />
          <Button label="Criar tarefa" onPress={submit} loading={saving} />
        </Card>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  chipsRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
  stepperRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperText: { fontSize: 22, fontWeight: "700" },
  pointsValue: { fontSize: 18, fontWeight: "800", marginHorizontal: 20 },
  success: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
});
