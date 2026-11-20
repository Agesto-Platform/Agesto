# Agesto — Project Overview

> Formerly called "Micro-ERP Auto" (renamed on 04/08/2026, see DEC-24 in `DECISIONS.md`).

## What it is

An integrated **Web + Mobile** management system for micro-entrepreneurs and self-employed service providers. It works as a simplified ERP on the Web and as a sales/service force app on Mobile.

## Who it is for

| Profile | Example | How they use it |
|--------|---------|----------|
| Small retailer | Candy seller, informal shop | Records sales in the field, controls stock |
| Service provider | AC technician, installer | Records atendimentos (service visits) and services provided |
| Self-employed with a team | Technician with agents in the field | Manages the team, sees a consolidated dashboard |

At the MVP launch (15/12/2026, DEC-46) the focus is the service provider, alone or with a small team. The small retailer comes later.

## What problem it solves

Most ERPs on the market target medium and large companies — complex and expensive. Micro-entrepreneurs are left without a suitable solution and run their business on spreadsheets or on paper.

Agesto offers:
- A simple interface, designed for use in the field
- **Offline-first** operation on Mobile (no internet)
- Automatic synchronization when the app opens, when the user returns to it and when the internet comes back, plus the Sincronizar (Sync) button
- Support for selling products, providing services or both (hybrid mode)

## System structure

```
┌─────────────────────────────────────────────────────────┐
│  Web Module (ERP/Management) — Dono (Owner) Module      │
│  React + TypeScript                                      │
│  → Dashboard, reports, records, settings                │
└─────────────────────────────────────────────────────────┘
                          ↕ REST API (JWT)
┌─────────────────────────────────────────────────────────┐
│  Main Backend                                            │
│  ASP.NET Core .NET 10 (C#) + Entity Framework Core     │
│  PostgreSQL on Supabase, N. Virginia (DEC-32)            │
│  Native AI in the C# backend — in production (DEC-21)    │
└─────────────────────────────────────────────────────────┘
                          ↕ REST API (JWT)
┌─────────────────────────────────────────────────────────┐
│  Mobile Module (Field Agent App) — complete              │
│  React Native (Expo) + local expo-sqlite (offline-first) │
│  → Atendimentos, clients, schedule, synchronization      │
└─────────────────────────────────────────────────────────┘
```

> The AI runs **inside the C# backend** (official Anthropic SDK), not as a separate Python/FastAPI service — decision revised in DEC-21. The original design with an isolated Python module is obsolete (see `DECISIONS.md`/`TASKS.md`).

## Defined stack

| Layer | Technology |
|--------|-----------|
| Web Frontend (Dono Module) | Vite + React 19 + TypeScript, Tailwind v4, TanStack Query, MSW (mocks only in dev), Recharts, Leaflet |
| Backend Core | C# — ASP.NET Core .NET 10 + Entity Framework Core |
| Database | PostgreSQL on Supabase, N. Virginia region (DEC-32) |
| Mobile (Agent App) | React Native + TypeScript (Expo/prebuild), Expo Router, offline-first `expo-sqlite` |
| AI Module | Built into the C# backend, via the official Anthropic Claude SDK (DEC-21), default model Claude Haiku 5.5 — there is no longer a separate Python service |
| Authentication | JWT (HMAC-SHA256, claims: sub, email, jti, empresaId, perfil), valid for 30 days (DEC-50); account lockout after 5 wrong passwords (DEC-43). Superadmin area with its own JWT audience (DEC-52) |
| Cloud | API on Render, web on Cloudflare Pages, database on Supabase (DEC-32) |
| Tests | Backend: xUnit + Moq + EF Core InMemory/SQLite (346 tests). Web: Vitest + Testing Library (80 tests). Mobile: Jest/jest-expo (119 tests) — `develop` CI, 11/11/2026 |
| Version control | Git + Gitflow |

## Team

| Member | Role | Main responsibility | GitHub |
|--------|-------|---------------------------|--------|
| Davi Gomes Rocha | Founder and Product Owner | Product, priorities and mobile app; overall coordination | `falkz-cmd` — Owner |
| Davi Oliveira | Cofounder | Dono web and general tasks (backend, tests, support) | `ghzpro034` — Member, with Admin permission on the repository (checked on 10/11/2026) |
| Diego | Cofounder | Infrastructure, DevOps, APK publishing and redesign | `Depowo` — Owner |

Split revised on 22/10/2026 for the MVP launch (DEC-46); each person's tasks are in `TASKS.md`, section "Lançamento do MVP". All three are in the visible team `@Agesto-Platform/core`. The roles show the initial focus and do not prevent cross-contributions. The contributions of the original academic team remain preserved in the Git history, but do not represent the current team.

## Current status

