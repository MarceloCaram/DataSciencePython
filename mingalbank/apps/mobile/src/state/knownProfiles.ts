/**
 * Cache local (não sensível) dos perfis de filhos já vistos neste aparelho,
 * para alimentar a tela "Sou filho(a)" do login sem precisar de um token.
 *
 * Contexto/decisão de UX: o contrato de API não expõe uma rota pública para
 * listar filhos antes do login (children só é visível autenticado). Em apps
 * de mesada familiar o padrão comum é o celular/tablet ficar compartilhado
 * em casa — como perfis de streaming: um responsável faz login uma vez,
 * e a partir daí os filhos só selecionam o próprio avatar + PIN. Por isso
 * guardamos aqui só {id, name, photoUrl} (nada sensível) sempre que a lista
 * de filhos é carregada por um responsável autenticado, ou quando um filho
 * loga com sucesso.
 *
 * Usamos AsyncStorage (não SecureStore) de propósito: não é dado sensível,
 * é só uma conveniência de UI, então não precisa do overhead do
 * Keychain/Keystore. Ver README para a justificativa completa de storage.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "mingalbank.knownChildren";

export interface KnownChildProfile {
  id: string;
  name: string;
  photoUrl?: string;
}

export async function getKnownChildProfiles(): Promise<KnownChildProfile[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveKnownChildProfiles(profiles: KnownChildProfile[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    // Cache best-effort — falha silenciosa não deve travar a UI.
  }
}

export async function rememberChildProfile(profile: KnownChildProfile): Promise<void> {
  const existing = await getKnownChildProfiles();
  const next = [profile, ...existing.filter((entry) => entry.id !== profile.id)];
  await saveKnownChildProfiles(next);
}

/**
 * Perfis para a tela de login do filho: usa o cache deste aparelho e, se
 * ainda estiver vazio (instalação nova, nenhum responsável logou aqui
 * ainda), recorre à lista de demonstração local só para não deixar a tela
 * de seleção vazia durante o desenvolvimento/demo do app. Assim que um
 * responsável loga uma vez neste aparelho, o cache real assume.
 */
export async function getChildLoginProfiles(): Promise<KnownChildProfile[]> {
  const cached = await getKnownChildProfiles();
  if (cached.length > 0) return cached;

  const { mockApi } = await import("../api/mock");
  const demoChildren = await mockApi.listChildren();
  return demoChildren.map((child) => ({ id: child.id, name: child.name, photoUrl: child.photoUrl }));
}
