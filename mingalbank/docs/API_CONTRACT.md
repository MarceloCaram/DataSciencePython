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

## Tasks
- `POST /tasks` (parent) `{ childId, title, category, points, dueDate }`
- `GET /tasks?childId=&status=` (parent vê todos da família; child só vê os seus)
- `POST /tasks/:id/complete` (child) `{ evidenceUrl? }` → cria `TaskCompletion` PENDING
- `POST /tasks/:id/completions/:completionId/review` (parent) `{ approve: boolean }` →
  aprova (credita pontos + streak) ou rejeita

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
- `GET /dashboard` (parent) → overview: filhos, tarefas pendentes de aprovação, resgates pendentes

Todas as respostas de erro seguem `{ error: { code, message } }` com status HTTP apropriado
(400 validação, 401 não autenticado, 403 sem permissão, 404 não encontrado).