- **Phase:** MVP in production (real API, database and web, DEC-32), developed as a team. Heading to the official launch: dress rehearsal on 03/11, pilot with a real customer from 04/11 to 28/11 and launch on 15/12/2026, for the service provider with a small team, Android-only app via APK (DEC-46, DEC-47)
- **Main branch:** `main` (repository `Agesto-Platform/Agesto`). `main` is production (Render and Cloudflare Pages deploy `main` after CI) and received its latest promotion on 11/11/2026 (release #134); `develop` is for integration and local testing (DEC-41)
- **Repository:** [`Agesto-Platform/Agesto`](https://github.com/Agesto-Platform/Agesto) — its own repo, **public** (portfolio + commercial, restrictive license; see DEC-24). The original academic repo `github.com/Auto-academic-erp/micro-erp-auto` remains as abandoned legacy. Keeping the repository public is a decision to revisit before the launch (DEC-46).
- **Database:** Supabase in N. Virginia, with the single `InitialCreate` (DEC-31) and the following migrations applied (latest: `AddBloqueioLoginExclusaoLgpdDuracaoServico`, 11/11/2026); API and database kept awake by the Cloudflare Worker `agesto-keepalive` (`deploy/README.md`, section 6); automatic backup still pending (DEC-34)
- **Tests:** backend 346, web 80 and mobile 119 tests passing in the `develop` CI (11/11/2026)
- **Web Frontend (Dono Module):** essentially complete — 14 tasks (web-01 to web-14) integrated into `main`, **sidebar 100% functional**, covering dashboard, authentication, Cadastros (Clientes/Produtos/Serviços), Operação (Agenda/Orçamentos/Atendimentos) and Análise (Relatórios/Parametrização), consuming the real API in production (MSW only in local development). It later gained user management (DEC-35), review of services created in the app (DEC-36) and the schedule map (DEC-38). Base tests (Vitest) covering masks, period, store, Money and ClienteForm. See DEC-25 in `DECISIONS.md` and section 10 of `DESIGN.md`.
- **Mobile (Agent App):** offline-first and action-first MVP in `mobile/`: JWT login, Carga (download), schedule, recording/scheduling atendimentos, quick client registration, suggested materials, Descarga (upload) and sync status. Runs against the real API; it later gained reliable sync (DEC-33), service registration in the app (DEC-36), the day's route (DEC-37) and atendimento on par with the web (DEC-39). 77 Jest tests, typecheck and lint green. The schedule delta in the Carga is still left.
- **AI (DEC-21):** in production since 10/11/2026 for testing with the test accounts: insights report (`POST /api/insights`) and the Agente panel chat on the web (`POST /api/agente/perguntar`), with Claude Haiku 5.5. Out of scope for the launch (DEC-46) until a new decision; the panel keeps the "Prévia" (Preview) badge.
- **Superadmin area (DEC-52):** in production since 10/11/2026 at `/admin`, for the Agesto team to manage companies, users and team, with auditing.
- **October batch (DEC-43 to DEC-45):** account lockout after wrong passwords, deletion of one's own account with anonymization, and revenue per hour per service, in production since 11/11/2026.
- **Parametrização (settings, DEC-27):** two parameters per Empresa in `Configuracao`, end to end (backend + Carga + web + mobile) — `ModoAgendaAgente` (`Flexivel`/`Fixa`: whether the agent can schedule in the field) and `ControlaEstoque` (turns stock deduction and validation on/off, for the pass-through provider). Editable by the Dono in Parametrização (web); propagated to mobile through the Carga. 8 tasks (param-01 to param-08) integrated into `main`, reviewed (backend + frontend, approved). Tests: backend 83, mobile 25, web 17 — green. The schedule now includes the `Configuracao`; the offline contract gained `DataAgendada`; `Fixa` is enforced by the server in the Descarga.
- **Suggested materials kit (DEC-28):** suggested materials per Serviço (`ServicoItemSugerido`), end to end. The Dono builds the kit on the Serviço screen; 1-click suggestion in the Orçamento and Atendimento (web) and a 1-tap chip when recording (mobile, offline via Carga); shortcut "salvar materiais como sugeridos" (save materials as suggested) from an atendimento. 6 tasks (kit-01 to kit-06) in `main`. Tests: backend 90, mobile 29, web 17 — green.

## Differentiators

- Exclusive focus on **micro-entrepreneurs and the self-employed**
- **Offline-first** — works without internet in the field (implemented on Mobile, see DEC-26)
- Support for **multiple modes**: Sales, Service or Hybrid (current focus on the Service Provider — DEC-15)
- **Multi-agent** — the owner manages a team of agents in the field
- **Native AI** for business insights (built into the C# backend, DEC-21) — in production for testing since 10/11/2026, out of the MVP launch (DEC-46) until a new decision
