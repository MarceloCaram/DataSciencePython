# MingalBank — App Mobile (Fase 1 / MVP)

App Expo (React Native + TypeScript) para iOS e Android do MingalBank —
mesada gamificada para famílias. Implementa as telas de Fase 1 do roadmap
(`PRODUCT.md`, seção 10): auth de pais/filhos, tarefas, aprovação e carteira.

## Como rodar

```bash
cd apps/mobile
npm install
npx expo start
```

Abra no celular com o app **Expo Go** (escaneando o QR code), ou pressione
`a` / `i` no terminal para abrir num emulador Android / simulador iOS.

O app funciona **sem o backend rodando**: todas as chamadas de API caem
automaticamente para dados mockados locais (ver "Modo offline / mockado"
abaixo), então dá pra navegar o fluxo inteiro (login, tarefas, aprovação,
carteira, recompensas) sem depender do `apps/api`.

### Apontar para o backend local

Por padrão o client usa `http://localhost:3333/api/v1` (o mesmo default do
`docs/API_CONTRACT.md`). Para apontar explicitamente:

```bash
# apps/mobile/.env (não commitado) ou export na shell antes do expo start
EXPO_PUBLIC_API_URL=http://localhost:3333/api/v1 npx expo start
```

Se estiver testando num celular físico/emulador Android, troque `localhost`
pelo IP da sua máquina na rede local (ou `10.0.2.2` no emulador Android).

Login de demonstração (funciona tanto com o mock quanto, se o backend real
implementar as mesmas credenciais de seed, contra a API real):

- **Responsável**: `pai@mingalbank.com` / `mingal123`
- **Filho(a)**: selecione "Théo" ou "Luiza" na tela de perfis e use o PIN
  `1234` / `5678`, respectivamente.

## Estrutura de pastas

```
apps/mobile/
├── App.tsx                  # Providers raiz (safe area, auth, navigation)
├── metro.config.js          # Habilita o Metro a resolver packages/shared (monorepo)
├── src/
│   ├── api/
│   │   ├── client.ts         # Funções tipadas por recurso (auth, children, tasks, wallet, rewards, dashboard)
│   │   ├── http.ts           # fetch wrapper: timeout, Authorization header, parsing de erro
│   │   ├── mock.ts           # "Backend" local em memória (fallback offline), com dados de seed
│   │   ├── errors.ts         # ApiError (erro de negócio) vs NetworkError (fallback pro mock)
│   │   ├── types.ts          # DTOs de request/response compostos a partir de packages/shared/domain
│   │   └── config.ts         # EXPO_PUBLIC_API_URL, timeouts
│   ├── state/
│   │   ├── auth.tsx          # Contexto de autenticação (token + usuário atual), persistido via SecureStore
│   │   ├── knownProfiles.ts  # Cache local (AsyncStorage) dos perfis de filhos para a tela de login
│   │   └── taskSubmissions.tsx # Estado efêmero de tarefas já enviadas p/ aprovação nesta sessão
│   ├── navigation/
│   │   ├── RootNavigator.tsx  # Login vs ParentTabs vs ChildTabs, conforme sessão
│   │   ├── ParentTabs.tsx     # Dashboard / Filhos / Nova tarefa / Aprovações
│   │   ├── ChildTabs.tsx      # Início / Tarefas / Carteira / Prêmios
│   │   ├── ChildTasksStack.tsx# Lista -> Detalhe de tarefa (stack aninhada na tab "Tarefas")
│   │   └── types.ts           # Param lists tipados de cada navegador
│   ├── screens/
│   │   ├── LoginScreen.tsx    # "Sou responsável" (e-mail/senha) vs "Sou filho(a)" (perfil + PIN)
│   │   ├── parent/            # ParentDashboard, Children, CreateTask, Approvals
│   │   └── child/             # ChildHome, TaskList, TaskDetail, Wallet, Rewards
│   ├── components/            # Button, Card, Avatar, PinPad, CategoryTag, BadgeTierChip, StreakBanner, ...
│   └── theme/                 # Tokens (spacing/radius/fontSize) + paletas pai/filho/neutra + ThemeProvider
```

## Decisões técnicas e de UX

- **Navegação**: React Navigation (`native-stack` + `bottom-tabs`). Um único
  `RootNavigator` decide entre o stack de login, `ParentTabs` ou `ChildTabs`
  a partir do `role` da sessão (`PARENT` | `CHILD`).
- **Tipos de domínio**: nenhuma entidade é redefinida — tudo importa de
  `packages/shared/domain.ts` (`Family`, `Parent`, `Child`, `Task`,
  `TaskCompletion`, `Reward`, `WalletTransaction`, `GAMIFICATION_DEFAULTS`
  etc.), com caminho relativo `../../../packages/shared/domain` a partir de
  cada arquivo. `src/api/types.ts` só compõe DTOs de request/response em
  cima desses tipos.
