import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { ApiError, familyApi } from "../../api/client";
import { Button, Card, ErrorBanner, LoadingBlock, ScreenContainer, SectionTitle, ScreenTitle } from "../../components";
import { useAuth } from "../../state/auth";
import { useAppTheme } from "../../theme";

const STEP = 0.1;
const MIN_MULTIPLIER = 1;
const MAX_MULTIPLIER = 3;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Ajustes de gamificação da família (PRD §4: multiplicador de fim de
 * semana "customizável"). Hoje só expõe o weekendMultiplier — outros
 * parâmetros (limiar/percentual do bônus de streak) seguem fixos em
 * GAMIFICATION_DEFAULTS até uma fase futura. */
export function FamilySettingsScreen() {
  const theme = useAppTheme();
  const { session } = useAuth();
  const token = session?.role === "PARENT" ? session.token : "";

  const [multiplier, setMultiplier] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const settings = await familyApi.getSettings(token);
      setMultiplier(settings.weekendMultiplier);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar os ajustes.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  async function save() {
    setSuccess(null);
    setError(null);
    setSaving(true);
    try {
      const updated = await familyApi.updateSettings(token, { weekendMultiplier: multiplier });
      setMultiplier(updated.weekendMultiplier);
      setSuccess("Ajustes salvos!");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar os ajustes.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingBlock />
      </ScreenContainer>
    );
  }

  const examplePoints = Math.round(10 * multiplier);

  return (
    <ScreenContainer>
      <ScreenTitle subtitle="Regras de gamificação da mesada">Ajustes da família</ScreenTitle>
      {error ? <ErrorBanner message={error} /> : null}
      {success ? (
        <View style={[styles.success, { backgroundColor: `${theme.colors.success}18`, borderColor: theme.colors.success }]}>
          <Text style={{ color: theme.colors.success, fontWeight: "700" }}>{success}</Text>
        </View>
      ) : null}

      <Card>
        <SectionTitle>Bônus de fim de semana</SectionTitle>
        <Text style={{ color: theme.colors.textSecondary, marginBottom: 14 }}>
          Multiplicador aplicado aos pontos de tarefas concluídas no sábado ou domingo.
        </Text>

        <View style={styles.stepperRow}>
          <TouchableOpacity
            style={[styles.stepperButton, { borderColor: theme.colors.border }]}
            onPress={() => setMultiplier((value) => Math.max(MIN_MULTIPLIER, round1(value - STEP)))}
          >
            <Text style={styles.stepperText}>−</Text>
          </TouchableOpacity>
          <Text style={[styles.multiplierValue, { color: theme.colors.textPrimary }]}>{multiplier.toFixed(1)}x</Text>
          <TouchableOpacity
            style={[styles.stepperButton, { borderColor: theme.colors.border }]}
            onPress={() => setMultiplier((value) => Math.min(MAX_MULTIPLIER, round1(value + STEP)))}
          >
            <Text style={styles.stepperText}>+</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ color: theme.colors.textSecondary, marginTop: 6 }}>
          Exemplo: uma tarefa de 10 pontos vale {examplePoints} pontos no fim de semana.
        </Text>

        <View style={{ height: 12 }} />
        <Button label="Salvar" onPress={save} loading={saving} />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperText: { fontSize: 22, fontWeight: "700" },
  multiplierValue: { fontSize: 24, fontWeight: "800", marginHorizontal: 24, minWidth: 64, textAlign: "center" },
  success: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
});
