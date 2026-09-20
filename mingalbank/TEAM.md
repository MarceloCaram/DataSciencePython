# Equipe do MingalBank

Este documento define os papéis usados para conduzir o projeto, mapeados no roadmap
do `PRODUCT.md`. Cada papel tem escopo e critérios de "pronto" claros — na prática,
cada papel foi executado por mim (Claude) de forma estruturada, um de cada vez, com
os artefatos correspondentes versionados neste repositório.

## Papéis

### 1. Product Manager (PM)
**Responsável por**: `PRODUCT.md`, priorização do roadmap, critérios de aceite.
**Entregue**: PRD recebido do usuário (v0.1). Próximo: validar com famílias reais
antes de sair do MVP (ver seção 12 do PRD).

### 2. Arquiteto / Tech Lead
**Responsável por**: decisões de stack e estrutura do monorepo, contrato de API,
modelagem de dados.
**Decisões tomadas**:
- Monorepo: `apps/api` (backend), `apps/mobile` (app), `packages/shared` (tipos comuns).
- Stack conforme arquitetura do PRD: React Native (Expo) + Node/Express + TypeScript
  + PostgreSQL (via Prisma) + Redis/Bull ficam previstos para Fase 3 (filas de
  notificação) e não fazem parte do MVP de Fase 1.
- Contrato de API em `docs/API_CONTRACT.md`; tipos de domínio em
  `packages/shared/domain.ts` — fonte única de verdade para os dois apps.

### 3. Engenheiro Backend
**Responsável por**: `apps/api` — auth (pais/filhos), modelos Prisma, rotas REST de
tarefas, aprovação, carteira e resgate.
**Escopo Fase 1**: schema Prisma completo, JWT auth, CRUD de tarefas, fluxo de
aprovação com crédito automático de pontos, saldo/carteira, testes básicos.

### 4. Engenheiro Mobile
**Responsável por**: `apps/mobile` — telas de login (pai/filho), dashboard dos pais,
home do filho, lista/detalhe de tarefas, carteira e histórico.
**Escopo Fase 1**: navegação (React Navigation), client de API tipado com os
tipos de `packages/shared`, telas funcionais com estado mockável (sem backend
rodando) e integráveis (com backend rodando).

### 5. UX/UI Designer
**Responsável por**: fluxos de tela e hierarquia visual (ver seção 8 do PRD —
Fluxo do Filho / Fluxo do Pai). Sem alto-fidelity/Figma neste momento; os
componentes do app seguem os fluxos descritos como wireframe funcional.
**Pendente** (fora do MVP de código): prototipação em Figma com pesquisa de
usuário, conforme "Próximos Passos" do PRD.

### 6. QA
**Responsável por**: garantir que os fluxos core (login, criar/completar/aprovar
tarefa, creditar mesada, solicitar resgate) funcionam ponta a ponta.
**Escopo Fase 1**: testes automatizados no backend (rotas + regras de pontuação/
streak) e checklist manual de smoke test do app mobile.

## Como o roadmap do PRD mapeia para entregas de código

| Fase (PRD) | Entregável neste repo |
|---|---|
| Fase 1 — Setup + Arquitetura | Estrutura de monorepo, `docs/API_CONTRACT.md`, `packages/shared` |
| Fase 1 — Auth (Pais & Filhos) | `apps/api/src/modules/auth`, telas de login no mobile |
| Fase 1 — Tarefas + Mesada (Core) | Módulos `tasks` e `wallet` no backend + telas correspondentes no mobile |
| Fase 2 — Gamificação | Streaks/badges (parcialmente modelados em `domain.ts`), recompensas |
| Fase 3 — Growth | Notificações push, filas (Redis/Bull), integração financeira — **não implementado ainda** |

## Papéis que seguem fora do código (decisão de negócio, não técnica)
- Validação com 20 famílias (PM)
- LGPD / consentimento parental formal (Jurídico — não coberto por este time técnico)
- Monetização / cobrança Premium (PM + Backend, quando sair do MVP)
