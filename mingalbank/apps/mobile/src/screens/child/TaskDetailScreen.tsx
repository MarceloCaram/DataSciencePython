import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { Task } from "../../../../../packages/shared/domain";
import { ApiError, tasksApi } from "../../api/client";
import { Button, CategoryTag, Card, ErrorBanner, LoadingBlock, ScreenContainer, ScreenTitle } from "../../components";
import type { ChildTasksStackParamList } from "../../navigation/types";
import { useAuth } from "../../state/auth";
import { useTaskSubmissions } from "../../state/taskSubmissions";
import { useAppTheme } from "../../theme";

export function TaskDetailScreen() {
  const theme = useAppTheme();
  const route = useRoute<RouteProp<ChildTasksStackParamList, "TaskDetail">>();
  const navigation = useNavigation<NativeStackNavigationProp<ChildTasksStackParamList, "TaskDetail">>();
  const { session } = useAuth();
  const { markSubmitted } = useTaskSubmissions();

  const child = session?.role === "CHILD" ? session.child : null;
  const token = session?.role === "CHILD" ? session.token : "";

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!child) return;
    setLoading(true);
    tasksApi
      .list(token, { childId: child.id })
      .then((tasks) => {
        setTask(tasks.find((entry) => entry.id === route.params.taskId) ?? null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Não foi possível carregar a tarefa."))
      .finally(() => setLoading(false));
  }, [child, token, route.params.taskId]);

  async function pickPhoto() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Precisamos de permissão para acessar suas fotos.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.6,
        allowsEditing: true,
      });
      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch {
      // Sem câmera/galeria disponível (ex.: web) — segue sem foto, é opcional.
      setError("Não foi possível abrir a galeria de fotos neste dispositivo.");
    }
  }

  async function complete() {
    if (!task) return;
    setSubmitting(true);
    setError(null);
    try {
      // Nota de escopo: o app envia a URI local como `evidenceUrl` — o
      // contrato de API (docs/API_CONTRACT.md) recebe uma URL de evidência,
      // mas o pipeline de upload de imagem para o backend/storage fica para
      // uma fase seguinte; aqui a foto serve para demonstrar o fluxo de UX.
      await tasksApi.complete(token, task.id, photoUri ?? undefined);
      markSubmitted(task.id);
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar a tarefa.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingBlock />
      </ScreenContainer>
    );
  }

  if (!task) {
    return (
      <ScreenContainer>
        <ErrorBanner message={error ?? "Tarefa não encontrada."} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenTitle>{task.title}</ScreenTitle>
      {error ? <ErrorBanner message={error} /> : null}

      <Card>
        <CategoryTag category={task.category} />
        <Text style={[styles.points, { color: theme.colors.primary }]}>⭐ {task.points} pontos</Text>
        <Text style={{ color: theme.colors.textSecondary }}>
          Prazo: {new Date(task.dueDate).toLocaleDateString("pt-BR")}
        </Text>
      </Card>

      <Card>
        <Text style={[styles.sectionLabel, { color: theme.colors.textPrimary }]}>Foto (opcional)</Text>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.preview} />
        ) : (
          <TouchableOpacity
            style={[styles.photoButton, { borderColor: theme.colors.border }]}
            onPress={pickPhoto}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 32 }}>📷</Text>
            <Text style={{ color: theme.colors.textSecondary, marginTop: 6 }}>Adicionar foto da tarefa</Text>
          </TouchableOpacity>
        )}
        {photoUri ? <Button label="Trocar foto" variant="ghost" onPress={pickPhoto} /> : null}
      </Card>

      <Button label="Marcar como concluída ✅" onPress={complete} loading={submitting} size="lg" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  points: { fontSize: 18, fontWeight: "800", marginTop: 10, marginBottom: 4 },
  sectionLabel: { fontWeight: "800", marginBottom: 10 },
  photoButton: {
    height: 140,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  preview: { width: "100%", height: 180, borderRadius: 14, marginBottom: 10 },
});