- **Modo offline / mockado** (`src/api/http.ts` + `src/api/mock.ts`): cada
  função do client tenta primeiro a chamada HTTP real; se o backend estiver
  inalcançável (timeout de 4s, DNS, conexão recusada), cai automaticamente
  para um "backend" local em memória com dados de seed (`src/api/mock.ts`),
  que reproduz as mesmas regras do contrato (crédito de pontos ao aprovar
  tarefa, bônus de streak, tiers de badge, resgates). **Erros de negócio
  reais** (senha errada, PIN incorreto, saldo insuficiente — modelados como
  `ApiError`) nunca caem no mock; só falhas de conectividade (`NetworkError`)
  acionam o fallback. Isso garante que a UI nunca trava esperando um backend
  que não está rodando, e que o dev consegue navegar o app inteiro assim que
  clona o repo.
- **Persistência de sessão**: `expo-secure-store` (Keychain/Keystore) para o
  token de sessão — dado sensível o bastante para justificar armazenamento
  criptografado nativo, mesmo sendo um blob pequeno, dado o contexto de
  LGPD/dados de menores do PRD (seção 5). O cache não sensível de "perfis de
  filhos conhecidos neste aparelho" (usado só pela UX do seletor de login)
  usa `@react-native-async-storage/async-storage`, que dispensa esse
  overhead. Ver comentários em `src/state/auth.tsx` e
  `src/state/knownProfiles.ts`.
- **Login do filho sem digitar e-mail**: o contrato de API não expõe uma
  rota pública para listar filhos antes do login (só autenticado). Seguindo
  o padrão comum de apps família em tablet/celular compartilhado (como
  seleção de perfil em apps de streaming), a tela "Sou filho(a)" lista os
  perfis já vistos neste aparelho (populados no primeiro login de um
  responsável) e pede só avatar + PIN de 4 dígitos, com teclado numérico
  grande (`PinPad.tsx`). Numa instalação nova sem nenhum responsável logado
  ainda, a lista usa os perfis de demonstração do mock só para não deixar a
  tela vazia durante o desenvolvimento.
- **Evidência de foto da tarefa**: usa `expo-image-picker` para anexar uma
  foto opcional ao concluir uma tarefa. O upload real para storage fica para
  uma fase seguinte (fora do escopo definido no `docs/API_CONTRACT.md`); por
  ora a URI local da imagem é enviada como `evidenceUrl`, o suficiente para
  demonstrar o fluxo de UX e a tela de aprovação do pai renderizar a foto.
- **Aprovações do pai**: como o contrato não define um endpoint dedicado
  para listar `TaskCompletion`s pendentes de toda a família (só o
  `GET /dashboard` os agrega), tanto o Dashboard quanto a tela de
  Aprovações usam essa mesma rota agregada — evita inventar endpoints fora
  do contrato compartilhado com o backend.
- **Tema pai vs filho**: `ThemeProvider` com três paletas (`parentColors`
  sóbria em azul/grafite, `childColors` lúdica e quente em laranja/roxo, e
  `neutralColors` para a tela de login antes de saber o papel do usuário).
  Mesmos tokens de espaçamento/raio, mas `theme.playful` deixa botões mais
  arredondados e textos com peso maior no modo filho. Ícones de tab usam
  emoji (sem dependência extra de fontes de ícone) — combina com o tom
  lúdico e mantém o bundle enxuto.
- **Monorepo + Metro**: `metro.config.js` adiciona a raiz do monorepo
  (`../..`) aos `watchFolders` do Metro, senão o bundler recusa resolver
  arquivos fora de `apps/mobile` (necessário para importar
  `packages/shared/domain.ts`).

## Rotas cobertas do `docs/API_CONTRACT.md`

Auth (`/auth/parent/login`, `/auth/child/login`, `/auth/parent/register`,
`/auth/child/pin`), Children (`/children`, `/children/:id`), Tasks
(`/tasks`, `/tasks/:id/complete`, `/tasks/:id/completions/:id/review`),
Wallet (`/wallet/:childId`, `/wallet/:childId/transactions`,
`/wallet/:childId/redeem`, `/wallet/redemptions/:id/review`), Rewards
(`/rewards`, `/rewards/:id/claim`) e Dashboard (`/dashboard`).

## Verificações rodadas neste ambiente

- `npm install` — ok.
- `npx tsc --noEmit` — sem erros.
- `npx expo export --platform android` e `--platform ios` (com
  `EXPO_OFFLINE=1`, já que o proxy de rede deste ambiente bloqueia
  `api.expo.dev`/`reactnative.directory`) — bundle Metro gerado com sucesso
  para as duas plataformas, provando que toda a árvore de imports (telas,
  navegação, client de API, tipos compartilhados) resolve e compila.
- **Não testado**: abertura em emulador/simulador real ou no app Expo Go
  (este ambiente não tem Android/iOS SDK nem device disponível). O smoke
  test acima cobre bundling/resolução de módulos, mas não renderização em
  runtime real — recomenda-se rodar `npx expo start` localmente com um
  emulador antes de considerar as telas validadas visualmente.
