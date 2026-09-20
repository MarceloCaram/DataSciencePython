import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { AllowancePeriod, Child } from "../../../../../packages/shared/domain";
import { ApiError, childrenApi } from "../../api/client";
import {
  Avatar,
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
import { useAuth } from "../../state/auth";
import { useAppTheme } from "../../theme";

const TRUST_LEVELS = [1, 2, 3, 4, 5];
const PERIODS: { value: AllowancePeriod; label: string }[] = [
  { value: "WEEKLY", label: "Semanal" },
  { value: "MONTHLY", label: "Mensal" },
];

export function ChildrenScreen() {
  const theme = useAppTheme();
  const { session } = useAuth();
  const token = session?.role === "PARENT" ? session.token : "";

  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [trustLevel, setTrustLevel] = useState(3);
  const [allowanceValue, setAllowanceValue] = useState("");
  const [allowancePeriod, setAllowancePeriod] = useState<AllowancePeriod>("MONTHLY");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setChildren(await childrenApi.list(token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar os filhos.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  function resetForm() {
    setName("");
    setBirthDate("");
    setTrustLevel(3);
    setAllowanceValue("");
    setAllowancePeriod("MONTHLY");
  }

  async function submit() {
    if (!name.trim() || !birthDate.trim() || !allowanceValue.trim()) {
      setError("Preencha nome, data de nascimento e valor da mesada.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await childrenApi.create(token, {
        name: name.trim(),
        birthDate: birthDate.trim(),
        trustLevel,
        allowanceValue: Number(allowanceValue.replace(",", ".")) || 0,
        allowancePeriod,
      });
      resetForm();
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível cadastrar o filho.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenContainer>
      <ScreenTitle subtitle="Cadastre e gerencie os perfis dos seus filhos">Filhos</ScreenTitle>
      {error ? <ErrorBanner message={error} /> : null}

      {loading ? (
        <LoadingBlock />
      ) : children.length ? (
        children.map((child) => (
          <Card key={child.id} style={styles.card}>
            <View style={styles.row}>
              <Avatar name={child.name} photoUrl={child.photoUrl} size={56} />
              <View style={styles.info}>
                <Text style={[styles.name, { color: theme.colors.textPrimary }]}>{child.name}</Text>
                <Text style={{ color: theme.colors.textSecondary }}>
                  Confiança {child.trustLevel}/5 · {child.allowancePeriod === "MONTHLY" ? "Mensal" : "Semanal"}: R${" "}
                  {child.allowanceValue.toFixed(2)}
                </Text>
                <Text style={{ color: theme.colors.textSecondary }}>
                  ⭐ {child.pointsBalance} pts · R$ {child.walletBalance.toFixed(2)} · 🔥 {child.currentStreak}
                </Text>
              </View>
            </View>
          </Card>
        ))
      ) : (
        <EmptyState label="Nenhum filho cadastrado ainda." />
      )}

      {showForm ? (
        <Card>
          <SectionTitle>Novo filho</SectionTitle>
          <FormField label="Nome" value={name} onChangeText={setName} placeholder="Nome da criança" />
          <FormField
            label="Data de nascimento"
            value={birthDate}
            onChangeText={setBirthDate}
            placeholder="AAAA-MM-DD"
            keyboardType="numbers-and-punctuation"
          />
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Nível de confiança</Text>
          <View style={styles.chipsRow}>
            {TRUST_LEVELS.map((level) => (
              <SelectableChip key={level} label={String(level)} selected={trustLevel === level} onPress={() => setTrustLevel(level)} />
            ))}
          </View>
          <FormField
            label="Valor da mesada (R$)"
            value={allowanceValue}
            onChangeText={setAllowanceValue}
            placeholder="100"
            keyboardType="decimal-pad"
          />
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Periodicidade</Text>
          <View style={styles.chipsRow}>
            {PERIODS.map((period) => (
              <SelectableChip
                key={period.value}
                label={period.label}
                selected={allowancePeriod === period.value}
                onPress={() => setAllowancePeriod(period.value)}
              />
            ))}
          </View>
          <Button label="Salvar" onPress={submit} loading={saving} />
          <View style={{ height: 8 }} />
          <Button label="Cancelar" variant="ghost" onPress={() => setShowForm(false)} />
        </Card>
      ) : (
        <Button label="+ Adicionar filho" onPress={() => setShowForm(true)} />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {},
  row: { flexDirection: "row", alignItems: "center" },
  info: { marginLeft: 12, flex: 1 },
  name: { fontSize: 16, fontWeight: "800", marginBottom: 2 },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
});
