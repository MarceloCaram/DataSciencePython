import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { TransactionType, WalletTransaction } from "../../../../../packages/shared/domain";
import { ApiError, walletApi } from "../../api/client";
import type { WalletSummary } from "../../api/types";
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
} from "../../components";
import { useAuth } from "../../state/auth";
import { useAppTheme } from "../../theme";

const TX_META: Record<TransactionType, { emoji: string; label: string; positive: boolean }> = {
  ALLOWANCE_CREDIT: { emoji: "🏦", label: "Mesada creditada", positive: true },
  TASK_REWARD: { emoji: "✅", label: "Recompensa de tarefa", positive: true },
  STREAK_BONUS: { emoji: "🔥", label: "Bônus de sequência", positive: true },
  REDEMPTION: { emoji: "💸", label: "Resgate de mesada", positive: false },
  REWARD_REDEMPTION: { emoji: "🎁", label: "Recompensa resgatada", positive: false },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function WalletScreen() {
  const theme = useAppTheme();
  const { session } = useAuth();
  const child = session?.role === "CHILD" ? session.child : null;
  const token = session?.role === "CHILD" ? session.token : "";

  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showRedeemForm, setShowRedeemForm] = useState(false);
  const [redeemPoints, setRedeemPoints] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!child) return;
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        const [summaryData, txData] = await Promise.all([
          walletApi.getSummary(token, child.id),
          walletApi.getTransactions(token, child.id),
        ]);
        setSummary(summaryData);
        setTransactions(txData);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Não foi possível carregar a carteira.");
      } finally {
        isRefresh ? setRefreshing(false) : setLoading(false);
      }
    },
    [token, child]
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function submitRedeem() {
    if (!child) return;
    const points = Number(redeemPoints);
    if (!points || points <= 0) {
      setError("Digite quantos pontos você quer resgatar.");
      return;
    }
    setRedeeming(true);
    setError(null);
    setSuccess(null);
    try {
      await walletApi.redeem(token, child.id, points);
      setSuccess("Pedido de resgate enviado! Aguarde a aprovação do seu responsável.");
      setRedeemPoints("");
      setShowRedeemForm(false);
      await load(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível solicitar o resgate.");
    } finally {
      setRedeeming(false);
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
      <ScreenTitle subtitle="Acompanhe seus ganhos e peça resgates">Minha carteira</ScreenTitle>
      {error ? <ErrorBanner message={error} /> : null}
      {success ? (
        <View style={[styles.success, { backgroundColor: `${theme.colors.success}18`, borderColor: theme.colors.success }]}>
          <Text style={{ color: theme.colors.success, fontWeight: "700" }}>{success}</Text>
        </View>
      ) : null}

      <Card style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryEmoji}>⭐</Text>
          <Text style={[styles.summaryValue, { color: theme.colors.textPrimary }]}>{summary?.pointsBalance ?? 0}</Text>
          <Text style={{ color: theme.colors.textSecondary }}>pontos</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryEmoji}>💰</Text>
          <Text style={[styles.summaryValue, { color: theme.colors.textPrimary }]}>
            R$ {(summary?.walletBalance ?? 0).toFixed(2)}
          </Text>
          <Text style={{ color: theme.colors.textSecondary }}>carteira</Text>
        </View>
      </Card>

      {showRedeemForm ? (
        <Card>
          <SectionTitle>Solicitar resgate</SectionTitle>
          <FormField
            label="Quantos pontos você quer resgatar?"
            value={redeemPoints}
            onChangeText={setRedeemPoints}
            keyboardType="number-pad"
            placeholder="Ex.: 100"
          />
          <Button label="Enviar pedido" onPress={submitRedeem} loading={redeeming} />
          <View style={{ height: 8 }} />
          <Button label="Cancelar" variant="ghost" onPress={() => setShowRedeemForm(false)} />
        </Card>
      ) : (
        <Button label="Solicitar resgate da mesada" onPress={() => setShowRedeemForm(true)} />
      )}

      <SectionTitle>Histórico</SectionTitle>
      {transactions.length === 0 ? (
        <EmptyState label="Nenhuma movimentação ainda." />
      ) : (
        transactions.map((tx) => {
          const meta = TX_META[tx.type];
          return (
            <Card key={tx.id} style={styles.txCard}>
              <Text style={styles.txEmoji}>{meta.emoji}</Text>
              <View style={styles.txInfo}>
                <Text style={[styles.txDescription, { color: theme.colors.textPrimary }]}>{tx.description}</Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>{formatDate(tx.createdAt)}</Text>
              </View>
              {typeof tx.points === "number" ? (
                <Text style={[styles.txAmount, { color: meta.positive ? theme.colors.success : theme.colors.danger }]}>
                  {tx.points > 0 ? "+" : ""}
                  {tx.points} pts
                </Text>
              ) : null}
            </Card>
          );
        })
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  summaryCard: { flexDirection: "row" },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryEmoji: { fontSize: 26, marginBottom: 4 },
  summaryValue: { fontSize: 20, fontWeight: "800" },
  success: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  txCard: { flexDirection: "row", alignItems: "center" },
  txEmoji: { fontSize: 22, marginRight: 12 },
  txInfo: { flex: 1 },
  txDescription: { fontWeight: "700" },
  txAmount: { fontWeight: "800" },
});
