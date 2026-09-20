# 📱 MingalBank - PRD (Product Requirements Document)

**Status**: Draft v0.1 | **Último atualizado**: 2026-09-18

---

## 1. Visão & Missão

**Missão**: Gamificar a mesada mensal, transformando responsabilidades em diversão enquanto ensina educação financeira.

**Visão**: A app mais confiável e usada por famílias brasileiras para gerenciar mesada com engajamento, segurança e transparência.

---

## 2. User Personas

| Persona | Perfil | Motivação |
|---------|--------|-----------|
| **Filho/Filha** | 8-10 anos | Ganhar mesada, cumprir desafios, competir |
| **Pai/Mãe** | 25-50 anos | Ensinar responsabilidade, rastrear tarefas, controlar mesada, educação financeira, ensinar poupar |
| **Admin** | Um responsável financeiro | Relatórios, aprovações, histórico |

---

## 3. Core Features - MVP (Minimum Viable Product)

### 3.1 Para Pais
- ✅ **Cadastro de Filhos**: Nome, foto, data de nascimento, nível de confiança
- ✅ **Escolher formato da mesada base**: mensal ou semanal
- ✅ **Configurar Mesada Base**: definir Valor da mesada (ex: R$ 100/mês, R$ 20/semana)
- ✅ **Criar Tarefas**:
  - Templates pré-definidas (lições, limpeza, estudar)
  - Tarefas customizadas
  - Valor em pontos por tarefa
  - Categoria (saúde, estudos, casa, criatividade)
- ✅ **Aprovar/Rejeitar Tarefas**: Validar conclusão do filho
- ✅ **Dashboard**: Visão geral (filhos, tarefas, mesada acumulada, histórico)
- ✅ **Notificações**: Tarefa concluída, mesada creditada, avisos
- ✅ **Controle do saldo**: acompanhar valor acumulado na carteira, aprovar resgate

### 3.2 Para Filhos
- ✅ **Ver Tarefas Disponíveis**: Lista com pontos, dificuldade
- ✅ **Marcar Tarefa como Concluída por dia**: Foto/evidência opcional
- ✅ **Acompanhar Mesada**: Saldo atual, histórico de movimentações
- ✅ **Solicitar resgate da mesada**: definir valor, pedir aprovação
- ✅ **Streaks & Badges**: Motivation boost ("7 dias seguidos!" 🔥)
- ✅ **Perfil**: Ranking entre irmãos (opcional), nível
- ✅ **Privilégios**: recompensas adicionais, bônus extra

---

## 4. Mecânicas de Gamificação

### Sistema de Pontos
- **Mesada Base**: 100 pontos/mês (configurável)
- **Tarefas Diárias**: 1-10 pontos (customizável)
- **Bônus**: Multiplicador no fim de semana (1.5x), streaks (+10% a cada semana com mais de 20 pontos - customizável)

### Recompensas
- **Tipo 1**: Privilégios (aprovação automática se pontos ≥ limite)
  - "10 minutos a mais antes de dormis": 50 pontos
  - "sorvete no final de semana": 60 pontos
  - "Pedir algo especial": 80 pontos

- **Tipo 2**: Mesada extra
  - "Transformar 100 pontos em R$ 50": Conversão automática

### Engagement
- **Streaks**: Contador de dias com tarefas concluídas
- **Níveis**: Bronze → Prata → Ouro (unlock rewards)
- **Badges**: "Capivara baby", "Capivara junior", "Mestre Capivara"

---

## 5. Segurança & Conformidade

- 🔒 **LGPD**: Dados de menores protegidos, consentimento de pais
- 🔐 **Autenticação**: Biometria (fingerprint) para filhos, 2FA para pais
- 🚫 **Controle Parental**: Pais controlam quem vê o quê
- 📊 **Audit Trail**: Histórico de todas as ações

---

## 6. Modelo de Negócio

**MVP**: Freemium
- ✅ **Grátis**: Até 3 filhos, tarefas ilimitadas
- 💎 **Premium** (R$ 9,99/mês):
  - Ilimitado de filhos
  - Relatórios avançados
  - Integração com banco (futura)
  - Sem anúncios

---

## 7. Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────┐
│         iOS & Android (React Native)        │
│  (UI nativa com shared business logic)      │
└────────────────────┬────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
    ┌───▼───┐  ┌────▼────┐  ┌───▼────┐
    │  API  │  │ WebApp  │  │ Admin  │
    │REST   │  │(React)  │  │Panel   │
    └───┬───┘  └────┬────┘  └───┬────┘
        │           │           │
        └───────────┼───────────┘
                    │
            ┌───────▼────────┐
            │  Backend Node  │
            │  (Express.js)  │
            └───────┬────────┘
                    │
        ┌───────────┼──────────────┐
        │           │              │
    ┌───▼──┐  ┌────▼───┐  ┌─────▼─┐
    │  DB  │  │ Cache  │  │ Queue │
    │(PG)  │  │ (Redis)│  │(Bull) │
    └──────┘  └────────┘  └───────┘
```

---

## 8. Fluxo Principal

### Fluxo do Filho
1. **Login**: Biometria ou PIN
2. **Home**: Tarefas disponíveis + saldo atual
3. **Selecionar Tarefa**: Ver detalhes, pontos
4. **Marcar como Concluído**: Foto/descrição (opcional)
5. **Aguardar Aprovação**: Pai valida em 24h
6. **Crédito Automático**: Pontos transferidos, notificação

### Fluxo do Pai
1. **Login**: Senha + 2FA
2. **Dashboard**: Overview filhos, tarefas pendentes
3. **Criar Tarefa**: Título, pontos, categoria, deadline
4. **Revisar Conclusão**: Foto/descrição do filho, aprovar/rejeitar
5. **Gerar Relatório**: Progresso mensal, padrões

---

## 9. Métricas de Sucesso (OKRs)

### Trimestre 1 (Launch)
- **Acquisition**: 1.000 famílias cadastradas
- **Engagement**: 40% DAU (Daily Active Users)
- **Retention**: 60% ao final do mês
- **NPS**: ≥ 40

### Trimestre 2+
- **Monetization**: 10% conversão para Premium
- **Referral**: 20% das novas famílias via indicação
- **Expansion**: Integração com banco para PIX automático

---

## 10. Roadmap Geral

```
Fase 1 (Sprint 0-2): MVP
├─ Setup Projeto + Arquitetura
├─ Auth (Pais & Filhos)
└─ Tarefas + Mesada (Core)

Fase 2 (Sprint 3-4): Gamificação
├─ Streaks & Badges
├─ Recompensas Unlock
└─ Relatórios Básicos

Fase 3 (Sprint 5+): Growth
├─ Notificações Push
├─ Referral Program
├─ Integração Financeira
└─ Analytics avançado
```

---

## 11. Riscos & Mitigação

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Falta de adoção (pais) | Alto | UX super intuitiva, onboarding vídeo |
| Segurança/Breach | Crítico | Audit trail, 2FA, criptografia de ponta a ponta |
| Churn de filhos | Médio | Gamificação forte, social features |
| Conformidade LGPD | Crítico | Legal desde o design, consent management |

---

## 12. Próximos Passos

- [ ] **Validação**: Entrevistas com 20 famílias
- [ ] **Design**: Prototipagem em Figma (designer liderará)
- [ ] **Tech Spec**: Documento técnico detalhado (engenharia)
- [ ] **Sprint Planning**: Kickoff desenvolvimento

---

**Autor**: PM | **Review**: Design, Engenharia | **Aprovação**: Stakeholders
