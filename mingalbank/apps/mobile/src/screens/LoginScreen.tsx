import React, { useCallback, useEffect, useState } from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";

import { Avatar, Button, Card, ErrorBanner, FormField, LoadingBlock, ScreenContainer } from "../components";
import { ApiError } from "../api/client";
import { getChildLoginProfiles, KnownChildProfile } from "../state/knownProfiles";
import { PinPad } from "../components/PinPad";
import { useAuth } from "../state/auth";
import { ThemeProvider, useAppTheme } from "../theme";

type LoginView = "select" | "parentForm" | "childPicker" | "childPin";

function LoginScreenInner() {
  const theme = useAppTheme();
  const { loginParent, loginChild } = useAuth();

  const [view, setView] = useState<LoginView>("select");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("pai@mingalbank.com");
  const [password, setPassword] = useState("mingal123");

  const [profiles, setProfiles] = useState<KnownChildProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [selectedChild, setSelectedChild] = useState<KnownChildProfile | null>(null);
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (view !== "childPicker") return;
    setProfilesLoading(true);
    getChildLoginProfiles()
      .then(setProfiles)
      .catch(() => setProfiles([]))
      .finally(() => setProfilesLoading(false));
  }, [view]);

  const submitParent = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await loginParent(email.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [email, password, loginParent]);

  const submitChildPin = useCallback(
    async (candidatePin: string) => {
      if (!selectedChild) return;
      setError(null);
      setLoading(true);
      try {
        await loginChild(selectedChild.id, candidatePin);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Não foi possível entrar. Tente novamente.");
        setPin("");
      } finally {
        setLoading(false);
      }
    },
    [selectedChild, loginChild]
  );

  function handlePinChange(next: string) {
    setPin(next);
    if (next.length === 4) {
      void submitChildPin(next);
    }
  }

  if (view === "select") {
    return (
      <ScreenContainer scroll={false}>
        <View style={styles.brandWrap}>
          <Text style={styles.brandEmoji}>🐹</Text>
          <Text style={[styles.brandTitle, { color: theme.colors.textPrimary }]}>MingalBank</Text>
          <Text style={[styles.brandSubtitle, { color: theme.colors.textSecondary }]}>
            Mesada gamificada para a família
          </Text>
        </View>

        <TouchableOpacity onPress={() => setView("parentForm")} activeOpacity={0.85}>
          <Card style={styles.optionCard}>
            <Text style={styles.optionEmoji}>👨‍👩‍👧</Text>
            <View style={styles.optionTextWrap}>
              <Text style={[styles.optionTitle, { color: theme.colors.textPrimary }]}>Sou responsável</Text>
              <Text style={{ color: theme.colors.textSecondary }}>Entrar com e-mail e senha</Text>
            </View>
          </Card>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setView("childPicker")} activeOpacity={0.85}>
          <Card style={styles.optionCard}>
            <Text style={styles.optionEmoji}>🧒</Text>
            <View style={styles.optionTextWrap}>
              <Text style={[styles.optionTitle, { color: theme.colors.textPrimary }]}>Sou filho(a)</Text>
              <Text style={{ color: theme.colors.textSecondary }}>Escolher meu perfil e digitar meu PIN</Text>
            </View>
          </Card>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  if (view === "parentForm") {
    return (
      <ScreenContainer>
        <Text style={[styles.formTitle, { color: theme.colors.textPrimary }]}>Login do responsável</Text>
        {error ? <ErrorBanner message={error} /> : null}
        <FormField label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="voce@familia.com" />
        <FormField label="Senha" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
        <Button label="Entrar" onPress={submitParent} loading={loading} />
        <View style={{ height: 12 }} />
        <Button label="Voltar" variant="ghost" onPress={() => setView("select")} />
        <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
          Demo: pai@mingalbank.com / mingal123 (funciona mesmo sem backend rodando)
        </Text>
      </ScreenContainer>
    );
  }

  if (view === "childPicker") {
    return (
      <ScreenContainer>
        <Text style={[styles.formTitle, { color: theme.colors.textPrimary }]}>Quem é você?</Text>
        {profilesLoading ? (
          <LoadingBlock />
        ) : (
          <View style={styles.profileGrid}>
            {profiles.map((profile) => (
              <TouchableOpacity
                key={profile.id}
                style={styles.profileItem}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedChild(profile);
                  setPin("");
                  setError(null);
                  setView("childPin");
                }}
              >
                <Avatar name={profile.name} photoUrl={profile.photoUrl} size={84} />
                <Text style={[styles.profileName, { color: theme.colors.textPrimary }]}>{profile.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={{ height: 12 }} />
        <Button label="Voltar" variant="ghost" onPress={() => setView("select")} />
      </ScreenContainer>
    );
  }

  // view === "childPin"
  return (
    <ScreenContainer scroll={false}>
      <View style={styles.pinHeader}>
        <Avatar name={selectedChild?.name ?? "?"} photoUrl={selectedChild?.photoUrl} size={72} />
        <Text style={[styles.formTitle, { color: theme.colors.textPrimary, marginTop: 12 }]}>
          Oi, {selectedChild?.name}!
        </Text>
        <Text style={{ color: theme.colors.textSecondary }}>Digite seu PIN de 4 dígitos</Text>
      </View>
      {error ? <ErrorBanner message={error} /> : null}
      <PinPad value={pin} onChange={handlePinChange} disabled={loading} />
      <View style={{ height: 20 }} />
      <Button
        label="Trocar de perfil"
        variant="ghost"
        onPress={() => {
          setSelectedChild(null);
          setView("childPicker");
        }}
      />
    </ScreenContainer>
  );
}

/** A tela de login roda no tema neutro — ainda não sabemos se quem está
 * entrando é responsável ou filho(a). */
export function LoginScreen() {
  return (
    <ThemeProvider mode="neutral">
      <LoginScreenInner />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  brandWrap: { alignItems: "center", marginTop: 32, marginBottom: 40 },
  brandEmoji: { fontSize: 56 },
  brandTitle: { fontSize: 32, fontWeight: "800", marginTop: 8 },
  brandSubtitle: { fontSize: 15, marginTop: 4 },
  optionCard: { flexDirection: "row", alignItems: "center" },
  optionEmoji: { fontSize: 36, marginRight: 16 },
  optionTextWrap: { flex: 1 },
  optionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 2 },
  formTitle: { fontSize: 22, fontWeight: "800", marginBottom: 16 },
  hint: { marginTop: 16, fontSize: 12, textAlign: "center" },
  profileGrid: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  profileItem: { alignItems: "center", width: 96 },
  profileName: { marginTop: 8, fontWeight: "700" },
  pinHeader: { alignItems: "center", marginTop: 24, marginBottom: 32 },
});
