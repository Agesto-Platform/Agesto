# Agesto — Tasks e Roadmap

> Espelho simplificado do Jira (projeto KAN). Para status detalhado, acessar o board em `gomesdavi731.atlassian.net`.
> Atualizar este arquivo sempre que uma task mudar de status ou uma nova decisão impactar o roadmap.
> **Nota:** este arquivo está em reconciliação com código e Git. O Jira deve ser sincronizado somente depois dessa auditoria.

## Transição para trabalho em equipe — 18/08/2026

| Item | Estado |
|---|---|
| Centralizar documentação em `docs/project/` | 🟢 Concluído |
| Definir integrantes, papéis e focos iniciais | 🟢 Concluído — Davi (Produto), Depowo (Infra), ghzpro034 (Generalista) |
| Criar organização GitHub e transferir para `Agesto-Platform/Agesto` | 🟢 Concluído |
| Configurar time `Core`, acessos mínimos e segundo Owner | 🟢 Concluído — Davi e Depowo são Owners |
| Proteger `develop` e `main` com PR, revisão e status checks | 🔴 Pendente |
| Adicionar CI para backend, web e mobile | 🟢 Concluído — validado na promoção de governança |
| Auditar `REQUIREMENTS.md` reconstruído | 🟡 Em andamento |
| Publicar a linha local consolidada em `main` | 🟢 Concluído — merge `72b021b` |

---

## Status dos Épicos

