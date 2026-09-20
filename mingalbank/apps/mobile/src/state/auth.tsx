/**
 * Estado de autenticação global: token + usuário atual (papel PARENT/CHILD),
 * persistido entre aberturas do app.
 *
 * Decisão de storage: usamos `expo-secure-store` (Keychain no iOS / Keystore
 * no Android) em vez de AsyncStorage puro, porque aqui guardamos um JWT de
 * sessão — dado sensível o bastante (é a credencial de acesso à conta) para
 * justificar armazenamento criptografado nativo, ainda mais num app
 * financeiro infantil com requisitos de LGPD citados no PRD (seção 5). O
 * custo extra do SecureStore é irrelevante para um blob pequeno como esse.
 * Para o cache não sensível de "perfis de filhos conhecidos neste
 * aparelho" (usado só pra UX do seletor de login), usamos AsyncStorage —
 * ver src/state/knownProfiles.ts.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";

import type { Child, Family, Parent } from "../../../../packages/shared/domain";
import { authApi, childrenApi } from "../api/client";
import { rememberChildProfile } from "./knownProfiles";

const SESSION_KEY = "mingalbank.session";

export type AuthSession =
  | { role: "PARENT"; token: string; parent: Parent; family?: Family }
  | { role: "CHILD"; token: string; child: Child };

interface AuthContextValue {
  status: "loading" | "authenticated" | "unauthenticated";
  session: AuthSession | null;
  loginParent: (email: string, password: string) => Promise<void>;
  loginChild: (childId: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-busca o filho logado (usado após ações que mudam saldo/pontos). */
  refreshChild: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function persistSession(session: AuthSession | null): Promise<void> {
  try {
    if (session) {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
    } else {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }
  } catch {
    // Em ambientes sem Keychain/Keystore disponível (ex.: web/dev), a sessão
    // simplesmente não persiste entre reloads — não deve travar o app.
  }
}

async function loadSession(): Promise<AuthSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");

  useEffect(() => {
    let mounted = true;
    loadSession().then((restored) => {
      if (!mounted) return;
      setSession(restored);
      setStatus(restored ? "authenticated" : "unauthenticated");
    });
    return () => {
      mounted = false;
    };
  }, []);

  const loginParent = useCallback(async (email: string, password: string) => {
    const { token, parent } = await authApi.parentLogin(email, password);
    const next: AuthSession = { role: "PARENT", token, parent };
    setSession(next);
    setStatus("authenticated");
    await persistSession(next);

    // Aproveita o login para atualizar o cache de perfis de filhos usado
    // pela tela de login (ver src/state/knownProfiles.ts).
    try {
      const kids = await childrenApi.list(token);
      await Promise.all(
        kids.map((kid) => rememberChildProfile({ id: kid.id, name: kid.name, photoUrl: kid.photoUrl }))
      );
    } catch {
      // Best-effort — não bloqueia o login se isso falhar.
    }
  }, []);

  const loginChild = useCallback(async (childId: string, pin: string) => {
    const { token, child } = await authApi.childLogin(childId, pin);
    const next: AuthSession = { role: "CHILD", token, child };
    setSession(next);
    setStatus("authenticated");
    await persistSession(next);
    await rememberChildProfile({ id: child.id, name: child.name, photoUrl: child.photoUrl });
  }, []);

  const logout = useCallback(async () => {
    setSession(null);
    setStatus("unauthenticated");
    await persistSession(null);
  }, []);

  const refreshChild = useCallback(async () => {
    setSession((current) => {
      if (!current || current.role !== "CHILD") return current;
      childrenApi
        .get(current.token, current.child.id)
        .then((freshChild) => {
          const updated: AuthSession = { role: "CHILD", token: current.token, child: freshChild };
          setSession(updated);
          void persistSession(updated);
        })
        .catch(() => {
          // Mantém o estado local se a atualização falhar.
        });
      return current;
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, session, loginParent, loginChild, logout, refreshChild }),
    [status, session, loginParent, loginChild, logout, refreshChild]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa ser usado dentro de <AuthProvider>");
  return ctx;
}
