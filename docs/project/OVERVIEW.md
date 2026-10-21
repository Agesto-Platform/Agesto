# Agesto — Visão Geral do Projeto

> Antes chamado "Micro-ERP Auto" (renomeado em 04/08/2026, ver DEC-24 em `DECISIONS.md`).

## O que é

Sistema integrado **Web + Mobile** de gestão para microempreendedores e prestadores de serviço autônomos. Funciona como um ERP simplificado no Web e um aplicativo de força de vendas/serviços no Mobile.

## Para quem é

| Perfil | Exemplo | Como usa |
|--------|---------|----------|
| Pequeno comerciante | Vendedor de doces, loja informal | Registra vendas em campo, controla estoque |
| Prestador de serviço | Técnico de AC, instalador | Registra atendimentos e serviços prestados |
| Autônomo com equipe | Técnico com agentes em campo | Gerencia equipe, vê dashboard consolidado |

## Qual problema resolve

A maioria dos ERPs do mercado é voltada para médias e grandes empresas — complexos e caros. Microempreendedores ficam sem solução adequada e gerenciam o negócio em planilhas ou no papel.

O Agesto oferece:
- Interface simples, pensada para uso em campo
- Funcionamento **offline-first** no Mobile (sem internet)
- Sincronização manual implementada; automação quando a conexão voltar está planejada
- Suporte a venda de produtos, prestação de serviços ou ambos (modo híbrido)

## Estrutura do sistema

```
┌─────────────────────────────────────────────────────────┐
│  Módulo Web (ERP/Gestão) — Módulo Dono                  │
│  React + TypeScript                                      │
│  → Dashboard, relatórios, cadastros, configurações      │
└─────────────────────────────────────────────────────────┘
                          ↕ API REST (JWT)
┌─────────────────────────────────────────────────────────┐
│  Backend Principal                                       │
│  ASP.NET Core .NET 10 (C#) + Entity Framework Core     │
│  PostgreSQL — provedor da nova infraestrutura a definir  │
│  IA nativa no backend C# — planejada (DEC-21)            │
└─────────────────────────────────────────────────────────┘
                          ↕ API REST (JWT)
┌─────────────────────────────────────────────────────────┐
│  Módulo Mobile (App do Agente de Campo) — completo       │
│  React Native (Expo) + expo-sqlite local (offline-first) │
│  → Atendimentos, clientes, agenda, sincronização         │
└─────────────────────────────────────────────────────────┘
```

> A IA roda **dentro do backend C#** (SDK oficial da Anthropic), não como serviço Python/FastAPI separado — decisão revisada na DEC-21. O design original com um módulo Python isolado está obsoleto (ver `DECISIONS.md`/`TASKS.md`).

## Stack definida

| Camada | Tecnologia |
|--------|-----------|
| Frontend Web (Módulo Dono) | Vite + React 19 + TypeScript, Tailwind v4, TanStack Query, MSW (mock só em dev), Recharts, Leaflet |
| Backend Core | C# — ASP.NET Core .NET 10 + Entity Framework Core |
| Banco de Dados | PostgreSQL no Supabase, região N. Virginia (DEC-32) |
| Mobile (App do Agente) | React Native + TypeScript (Expo/prebuild), Expo Router, `expo-sqlite` offline-first |
| Módulo IA | Embutido no backend C#, via SDK oficial Anthropic Claude (DEC-21) — não há mais serviço Python separado |
| Autenticação | JWT (HMAC-SHA256, 120min, claims: sub, email, jti, empresaId, perfil) |
| Nuvem | API no Render, web na Cloudflare Pages, banco no Supabase (DEC-32) |
| Testes | Backend: xUnit + Moq + EF Core InMemory/SQLite (261 testes). Web: Vitest + Testing Library (33 testes). Mobile: Jest/jest-expo (77 testes) — CI da `develop`, 21/10/2026 |
| Versionamento | Git + Gitflow |

## Time

| Membro | Papel | Responsabilidade principal | GitHub |
|--------|-------|---------------------------|--------|
| Davi Gomes Rocha | Founder e Product Owner | Produto, prioridades, arquitetura e coordenação técnica | `falkz-cmd` — Owner |
| Depowo | Cofounder | Infraestrutura, DevOps e continuidade operacional | `Depowo` — Owner |
| ghzpro034 | Cofounder | Desenvolvimento generalista em backend, web e mobile | `ghzpro034` — Member/Write |

