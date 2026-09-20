# API Contract — Fase 1 (MVP)

Base URL: `http://localhost:3333/api/v1`
Auth: `Authorization: Bearer <jwt>` (exceto rotas de login)
Tipos de domínio: ver `packages/shared/domain.ts`

## Auth
- `POST /auth/parent/register` `{ familyName, parentName, email, password }` → `{ token, parent, family }`
- `POST /auth/parent/login` `{ email, password }` → `{ token, parent }`
- `POST /auth/child/login` `{ childId, pin }` → `{ token, child }`
- `POST /auth/child/pin` (parent-only) `{ childId, pin }` → cria/reseta PIN do filho

## Children (parent-only, exceto GET /children/me)
- `POST /children` `{ name, birthDate, photoUrl?, trustLevel, allowanceValue, allowancePeriod }`
- `GET /children` → lista filhos da família
- `GET /children/:id` → detalhe (saldo, streak, badge)
- `PATCH /children/:id` → atualizar mesada base / trustLevel

## Family (parent-only)
- `GET /family/settings` → `{ weekendMultiplier }`
- `PATCH /family/settings` `{ weekendMultiplier }` (1–3) → atualiza o multiplicador de
  pontos aplicado às tarefas aprovadas no fim de semana (default 1.5)

## Tasks
- `POST /tasks` (parent) `{ childId, title, category, points }` — sem prazo/dueDate: a
  tarefa fica disponível até ser concluída, sem data limite
- `GET /tasks?childId=&status=` (parent vê todos da família; child só vê os seus) → cada
  tarefa inclui `points` (base) e `effectivePoints` (pontos que ela vale **hoje**, já com
  o multiplicador de fim de semana da família aplicado — é isso que a UI do filho deve
  exibir, para não haver surpresa entre o que foi mostrado e o que foi creditado)
- `POST /tasks/:id/complete` (child) `{ evidenceUrl? }` → cria `TaskCompletion` PENDING
- `POST /tasks/:id/completions/:completionId/review` (parent) `{ approve: boolean }` →
  aprova (credita pontos, já com o multiplicador de fim de semana e o bônus de streak
  aplicados no momento da aprovação) ou rejeita

## Wallet
- `GET /wallet/:childId` → `{ pointsBalance, walletBalance, currentStreak, badgeTier }`
- `GET /wallet/:childId/transactions` → histórico
- `POST /wallet/:childId/redeem` (child) `{ points }` → cria `RedemptionRequest` PENDING
- `POST /wallet/redemptions/:id/review` (parent) `{ approve: boolean }`

## Rewards
- `POST /rewards` (parent) `{ title, type, pointsCost, cashValue? }`
- `GET /rewards` → lista da família
- `POST /rewards/:id/claim` (child) → resgate automático se pointsBalance >= pointsCost

## Dashboard
- `GET /dashboard` (parent) → `{ children, pendingTaskApprovals, pendingRedemptions }`.
  Cada item de `pendingTaskApprovals` traz `taskTitle`, `childName`, `points` (base) e
  `effectivePoints` (o que será creditado se aprovado agora); cada item de
  `pendingRedemptions` traz `childName`.

Todas as respostas de erro seguem `{ error: { code, message } }` com status HTTP apropriado
(400 validação, 401 não autenticado, 403 sem permissão, 404 não encontrado).
