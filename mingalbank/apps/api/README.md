# MingalBank API (Fase 1 — MVP)

Backend REST em Node.js + TypeScript + Express + Prisma (PostgreSQL) implementando
o MVP de Fase 1 do roadmap do [PRD](../../PRODUCT.md): auth de pais/filhos, tarefas
com fluxo de aprovação, carteira/pontos com gamificação, resgates e recompensas.

O contrato de rotas está em [`docs/API_CONTRACT.md`](../../docs/API_CONTRACT.md) e os
tipos de domínio compartilhados com o app mobile em
[`packages/shared/domain.ts`](../../packages/shared/domain.ts).

## Stack

- Node.js 20+, TypeScript, Express
- Prisma ORM + PostgreSQL
- Autenticação por JWT (bcrypt para senha de pai e PIN de filho)
- Validação de entrada com `zod`
- Testes com `vitest`

## Rodando localmente

### 1. Suba o Postgres

Um `docker-compose.yml` simples já está incluído:

```bash
cd apps/api
docker compose up -d
```

Isso sobe um Postgres 16 em `localhost:5432` com usuário/senha/banco `mingalbank`
(veja `docker-compose.yml`). Se preferir usar um Postgres já existente, pule este
passo e ajuste `DATABASE_URL`.

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Variáveis:

| Variável | Descrição | Default (`.env.example`) |
|---|---|---|
| `DATABASE_URL` | Connection string do Postgres usada pelo Prisma | `postgresql://mingalbank:mingalbank@localhost:5432/mingalbank?schema=public` |
| `JWT_SECRET` | Segredo para assinar os JWTs de pais e filhos | `change-me-super-secret` |
| `PORT` | Porta HTTP do servidor | `3333` |
| `JWT_EXPIRES_IN` | Validade do token (`jsonwebtoken` "expiresIn") | `7d` |

### 3. Instale as dependências e rode as migrations

```bash
npm install
npm run prisma:migrate   # cria/atualiza o schema no Postgres (modo dev)
```

`npm install` já dispara `prisma generate` via `postinstall`. Se o schema mudar
depois, rode `npm run prisma:generate` para regenerar o client.

### 4. Rode o servidor

```bash
npm run dev     # tsx watch — hot reload
# ou
npm run build && npm start
```

A API sobe em `http://localhost:3333/api/v1` (ver `GET /health` fora do prefixo
`/api/v1` para healthcheck simples).

### 5. Rode os testes

```bash
npm test
```

Os testes cobrem as regras puras de gamificação
(`src/modules/wallet/gamification.ts`: multiplicador de fim de semana, bônus de
streak, cálculo de streak, badge tier) e o fluxo completo de aprovação/rejeição de
tarefa (`src/modules/tasks/taskApproval.service.ts`) com um Prisma mockado — não é
necessário um Postgres real rodando para `npm test`.

## Estrutura

```
src/
  app.ts                  # monta o Express app e as rotas
  server.ts               # ponto de entrada (listen)
  lib/
    prisma.ts             # singleton do PrismaClient
    jwt.ts                # sign/verify de tokens
    errors.ts             # AppError + helpers (badRequest/unauthorized/...)
    serializers.ts         # Prisma row -> JSON no formato de domain.ts
  middleware/
    auth.ts                # authenticate + requireRole
    validate.ts             # validateBody/validateQuery (zod)
    errorHandler.ts          # asyncHandler + handler central de erros
  modules/
    auth/                  # registro/login de pai, login de filho, set PIN
    children/               # CRUD de filhos
    tasks/                   # criação, listagem, conclusão e revisão de tarefas
      taskApproval.service.ts # regra de aprovação isolada (testável sem Prisma real)
    wallet/
      gamification.ts        # funções puras: multiplicador fds, bônus streak, streak, badge
      constants.ts            # GAMIFICATION_DEFAULTS + taxa de conversão pontos->R$
    rewards/                 # criação/listagem/resgate de recompensas
    dashboard/                # overview do pai (filhos, pendências)
prisma/
  schema.prisma            # modelos Family, Parent, Child, Task, TaskCompletion, ...
test/
  gamification.test.ts     # regras de gamificação
  taskApproval.test.ts     # fluxo de aprovação de tarefa (Prisma mockado)
```

## Decisões de design relevantes

- **Conversão pontos → R$**: `POINTS_TO_CASH_RATE = 0.5` em
  `src/modules/wallet/constants.ts` (100 pontos = R$ 50,00, conforme o PRD). É uma
  constante isolada para facilitar tornar isso configurável por família no futuro.
- **Regra de streak** (`computeNextStreak` em `gamification.ts`): o streak conta dias
  calendário (UTC) consecutivos com pelo menos uma tarefa aprovada.
  - Primeira aprovação da história do filho → streak vira `1`.
  - Segunda aprovação no *mesmo dia* → streak não muda (um dia só conta uma vez).
  - Aprovação no dia seguinte ao último dia aprovado → streak `+1`.
  - Aprovação depois de pular ao menos um dia → streak quebra e reinicia em `1`.
- **Bônus de fim de semana**: `applyWeekendMultiplier` aplica 1.5x aos pontos base da
  tarefa quando a aprovação cai em sábado ou domingo (UTC), arredondando para o
  inteiro mais próximo.
- **Bônus de streak (+10%)**: o PRD descreve isso de forma um pouco ambígua ("+10% a
  cada semana com mais de 20 pontos"). Interpretação implementada em
  `applyStreakBonus`: mantemos a soma de pontos de `TASK_REWARD` já creditados nessa
  semana (segunda a domingo, UTC) *antes* desta tarefa; assim que esse total atinge o
  limiar (20 pontos, `GAMIFICATION_DEFAULTS.streakBonusThresholdPoints`), esta e as
  próximas tarefas aprovadas na mesma semana recebem +10% adicional sobre os pontos
  (já ajustados pelo multiplicador de fim de semana). Os dois bônus podem se
  acumular (multiplicador de fim de semana aplicado primeiro, bônus de streak
  aplicado sobre o resultado).
- **Badge tier**: recalculado a cada aprovação de tarefa e a cada resgate/claim que
  altera `pointsBalance`, usando os limiares de `GAMIFICATION_DEFAULTS.badgeThresholds`
  (BRONZE ≥ 0, SILVER ≥ 500, GOLD ≥ 2000) sobre o **saldo atual de pontos** do filho
  (não um total histórico — resgatar pontos pode rebaixar o badge).
- **RedemptionRequest**: o corpo de `POST /wallet/:childId/redeem` recebe `{ points }`
  (quantos pontos o filho quer resgatar); o valor em R$ é calculado no momento da
  solicitação com a taxa de conversão e fica armazenado em `RedemptionRequest.amount`
  (congelado — não recalculado na aprovação, mesmo que a taxa mude depois). A
  suficiência de saldo é validada tanto na solicitação quanto (de novo) na aprovação,
  já que o saldo pode ter mudado entre os dois momentos.
- **PIN de filho**: hasheado com bcrypt como a senha do pai; login de filho é feito
  por `childId + pin` (sem username/email), conforme o contrato.
- **Erros**: todo erro de negócio é um `AppError` (`src/lib/errors.ts`), capturado
  pelo middleware central e formatado como `{ error: { code, message } }` com o
  status HTTP correspondente, conforme `docs/API_CONTRACT.md`.
- **Redis/Bull (filas, notificações)**: fora de escopo da Fase 1, conforme
  `TEAM.md` — não implementado neste módulo.