Os três integram o time visível `@Agesto-Platform/core`. Os papéis indicam o foco inicial, sem impedir contribuições cruzadas. As contribuições do time acadêmico original permanecem preservadas no histórico Git, mas não representam a composição atual.

## Status atual

- **Fase:** MVP em produção (API, banco e web reais, DEC-32), em desenvolvimento em equipe
- **Branch principal:** `main` (repositório `Agesto-Platform/Agesto`). A `develop` é publicada no Render depois do CI e concentra os marcos de outubro/2026, ainda não promovidos para a `main`
- **Repositório:** [`Agesto-Platform/Agesto`](https://github.com/Agesto-Platform/Agesto) — repo próprio, **público** (portfólio + comercial, licença restritiva; ver DEC-24). O acadêmico original `github.com/Auto-academic-erp/micro-erp-auto` fica como legado abandonado.
- **Banco:** Supabase em N. Virginia, com a `InitialCreate` única (DEC-31) e as migrations seguintes aplicadas; backup automático ainda pendente (DEC-34)
- **Testes:** backend 261, web 33 e mobile 77 testes passando no CI da `develop` (21/10/2026)
- **Frontend Web (Módulo Dono):** essencialmente completo — 14 tasks (web-01 a web-14) integradas na `main`, **sidebar 100% funcional**, cobrindo dashboard, autenticação, Cadastros (Clientes/Produtos/Serviços), Operação (Agenda/Orçamentos/Atendimentos) e Análise (Relatórios/Parametrização), consumindo a API real em produção (MSW só em desenvolvimento local). Depois ganhou gestão de usuários (DEC-35), revisão de serviços criados no app (DEC-36) e mapa da agenda (DEC-38). Testes base (Vitest) cobrindo masks, período, store, Money e ClienteForm. Ver DEC-25 em `DECISIONS.md` e seção 10 do `DESIGN.md`.
- **Mobile (App do Agente):** MVP offline-first e action-first em `mobile/`: login JWT, Carga, agenda, registro/agendamento de atendimento, cadastro rápido de cliente, materiais sugeridos, Descarga e status de sincronização. Roda contra a API real; depois ganhou sync confiável (DEC-33), cadastro de serviço no app (DEC-36), rota do dia (DEC-37) e atendimento no nível do web (DEC-39). 77 testes Jest, typecheck e lint verdes. Resta o delta da agenda na Carga.
- **Parametrização (DEC-27):** dois parâmetros por Empresa na `Configuracao`, ponta a ponta (backend + Carga + web + mobile) — `ModoAgendaAgente` (`Flexivel`/`Fixa`: se o agente pode agendar em campo) e `ControlaEstoque` (liga/desliga baixa e validação de estoque, para o prestador pass-through). Editáveis pelo Dono em Parametrização (web); propagados ao mobile pela Carga. 8 tasks (param-01 a param-08) integradas na `main`, revisadas (backend + frontend, aprovados). Testes: backend 83, mobile 25, web 17 — verdes. Agenda passou a incluir a `Configuracao`; contrato offline ganhou `DataAgendada`; `Fixa` com enforcement de servidor na Descarga.
- **Kit de materiais sugeridos (DEC-28):** materiais sugeridos por Serviço (`ServicoItemSugerido`), ponta a ponta. Dono monta o kit na tela de Serviço; sugestão em 1 clique no Orçamento e Atendimento (web) e chip em 1 toque no registrar (mobile, offline via Carga); atalho "salvar materiais como sugeridos" a partir de um atendimento. 6 tasks (kit-01 a kit-06) na `main`. Testes: backend 90, mobile 29, web 17 — verdes.

## Diferencial

- Foco exclusivo em **microempreendedores e autônomos**
- **Offline-first** — funciona sem internet no campo (implementado no Mobile, ver DEC-26)
- Suporte a **múltiplos modos**: Venda, Serviço ou Híbrido (foco atual no Prestador de Serviço — DEC-15)
- **Multi-agente** — dono gerencia equipe de agentes em campo
- **IA nativa** para insights de negócio (planejada, embutida no backend C#, DEC-21) — ainda não implementada
