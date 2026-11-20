# Agesto

**ERP for self-employed service providers** — quote, schedule, execution and billing in a single flow, built for use in the field.

> Name from *agere* (to act/operate) + *gestio* (management). Formerly called "Micro-ERP Auto".

![.NET](https://img.shields.io/badge/.NET-10.0-512BD4)
![EF Core](https://img.shields.io/badge/EF%20Core-10.0-512BD4)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Npgsql-336791)
![Backend tests](https://img.shields.io/badge/backend%20tests-346%20passing-2EA043)
![Web tests](https://img.shields.io/badge/web%20tests-80%20passing-2EA043)
![Mobile tests](https://img.shields.io/badge/mobile%20tests-119%20passing-2EA043)
![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial-orange)

---

## The problem

Most ERPs are made for medium/large companies — expensive and complex. The self-employed service provider (air conditioning technician, installer, electrician) ends up running the business on paper or in spreadsheets. Agesto delivers the essentials, designed for people who work **in the field, often without internet**.

## Product focus

The backbone is the service life cycle:

```
Orçamento  →  Agendamento  →  Atendimento (execução)  →  Cobrança
(quote)       (scheduling)    (service visit)            (billing)
```

Product sales exist as a secondary feature (a "plus"), enabled according to the company's operation mode (Service, Sales or Hybrid).

## Technical highlights

- **Multi-tenant** — isolation by `EmpresaId` derived from the JWT (never from the body); every query filters by company.
- **Offline-first** — the field app works without a network; sync through *Carga/Descarga* (download/upload) with last-write-wins resolution, sending per atendimento and pending items preserved when something fails (DEC-33).
- **Deterministic metrics layer** — numbers (revenue, margin, stock) are aggregated in the database; the **native AI** only interprets these numbers, never computes them.
- **Margin per atendimento** — cost filled in by the provider; `Margem = ValorTotal − CustoTotal`.
- **Transactional conversion** of a quote into an atendimento (stock deduction only at conversion).
- **Soft delete** across the whole domain (`DeletedAt`), never a physical DELETE.

## Architecture

```
Controller  →  Service (interface)  →  Repository (interface)  →  AppDbContext (EF Core)
```

- `sealed` layers, injection by interface (`AddScoped`).
- Standardized response envelope `ApiResponse { Success, Message, Data, Errors }`.
- Enums persisted as strings (`HasConversion<string>()`).

| Layer | Technology |
|--------|-----------|
| Backend | C# ASP.NET Core .NET 10 + Entity Framework Core 10 |
| Database | PostgreSQL (Npgsql) |
| AI | Built into the C# backend (official Anthropic SDK, Claude Haiku 5.5), in testing since 10/11/2026 (DEC-21) |
| Web (owner) | React 19 + TypeScript + Vite + Tailwind + TanStack Query |
| Mobile (field agent) | React Native + Expo + SQLite, offline-first |
| Auth | Multi-tenant JWT (claims `empresaId`, `sub`, `perfil`), revalidated against the database on every request |
| Tests | xUnit + Moq + EF Core InMemory/Sqlite · Vitest (web) · Jest (mobile) |
| Hosting | API on Render · PostgreSQL on Supabase (N. Virginia) · Web on Cloudflare Pages (DEC-32) |

## Status

> MVP in production: real API, database and web, with mocks turned off on the web and in the app. `main` is production: Render and Cloudflare Pages deploy `main` after CI passes; `develop` is for integration and local testing (DEC-41). `main` only receives changes through promotions from `develop` (`release: … (develop → main)` PRs).

| Area | State |
|------|--------|
| Backend (provider domain) | 🟢 In production on .NET 10 (DEC-40) — **346 tests passing** (`develop` CI, 11/11/2026) |
| Infrastructure | 🟢 Render + Supabase + Cloudflare Pages, deploy driven by CI (DEC-32); process in [`deploy/README.md`](deploy/README.md) |
| Security | 🟢 Audit applied and validated in production: rate limit, closed sign-up, token revocation, RLS and client LGPD (DEC-34); account lockout after wrong passwords (DEC-43) and account deletion with anonymization (DEC-44) |
| Metrics layer + profitability | 🟢 Implemented |
| Quote / Scheduling / Margin | 🟢 Implemented |
| Agent users and atendimento's responsible person | 🟢 Managed by the Dono on the web, email invitation to create the password (DEC-35, DEC-55) |
| Service registered from the app | 🟢 Agent creates it offline, Dono reviews it on the web (DEC-36) |
| Route and map | 🟢 Phase 1: the day's route in Google Maps and the schedule map on the web (DEC-37 and DEC-38) |
| Native AI (insights and Agente chat) | 🟡 In production for testing, out of the launch (DEC-21, DEC-46) |
| Superadmin area (`/admin`) | 🟢 The Agesto team manages companies, users and team, with auditing (DEC-52) |
| Web Frontend | 🟢 In production against the real API — **80 tests** |
| Mobile | 🟢 Offline-first against the real API, atendimento on par with the web (DEC-39) — **119 tests** |

**Next steps:** automatic database backup; email verification before reopening sign-up; "Otimizar dia" (route phase 2). Full list in [`docs/project/TASKS.md`](docs/project/TASKS.md).

## Documentation and contributing

- [Product vision and documentation](docs/project/README.md)
- [How to contribute](CONTRIBUTING.md)
- [Rules for agents and automations](AGENTS.md)

The team flow is `feature/* → develop → main`. Changes go in through pull requests and `main` only receives reviewed milestones with the relevant checks green.

## Running the backend

> Prerequisites: .NET 10 SDK and a reachable PostgreSQL.

```bash
git clone https://github.com/Agesto-Platform/Agesto.git
cd Agesto/MicroERP.Api

# set up local secrets (NOT versioned)
cp appsettings.Development.json.example appsettings.Development.json
# edit: Postgres connection string + a JWT key (min. 32 bytes)

dotnet tool install -g dotnet-ef   # once; version 10.x
dotnet ef database update   # creates the schema
dotnet run                  # Swagger at http://localhost:5xxx/swagger
```

Run the tests:

```bash
dotnet test MicroERP.sln
```

## License

**PolyForm Noncommercial 1.0.0** — the code can be read, studied and used for **noncommercial** purposes (study, research, evaluation). Commercial use is reserved to the author. See [`LICENSE`](LICENSE).

> Internal identifiers still use the `MicroERP.*` namespace (the project's previous name); renaming to `Agesto.*` is a mechanical refactor postponed on purpose.

## Origin

The project started as an academic assignment and evolved into a product developed by the founding team: **Davi Gomes Rocha** (Founder and Product Owner), **Depowo** (Cofounder, initial focus on infrastructure) and **ghzpro034** (Cofounder, generalist role). Technical governance uses the [`Agesto-Platform`](https://github.com/Agesto-Platform) organization and the `Core` team.