| Épico | Descrição | Status |
|-------|-----------|--------|
| KAN-11 | Infraestrutura & DevOps | 🟡 Em andamento |
| KAN-19 | Backend Core (C# / ASP.NET) | 🟢 Essencialmente completo |
| KAN-30 | Módulo IA/Insights (Python) | ⚫ Obsoleto — descartado (DEC-21 resolvida: IA roda em C# no backend) |
| KAN-37 | Documentação & QA | 🟡 Em andamento |
| KAN-44 | Frontend Web (React) — Módulo Dono | 🟢 Completo (web-01 a web-14, sidebar 100% funcional + testes base, ver DEC-25) — resta só trocar mock por API real quando a infra subir |
| KAN-69 | Domínio Prestador de Serviço (Orçamento, Agenda, Item genérico, valor editável) | 🟢 Backend essencialmente completo — falta lat/lng/roteirização, descarga de orçamento no sync e aplicar migrations no banco |
| KAN-77 | Camada de Métricas & Dashboards | 🟡 Em andamento |
| — | Mobile (React Native) — App do Agente | 🟢 Completo (mob-01 a mob-07, offline-first, ver DEC-26) — resta só trocar mock por API real quando a infra subir |

---

## Sprint Atual — Backend Core

### ✅ Concluídas

| KAN | Descrição | Responsável |
|-----|-----------|-------------|
| KAN-20 | Entidade Usuario + AuthService (JWT) | Luan |
| KAN-21 | Entidade Configuracao | Davi Gomes |
| KAN-22 | CRUD Cliente | Davi Gomes |
| KAN-23 | CRUD Produto + controle de estoque* | Davi Gomes |
| KAN-24 | CRUD Servico | Luan |
| KAN-25 | Atendimento + calcularTotal() | Davi Gomes |
| KAN-26 | ItemProduto + ItemServico | Luan |
| KAN-27 | Filtros de Atendimento Híbrido | Davi Gomes |
| KAN-28 | Testes unitários (xUnit + Moq) | Luan |
| KAN-29 | Migration InitialCreate + Supabase | Diego |
| KAN-56 | Entidade Empresa + refatoração multi-tenant | Davi Gomes |
| KAN-57 | Campo Perfil no Usuario + claims JWT | Davi Gomes |
| KAN-58 | Remover campos BYOK da Configuracao | Davi Gomes |
| KAN-59 | Controller/Service/Repository da Configuracao | Davi Gomes |
| KAN-62 | Cobrança por empreitada no Servico | Davi Gomes |
| KAN-63 | Corrigir extração de empresaId nos controllers (bug multi-tenant) | Davi Gomes |
| KAN-55 | DELETE /api/usuario (LGPD) | Luan |
| KAN-60 | Endpoints de sincronização Mobile (Carga e Descarga) | Davi Gomes |
| KAN-64 | Migration `ConvertEnumsToString` (DEC-08) | Diego |
| KAN-65 | Converter Uuid de string para Guid nativo (DEC-09) | Davi Gomes |
| KAN-66 | Alinhar versões EF Core entre Api e Tests em 8.0.11 (DEC-13) | Diego |
| KAN-67 | Padronizar exceções nos Services (NotFoundException + 404 tipado) | Davi Gomes |
| KAN-68 | UpdatedAt automático via SaveChangesAsync override (ChangeTracker) | Davi Gomes |
| KAN-61 | Validar CRUD Cliente para Mobile | Davi Gomes |

> *KAN-23: controle de estoque agora **integrado ao fluxo de vendas** via DEC-11 — fix commitado em 17/06/2026. Cascade soft delete de itens e devolução de estoque ao deletar atendimento também implementados (commit `1b8b433`), assim como o wrap da descarga de sincronização em transação DB (commit `35c0587`).

### 🔴 Pendentes — Backend Core

| KAN | Descrição | Prioridade | Responsável | Depende de |
|-----|-----------|------------|-------------|------------|
| — | Paginação no GetAllAsync | Baixa | A definir | — |

> Backend Core está essencialmente completo: no último marco validado, build verde e 90 testes xUnit aprovados. `TryGetEmpresaId` e `TryGetUsuarioId` estão em `ApiControllerBase`; CPF, multi-tenant e sincronização possuem cobertura automatizada. A integração real com PostgreSQL ainda depende da nova infraestrutura.

---

## Domínio Prestador de Serviço (KAN-69)

> Épico que reúne os refinamentos do pivô de produto (DEC-15 a DEC-19, DEC-22, DEC-23): Orçamento, Agenda/Rota e item de atendimento genérico. As branches do batch já fazem parte da linha local atual de `develop`/`main`; a publicação desse histórico no GitHub ainda está pendente.

### ✅ Concluídas

| KAN | Descrição | Responsável | Commit |
|-----|-----------|-------------|--------|
| KAN-72 | Item de atendimento genérico: `ItemProduto.ProdutoId` nullable + `Descricao` + `Custo` (DEC-18/DEC-19); `ItemServico.ServicoId` continua obrigatório — serviço fora do catálogo é cadastro rápido, não linha efêmera (DEC-22); valor de item (`PrecoUnitario`) digitável/editável nos dois, com catálogo como sugestão/default (DEC-23); baixa de estoque só quando há `ProdutoId` | Davi Gomes | `61a9c29` |
| KAN-73 | Margem por atendimento: `ItemProduto.Custo` alimenta `Atendimento.CustoTotal`, exposto como `Margem = ValorTotal − CustoTotal` em `AtendimentoResponse` (DEC-19) | Davi Gomes | `61a9c29`, `2b0d253` |
| — | Orçamento como entidade separada do Atendimento (DEC-16): entidade `Orcamento` + `ItemOrcamento`, CRUD e conversão transacional `POST /api/orcamento/{id}/converter` (só converte se `Aprovado`; baixa de estoque só na conversão) | Davi Gomes | `fffaba0` |
| — | `Cliente.Endereco` (DEC-17, parte 1): campos `Logradouro`, `Numero`, `Bairro`, `Cidade`, `Cep` | Davi Gomes | `da828bc` |
| — | Agendamento (DEC-17, parte 2): `Atendimento.DataAgendada` + `GET /api/atendimento/agenda` com filtro por perfil (Agente só a própria; Dono todas/filtra) via novo helper `TryGetPerfil` em `ApiControllerBase` | Davi Gomes | `7007361` |

### 🟡 Batch "insights do protótipo" — concluído

> Lote de melhorias inspiradas no protótipo mobile aprovado, entregues após o batch principal do KAN-69, commit `5e82411`.

| Item | Descrição | Commit |
|------|-----------|--------|
| Agenda enriquecida | `GET /api/atendimento/agenda` passou a devolver `AgendaItemResponse` (nome/telefone/endereço do cliente + resumo do serviço), eliminando o N+1 no consumo mobile | `5e82411` |
| Rentabilidade agregada | Novo `GET /api/metrics/rentabilidade` + bloco `Rentabilidade` no `DashboardResponse` (faturamento, custo, margem, margem %, ticket médio, nº de atendimentos — só `Concluido` no período). Alimenta os KPIs do painel Web do dono | `5e82411` |
| Orçamentos na Carga do sync | `SyncCargaResponse.Orcamentos` — o agente vê propostas offline | `5e82411` |

### 🔴 Pendências residuais do prestador

| Item | Descrição | Prioridade | Depende de |
|------|-----------|------------|------------|
| Margem/hora por serviço | Parte restante do KAN-79 — depende de campo de duração (inexistente) + atribuição de custo a serviço. Decisão do dono: no protótipo, "serviço mais rentável" vira "serviços que mais faturam" (receita por serviço, já existente) enquanto isso não é priorizado | Baixa | Campo de duração (não modelado) |
| Descarga de Orçamento no sync | Criar orçamento a partir do mobile offline — decisão de fluxo em aberto (se o agente cria proposta offline). Hoje o sync de orçamento é só Carga (leitura) | Média | Decisão de produto |
| Roteirização/geolocalização | Lat/lng no `Cliente`, ordenação da rota do dia por proximidade — fase posterior da DEC-17 | Média | — |
| ~~Aplicar migrations no banco novo~~ | ✅ `InitialCreate` única (DEC-31) aplicada no Supabase novo em 08/10/2026 | Alta | — |
| **Agenda na Carga do sync** | A Carga (`GET /api/sync/carga`) não inclui a agenda; o app mobile precisou de um passo `syncAgenda` separado como contorno (delta identificado em mob-04, ver DEC-26). Idealmente a agenda entraria na Carga | Média | — |
| **Mapear uuid→id do cliente na Descarga** | Um atendimento criado offline não pode referenciar um cliente também criado offline (`PendingCliente`), porque a Descarga não devolve o mapeamento uuid→id do cliente pendente antes de processar o atendimento pendente da mesma leva (delta identificado em mob-06, ver DEC-26) | Média | Decisão de produto (ordem de processamento na Descarga) |

---

## Infraestrutura & DevOps

### ✅ Concluídas

| KAN | Descrição | Responsável |
|-----|-----------|-------------|
| KAN-12 | Repositório Git + Gitflow | Diego |
| KAN-13 | Projeto ASP.NET Core .NET 8 | Davi Gomes |
| KAN-35 | Testes de endpoints | Diego |
| KAN-16 | CI para backend, web e mobile | Equipe Agesto |

### 🔴 Pendentes

| KAN | Descrição | Prioridade | Responsável |
|-----|-----------|------------|-------------|
| KAN-14 | PostgreSQL de desenvolvimento + migrations | Alta | A definir |
| KAN-15 | Escolher provedor e ambientes | Alta | Equipe |
| KAN-17 | Deploy inicial da API | Média | A definir |
| KAN-18 | Documentar processo de deploy | Baixa | A definir |
| KAN-54 | Agents de QA automatizados | Baixa | Diego |
| — | Configurar rulesets em `develop` e `main` | Alta | Davi Gomes |
| — | Instalar dotnet ef global na máquina | Média | Davi Gomes |
| — | ~~Aplicar migrations pendentes no novo PostgreSQL~~ ✅ 08/10/2026 (DEC-31) | Alta | — |
| — | Subir banco/API real e trocar `VITE_USE_MOCKS`/`config.useMocks` para `false` no Web e no Mobile | Alta | Davi Gomes |

---

## Módulo IA/Insights (Python) — ⚫ OBSOLETO

> **DESCARTADO em 20/07/2026 (DEC-21 resolvida).** Decisão do dono (dev solo, Davi): a camada de IA roda dentro do backend C#, usando o SDK oficial da Anthropic, e NÃO num serviço Python/FastAPI separado. Motivo: elimina um codebase extra para um dev solo. As linhas abaixo ficam só como histórico; nenhum item deste épico será executado nesse formato.

### ✅ Concluídas (histórico)

| KAN | Descrição | Responsável |
|-----|-----------|-------------|
| KAN-31 | Projeto FastAPI base | Davi Bueno |

### 🔴 Pendentes (histórico — não serão mais feitas em Python)

| KAN | Descrição | Prioridade | Responsável | Observação |
|-----|-----------|------------|-------------|------------|
| KAN-32 | Endpoint de análise de vendas | Média | Davi Bueno | Obsoleto — refazer em C#, se necessário |
| KAN-33 | Endpoint de sugestões de estoque | Média | Davi Bueno | Obsoleto — refazer em C#, se necessário |
| KAN-34 | Integração com modelo de IA | Alta | Davi Bueno | Obsoleto — integração passa a ser via SDK Anthropic direto no backend C# |
| KAN-36 | Deploy em Azure | Baixa | Davi Bueno | Obsoleto — sem serviço Python separado para deployar |
| — | Integrar JWT do backend C# no módulo Python | Alta | Davi Bueno | Obsoleto — não há mais módulo Python separado |
| — | Mover módulo Python para o repositório | Alta | Davi Bueno | Obsoleto — não há mais módulo Python separado |

---

## Métricas & Dashboards (KAN-77)

> Fase 1 da camada de métricas determinística (DEC-20), que alimenta tanto os dashboards quanto a futura interpretação por IA. Implementada no backend C#, commit `87f54e6`, build verde e 51 testes xUnit passando. Complementada depois pelo bloco de rentabilidade (commit `5e82411`, ver KAN-69).

### ✅ Concluídas

| KAN | Descrição | Responsável |
|-----|-----------|-------------|
| KAN-78 | Métricas de Vendas (`GET /api/metrics/vendas`) — produto mais vendido (qtd/receita), ticket médio, receita por período | Davi Gomes |
| KAN-80 | Métricas de Estoque (`GET /api/metrics/estoque`) — giro, produtos parados >30 dias, ruptura iminente ≤7 dias | Davi Gomes |
| KAN-81 | Endpoint agregador de Dashboard (`GET /api/metrics/dashboard`) | Davi Gomes |
| — | Rentabilidade agregada (`GET /api/metrics/rentabilidade` + bloco `Rentabilidade` no `DashboardResponse`) — faturamento, custo, margem, margem %, ticket médio, nº de atendimentos concluídos no período | Davi Gomes (commit `5e82411`) |

### 🟡 Parcial

| KAN | Descrição | Responsável | Observação |
|-----|-----------|-------------|------------|
| KAN-79 | Métricas de Serviços (`GET /api/metrics/servicos`) | Davi Gomes | Receita por tipo de serviço e margem por atendimento (via rentabilidade) já entregues. Margem/hora e tempo médio por serviço seguem pendentes — dependem de um campo de duração ainda não modelado. |

> Multi-tenant aplicado via `EmpresaId` + `DeletedAt == null` em todas as queries (join via `Atendimento`, já que `ItemProduto`/`ItemServico` não têm `EmpresaId` próprio). Receita conta só atendimentos `Concluido`; movimentação de estoque conta itens de atendimentos não-`Cancelado`. Bloco Vendas soma `ItemProduto.Subtotal`; bloco Serviços soma `ItemServico.Subtotal` — nunca o `ValorTotal` do atendimento, para não duplicar receita entre os blocos (concretiza a separação venda/serviço da DEC-15). Revisão do @revisor corrigiu, antes do commit, um bug em que os joins com `Produtos`/`Servicos` não filtravam `DeletedAt == null` (produtos/serviços soft-deletados entrariam nas somas) — coberto pelo teste `GetVendas_IgnoraProdutoSoftDeletado`.

---

## Documentação & QA

### ✅ Concluídas

| KAN | Descrição | Responsável |
|-----|-----------|-------------|
| KAN-38 | Diagrama de Classes | Richard |

### 🔴 Pendentes

| KAN | Descrição | Prioridade | Responsável |
|-----|-----------|------------|-------------|
| KAN-39 | Documentação de API (Swagger/OpenAPI) | Média | Richard |
| KAN-40 | Documentação de deploy | Baixa | Richard |
| KAN-41 | Testes de integração ponta-a-ponta | Baixa | Richard |
| KAN-42 | Manual do usuário | Baixa | Richard |
| KAN-43 | Atualizar README | Média | Richard |
| — | Diagrama de Arquitetura (componentes) | Alta | Richard |
| — | Diagrama de Sequência (Atendimento Híbrido) | Alta | Richard |

---

## Frontend Web (React) — Módulo Dono

**Stack:** Vite + React 19 + TypeScript · Tailwind v4 (tokens do protótipo) · React Router · TanStack Query · MSW (mock enquanto não há banco/API no ar) · Recharts. Vive em `web/` no monorepo (`Agesto-Platform/Agesto`). Rodar: `cd web && npm install && npm run dev` (mock ligado via `.env`: `VITE_USE_MOCKS=true`). Login demo (mock): `dono@agesto.app` / `agesto123`. Decisões de stack e arquitetura registradas em DEC-25 (`DECISIONS.md`) e na seção 10 do `DESIGN.md`.

### ✅ Concluídas — fatia inicial navegável (integrada na `main`)

Tracking local (Jira offline); numeração `web-0x` mapeada aos KANs existentes.

| Task | KAN | Descrição | Commit |
|------|-----|-----------|--------|
| web-01 | KAN-45 | Scaffold (Vite+React+TS, Tailwind v4 + tokens do protótipo) | `ba21b1c` |
| web-02 | KAN-46 | App shell (sidebar, topbar, roteamento, design system base) | `65255bc` |
| web-03 | KAN-52 | Cliente de API tipado + React Query + camada de mock MSW | `3d1ae35` |
| web-04 | KAN-47 | Autenticação JWT (login, rota protegida, logout) | `68abfd1` |
| web-05 | KAN-48 | Dashboard "Visão geral" (KPIs, gráfico, rankings, alertas, tabela) | `46a3820` |
| web-06 | — | Fundação de CRUD (Drawer, DataTable, ConfirmDialog, fields, Toast, resource, MSW stateful) + **Clientes** | `00af71d` |
| web-07 | KAN-50 | CRUD de **Produtos** | `923a24f` |
| web-08 | KAN-51 | CRUD de **Serviços** (toggle TipoCobranca) | `a52ab55` |
| web-09 | — | **Agenda** — timeline agrupada por dia (endpoint enriquecido) | `bdf4c79` |
| web-10 | KAN-16* | **Orçamentos** — editor de itens, status, conversão em atendimento | `ae2f969` |
| web-11 | — | **Atendimentos** — itens/estoque/margem + dashboard honesto | `6c0e700` |
| web-12 | KAN-49 | **Parametrização** — modo de operação (TipoOperacao) | `d922b61` |
| web-13 | — | **Relatórios** — abas Rentabilidade/Serviços/Produtos/Estoque | `4576e25` |
| web-14 | KAN-53 | **Testes** — Vitest + Testing Library; suíte ampliada posteriormente para 21 testes | `cee7fb9` + evoluções posteriores |

> \*Épico Operação: numeração KAN a atribuir no Jira quando reconectar.

**Sidebar 100% funcional — nenhuma rota é mais placeholder.** Fluxo git: `feature/*` → `develop` → `main` (marcos).

### 🔴 Pendentes

| KAN | Descrição | Prioridade |
|-----|-----------|------------|
| — | Ampliar cobertura de testes (só a base foi coberta) | Baixa |
| — | Lazy-load do Recharts (bundle ~640kB) | Baixa |
| — | Trocar mocks pela API real quando o backend/DB subir (`VITE_USE_MOCKS=false`) | Alta |

### ✅ Deltas de backend resolvidos / pendentes

- **Últimos atendimentos** (dashboard): resolvido no front — `GET /api/atendimento` (real `AtendimentoResponse`) + join do nome do cliente no cliente. Não precisa mais do formato fictício.
- **Nome do cliente** em Orçamento/Atendimento: a API devolve só `clienteId`; o front junta com a lista de clientes. Se virar gargalo, expor `clienteNome` no backend.

> O frontend improvisado da apresentação foi **descartado**. Este é o front novo, com design original aprovado (protótipo `web-dono.html`), consumindo os endpoints reais via contrato espelhado no MSW. **Módulo Dono (web) essencialmente completo:** dashboard, auth, Cadastros (Clientes/Produtos/Serviços), Operação (Agenda/Orçamentos/Atendimentos) e Análise (Relatórios/Parametrização).

---

## Mobile (React Native) — App do Agente

**Status:** 🟢 Completo (mob-01 a mob-07) — integrado direto na `main` do monorepo `Agesto-Platform/Agesto`, em `mobile/`. Offline-first, action-first. Decisões de stack e arquitetura registradas em DEC-26 (`DECISIONS.md`) e na seção 11 do `DESIGN.md`.

**Stack:** React Native + TypeScript via Expo (prebuild) · Expo Router · tokens do protótipo (azul `#243FA6` + verde `#12B886`, tema claro) · tema + StyleSheet (não NativeWind) · `expo-sqlite` (device) / adapter em memória (Web/testes) atrás da interface `LocalDb` · cliente de API com camada de mock em código (`config.useMocks`) · JWT via `expo-secure-store`/`localStorage`. Login demo (mock): `agente@agesto.app` / `agesto123`.

### ✅ Concluídas — integradas na `main`

Tracking local (Jira offline); numeração `mob-0x`.

| Task | Descrição | Observação |
|------|-----------|------------|
| mob-01 | Scaffold Expo (prebuild) + RN + TypeScript + Expo Router; tokens do protótipo; tab bar (Início/Agenda/Atend./Clientes/Mais); estilo via theme + StyleSheet | — |
| mob-02 | Camada de dados offline: interface `LocalDb` (`src/db/types.ts`) com dois adapters — `expo-sqlite` (`index.native.ts`, device) e memória (`index.ts`, web/testes); guarda dados de referência + entidades offline com `SyncedAt` | — |
| mob-03 | Cliente de API (envelope + 401) com camada de mock em código (`config.useMocks`); login JWT com token via `expo-secure-store`/`localStorage`; guarda de rota; Carga popula o banco | — |
| mob-04 | Home action-first (CTA Registrar + agenda do dia Próximo/Ainda hoje) | Delta de backend: Carga não inclui a agenda — contornado com passo `syncAgenda` (`GET /api/atendimento/agenda` cacheado). Ver pendências abaixo |
| mob-05 | Registrar atendimento (núcleo): cliente + itens de catálogo por quantidade (contrato enxuto) + status → salva offline (pendente) | — |
| mob-06 | Clientes: lista referência + pendentes; cadastro rápido offline (`PendingCliente`) | Delta/limitação: atendimento offline não referencia cliente criado offline (sem id de servidor). Ver pendências abaixo |
| mob-07 | Descarga: empurra clientes/atendimentos pendentes → marca sincronizado; aba "Mais" com status de sync (pendentes, última sync, botão Sincronizar) + logout | — |
| — | Revisão própria (agente `revisor-frontend`, criado em `micro-erp-auto/.claude/agents/` para próximas sessões): corrigida invalidação de auth em 401 da API real (`src/lib/session.ts`) e guarda de desmontagem | — |

**Ciclo offline verificado no último marco:** login → Carga + syncAgenda → registrar atendimento offline → Descarga → sincronizado. A suíte cresceu para 29 testes Jest; typecheck e lint verdes. A validação em dispositivo Android/iOS físico continua pendente.

### 🔴 Pendências de backend geradas pelo Mobile

| Item | Descrição | Prioridade |
|------|-----------|------------|
| Agenda na Carga do sync | Ver seção "Domínio Prestador de Serviço" acima — a Carga deveria idealmente incluir a agenda, eliminando o contorno `syncAgenda` | Média |
| Mapear uuid→id do cliente na Descarga | Ver seção "Domínio Prestador de Serviço" acima — necessário para atendimento offline referenciar cliente criado offline | Média |

### 🔴 Pendências do próprio Mobile

| Item | Descrição | Prioridade |
|------|-----------|------------|
| Histórico de atendimentos próprios | Não implementado nesta fase (fora do escopo mob-01 a mob-07) | Baixa |
| Roteirização/geolocalização | Depende de lat/lng no `Cliente` (DEC-17), ainda pendente no backend | Média |
| Teste de componente RN | Adiado por incompatibilidade de versão (`@testing-library/react-native` v14 + jest-expo + React 19) | Baixa |
| Trocar mock pela API real | `config.useMocks = false` quando o backend/DB subir | Alta |
| Sincronização automática em background | Hoje só manual (aba "Mais") | Baixa |

---

## Ordem de execução recomendada (próximas sprints)

> O MVP possui backend, Web e Mobile funcionais contra mocks e publicados em `Agesto-Platform/Agesto`. Organização, time `Core`, CI e linha principal já estão configurados. Antes da infraestrutura, restam os rulesets, a auditoria documental e a formalização das responsabilidades e da propriedade intelectual. Depois disso, será provisionado um PostgreSQL novo, as migrations serão aplicadas em ambiente controlado e os clientes trocarão os mocks pela API real.

### Sprint imediata
1. Configurar rulesets em `develop` e `main` com PR, revisão e status checks
2. Concluir a auditoria de `REQUIREMENTS.md`
3. Formalizar propriedade das contribuições e responsabilidades definitivas por módulo
4. Depois da auditoria, remover a documentação legada em tarefa separada
5. **Provisionar PostgreSQL novo e aplicar migrations pendentes** em ambiente controlado
6. Subir a API real e desligar os mocks no Web e no Mobile
7. Executar testes integrados com Web, Mobile, API e PostgreSQL reais

### Sprint seguinte
8. Débitos residuais: margem/hora do KAN-79 (após campo de duração), roteirização/lat-lng (DEC-17), descarga de Orçamento no sync, agenda na Carga do sync mobile, mapear uuid→id do cliente na Descarga mobile, paginação no `GetAllAsync`, lazy-load do Recharts e sincronização automática em background

---

## Convenções de commit

```
feat(escopo): descrição curta (KAN-XX)
fix(escopo): descrição curta (KAN-XX)
docs(escopo): descrição curta
chore(escopo): descrição curta
test(escopo): descrição curta
refactor(escopo): descrição curta
```

Exemplos reais do projeto:
```
feat(empresa): add Empresa entity + multi-tenant refactor (KAN-56)
feat(config): remove BYOK fields from Configuracao (KAN-58)
feat(servico): add empreitada billing type (KAN-62)
feat(db): aplica migration InitialCreate no Supabase (KAN-29)
fix(stock): integrate stock control into sales flow (DEC-11)
feat(config): add Configuracao controller, service and repository (KAN-59)
refactor(enums): convert TipoOperacao and StatusAtendimento to enum (DEC-08)
feat(sync): add mobile sync endpoints - carga e descarga (KAN-60)
fix(auth): fix empresaId extraction for multi-tenant isolation (KAN-63)
feat(metrics): add sales, stock, services and dashboard metrics endpoints (KAN-77)
feat(orcamento): add Orcamento entity, CRUD and conversion to Atendimento (KAN-69/DEC-16)
feat(item): generic catalog/avulso item with cost and editable price (KAN-72/DEC-18/19/22/23)
feat(agenda): add DataAgendada, agenda endpoint and TryGetPerfil (KAN-69/DEC-17)
feat(insights): enrich agenda, add rentabilidade metrics and orcamentos na carga (KAN-69)
```
