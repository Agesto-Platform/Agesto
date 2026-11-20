# Agesto — Design and Architecture

## 1. Overall Architecture

The system follows a classic layered architecture on the backend, with a clear separation between modules:

```
┌─────────────────┐     ┌─────────────────┐
│   Web (React)   │     │ Mobile (RN+SQLite│
│   localhost:5173│     │   offline-first) │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │     HTTPS + JWT        │ HTTPS + JWT
         ▼                       ▼
┌─────────────────────────────────────────┐
│         Backend ASP.NET Core .NET 10    │
│                                         │
│  Controllers → Services → Repositories  │
│              ↓                          │
│         AppDbContext (EF Core)          │
└─────────────────┬───────────────────────┘
                  │
                  ▼
        ┌──────────────────────┐
        │ PostgreSQL           │
        │ Supabase (DEC-32)    │
        └──────────────────────┘
```

> The native AI is implemented inside the C# backend (DEC-21), through the official Anthropic SDK: `POST /api/insights` and the `POST /api/agente/perguntar` chat, in production since 10/11/2026. The original Python design remains only as history in section 6. The offline-first Mobile was implemented — see section 11.

---

## 2. Layered Architecture (C# Backend)

### Responsibilities

| Layer | Responsibility | Rule |
|--------|-----------------|-------|
| `Controllers` | Receive HTTP, extract the JWT, return the response | Contains no business rules |
| `Services` | Business rules, validation, DTO↔Entity mapping | Does not access the database directly |
| `Repositories` | Database queries through EF Core | Contains no business rules |
| `AppDbContext` | Model configuration, relationships, indexes | — |

### Mandatory patterns
- Every dependency injected through an interface (`IClienteService`, `IClienteRepository`, etc.)
- Registered as `AddScoped` in `Program.cs`
- `usuarioId` and `empresaId` always extracted from the JWT in the Controller, never from the body
- Entities never leave through the Controllers — always DTOs
- Soft delete through `DeletedAt` — never a physical `DELETE` on operational entities

### JWT extraction in the Controllers
All authenticated controllers use the `TryGetUsuarioId` method:

```csharp
private bool TryGetUsuarioId(out long usuarioId)
{
    usuarioId = 0;
    var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub)
        ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
    return long.TryParse(sub, out usuarioId);
}
```

> **Debt resolved:** the `TryGetEmpresaId`, `TryGetUsuarioId` and `TryGetPerfil` methods live in the `ApiControllerBase` base class. The superadmin area uses `AdminControllerBase`, with `TryGetAdminId` (DEC-52).

---

## 3. Data Model

### 3.1 Entities and Relationships

```
Empresa 1 ──── * Usuario
Empresa 1 ──── 1 Configuracao
Empresa 1 ──── * Cliente
Empresa 1 ──── * Produto
Empresa 1 ──── * Servico
Empresa 1 ──── * Atendimento

Usuario  1 ──── * Atendimento   (agent who recorded it)
Cliente  1 ──── * Atendimento

Atendimento 1 ──── * ItemProduto
Atendimento 1 ──── * ItemServico
Produto     1 ──── * ItemProduto
Servico     1 ──── * ItemServico
```

### 3.2 Entities

> Summarized model. The source is `MicroERP.Api/Models/` and `AppDbContext`, which already have entities and fields that do not show up here: `Orcamento`/`ItemOrcamento` (DEC-16), `ServicoItemSugerido` (DEC-28), `AdminPlataforma`/`AuditoriaAdmin` and `Empresa.Ativa` (DEC-52), `Usuario.Ativo`, `DeletedAt`, `BloqueadoAte` and `TentativasLoginFalhas` (DEC-35, DEC-43, DEC-44) and `Servico.DuracaoMinutos` (DEC-45).

#### `Empresa`
```
Id, Nome, Documento?, CreatedAt, UpdatedAt
Navigations: Usuarios[]
```

#### `Usuario`
```
Id, Nome, Email (unique), Senha (hash), EmpresaId (FK),
Perfil (enum: Dono|Agente), CreatedAt, UpdatedAt
```

#### `Configuracao`
```
Id, EmpresaId (unique FK — 1:1 with Empresa),
TipoOperacao (string enum: Venda|Servico|Hibrido),
CreatedAt, UpdatedAt
```

#### `Cliente`
```
Id, Uuid, Nome, Telefone?, Cpf (unique per EmpresaId),
EmpresaId (FK), CreatedAt, UpdatedAt, SyncedAt?, DeletedAt?
```

#### `Produto`
```
Id, Uuid, Nome, Preco (decimal 12,2), QuantidadeEstoque,
EmpresaId (FK), CreatedAt, UpdatedAt, SyncedAt?, DeletedAt?
```

#### `Servico`
```
Id, Uuid, Descricao,
TipoCobranca (string enum: PorHora|Empreitada),
ValorHora? (decimal 12,2), ValorEmpreitada? (decimal 12,2),
EmpresaId (FK), CreatedAt, UpdatedAt, SyncedAt?, DeletedAt?
Rule: TipoCobranca=PorHora requires ValorHora; Empreitada requires ValorEmpreitada
```

#### `Atendimento`
```
Id, Uuid, DataRegistro, Status (string enum: Pendente|Concluido|Cancelado),
ValorTotal (decimal 12,2 — computed),
EmpresaId (FK), UsuarioId (FK — agent who recorded it), ClienteId (FK),
CreatedAt, UpdatedAt, SyncedAt?, DeletedAt?
```

#### `ItemProduto`
```
Id, Uuid, Quantidade, PrecoUnitario (snapshot), Subtotal,
AtendimentoId (FK), ProdutoId (FK),
CreatedAt, UpdatedAt, SyncedAt?, DeletedAt?
Subtotal = Quantidade × PrecoUnitario
```

#### `ItemServico`
```
Id, Uuid, Quantidade, PrecoUnitario (snapshot), Subtotal,
AtendimentoId (FK), ServicoId (FK),
CreatedAt, UpdatedAt, SyncedAt?, DeletedAt?
Subtotal = ValorEmpreitada (if Empreitada) | Quantidade × ValorHora (if PorHora)
```

### 3.3 Relevant indexes

| Table | Index | Type |
|--------|--------|------|
| Usuarios | Email | Unique |
| Clientes | (EmpresaId, Cpf) | Composite unique |
| Clientes | Uuid | Unique |
| Configuracoes | EmpresaId | Unique |
| Produtos | Uuid | Unique |
| Servicos | Uuid | Unique |
| Atendimentos | Uuid | Unique |
| ItemProdutos | Uuid | Unique |
| ItemServicos | Uuid | Unique |

### 3.4 Offline-first fields
Entities handled by Mobile have:
- `Uuid` — generated on the device, identifies the record before sync
- `SyncedAt?` — null = not synced yet
- `DeletedAt?` — soft delete, needed to communicate deletions during sync

---

## 4. Authentication and Authorization

### JWT
```
Claims: sub (usuarioId), email, jti (unique per token),
        empresaId, perfil
Algorithm: HMAC-SHA256
Expiration: 30 days (43200 minutes, DEC-50); deactivating the user revokes it earlier
ClockSkew: 2 minutes
```

### Sign-up flow (Option A — MVP)
```
POST /api/auth/register
  → Creates Empresa (with NomeEmpresa from the request)
  → Creates Usuario (Perfil=Dono, EmpresaId)
  → Creates default Configuracao (TipoOperacao=Servico, EmpresaId — DEC-15)
```

---

## 5. Code Patterns

### Naming
- Entities: singular PascalCase (`Cliente`, `ItemProduto`)
- DbSets: plural (`Clientes`, `ItemProdutos`)
- Interfaces: `I` prefix (`IClienteService`, `IClienteRepository`)
- Enums: in the `Enums/` folder, saved as strings in the database through `HasConversion<string>()`
- DTOs: purpose suffix (`ClienteCreateRequest`, `ClienteResponse`)

### Existing enums
```csharp
// Enums/PerfilUsuario.cs
public enum PerfilUsuario { Nenhum, Dono, Agente } // Nenhum = 0 avoids falling into Dono by mistake

// Enums/TipoCobranca.cs
public enum TipoCobranca { PorHora, Empreitada }
```

### Other enums (already existing, persisted as strings)
```csharp
// Enums/TipoOperacao.cs — Configuracao.TipoOperacao (DEC-08)
public enum TipoOperacao { Venda, Servico, Hibrido }

// Enums/StatusAtendimento.cs — Atendimento.Status (DEC-08)
public enum StatusAtendimento { Pendente, Concluido, Cancelado }

// Also in Enums/: ModoAgendaAgente (DEC-27) and StatusOrcamento (DEC-16)
```

### Standard API response
```csharp
public sealed class ApiResponse
{
    public bool Success { get; set; }
    public string Message { get; set; }
    public object? Data { get; set; }
    public IReadOnlyList<string> Errors { get; set; }
}
```

### Folder structure (Backend)
```
MicroERP.Api/
├── Controllers/
├── Data/
│   └── AppDbContext.cs
├── DTOs/
├── Enums/
├── Migrations/
├── Models/
├── Repositories/
│   └── Interfaces/
└── Services/
    ├── Exceptions/
    └── Interfaces/
```

---

## 6. AI Module (Python + FastAPI) — original design, obsolete (see DEC-21)

> **Obsolete:** this section describes the original planned design. DEC-21 resolved this decision in favor of the AI running **inside the C# backend**, through the official Anthropic SDK — not as a separate Python/FastAPI service. Kept as history.

### Principles
- AI native to the product — not configurable by the customer
- Isolation through `empresaId` in every query — never mixes data
- Read-only in the MVP — never changes data
- Sensitive data masked before being sent to the model (CPF, etc.)
- Free-form SQL generated by the model is not allowed — only controlled functions

### Integration with the C# Backend (planned, obsolete)
- Validates the same JWT generated by the C# backend
- `empresaId` always extracted from the token, never from the body
- Direct HTTP communication with Anthropic Claude (no community SDK)

### Internal architecture (planned, obsolete)
```
FastAPI → AgentRunner → ILLMProvider (Anthropic)
                     → IToolRegistry (controlled read functions)
                     → SystemPromptBuilder
                     → ITokenBudgetGuard
```

---

## 7. Mobile Synchronization

### Endpoints (KAN-60, implemented)
```
GET  /api/sync/carga?ultimaSincronizacao={datetime}
     → Returns: clients, products, services updated since the date
       (mobile calls it without the parameter — full Carga, DEC-33),
       the company's configuration, and quotes (SyncCargaResponse.Orcamentos,
       commit 5e82411)
     → Does not include the schedule — see the delta below

POST /api/sync/descarga
     → Receives: offline atendimentos, new clients and services (with the
       device Uuid) and completions of scheduled atendimentos (DEC-36, DEC-39);
       an atendimento references a client by ClienteId or ClienteUuid
     → Returns: ClientesSincronizados/AtendimentosSincronizados (accepted
       uuids), ClientesMapeados (uuid → id) and Erros. Each atendimento is
       all-or-nothing; rejected ones stay pending on the device (DEC-33)
```

### Use by the mobile app (see section 11)
The mobile app implemented the Carga/Descarga cycle against these endpoints, with two backend deltas found during the build (DEC-26, see TASKS.md):
- The Carga does not include the schedule — worked around in the app with a separate `syncAgenda` step (`GET /api/atendimento/agenda`).
- ~~An offline atendimento does not reference a client created offline~~ — resolved by DEC-33 (`ClienteUuid` + `ClientesMapeados`).

### Conflict resolution
- **Cliente:** the last write by `UpdatedAt` prevails
- **Atendimento:** Mobile is always the source of truth (created offline)
- **Produto/Servico:** the server is always the source of truth (managed by the Web)

---

## 8. Database

- **Provider:** PostgreSQL on Supabase (Free plan, East US / N. Virginia region), see DEC-32
- **ORM:** Entity Framework Core 10.0.14 (Npgsql provider 10.0.3), see DEC-40
- **Migrations:** controlled through `dotnet ef migrations`
- **State:** single `InitialCreate` applied on 08/10/2026 (DEC-31); all migrations in `MicroERP.Api/Migrations` applied on Supabase (latest: `AddBloqueioLoginExclusaoLgpdDuracaoServico`, 11/11/2026)
- **Secrets:** connection string in `appsettings.Development.json` (gitignored)

### DeleteBehavior
- `Empresa → Usuario`: Cascade
- `Empresa → Configuracao`: Cascade
- `Atendimento → ItemProduto`: Restrict
- `Atendimento → ItemServico`: Restrict
- `Produto → ItemProduto`: Restrict
- `Servico → ItemServico`: Restrict

---

## 9. Metrics Layer (DEC-20)

Deterministic aggregation layer (C#/SQL, no AI), implemented as part of the Controllers → Services → Repositories backend described in section 2. It is the same data source used both by the dashboards/charts and by the future AI interpretation (section 6) — never raw data sent to the model.

### Endpoints (Phase 1 — KAN-77, commit `87f54e6`)
```
GET /api/metrics/vendas
     → Best-selling product (quantity and revenue), average ticket, revenue per period
     → KAN-78 — done

GET /api/metrics/servicos
     → Revenue per service type
     → Hours and revenue per hour per service (`Servico.DuracaoMinutos`, DEC-45)
     → KAN-79 — partial: margin/hour and average time postponed (depend on
       Custo/DEC-19/KAN-72)

GET /api/metrics/estoque
     → Stock turnover, idle products (>30 days), imminent stockout (≤7 days)
     → KAN-80 — done

GET /api/metrics/dashboard
     → Aggregator of the three blocks above in a single payload
     → KAN-81 — done
```

### Layers involved
`MetricasController` → `MetricasService`/`IMetricasService` → `MetricasRepository`/`IMetricasRepository`, with their own DTOs (`MetricasVendasResponse`, `MetricasServicosResponse`, `MetricasEstoqueResponse`, `DashboardResponse`). Follows the same patterns as section 2 (DI through an interface, `AddScoped`).

### Business rules applied
- Multi-tenant: every query filters by `EmpresaId` + `DeletedAt == null`, joining through `Atendimento` (since `ItemProduto`/`ItemServico` have no `EmpresaId` of their own).
- Revenue counts only atendimentos with `Status = Concluido`; stock movement counts items of atendimentos with `Status != Cancelado`.
- The Sales block sums `ItemProduto.Subtotal`; the Services block sums `ItemServico.Subtotal` — never the `Atendimento`'s `ValorTotal`, so revenue is not duplicated between the blocks (makes the DEC-15 sales/service split concrete).
- Joins with `Produtos`/`Servicos` also filter `DeletedAt == null`, so soft-deleted catalog items do not enter the sums.

---

## 10. Web Frontend (Dono Module)

Web front end for the Dono profile, in `web/` in the `Agesto-Platform/Agesto` monorepo. Consumes the C# API through HTTPS+JWT (section 1). Original design approved from the `web-dono.html` prototype — the web is the **analytical** platform (charts, margin, rankings), in contrast with mobile, which is **action-first** for the agent in the field (see the design identity: blue `#2B4ACB` for brand/action, green `#0E9E63` for success/margin/profit, light theme, optional Georgia serif only on money figures).

### Stack
- **Vite + React 19 + TypeScript**
- **Tailwind CSS v4** — CSS-first config via `@theme` in `src/styles/tokens.css`, tokens ported from the approved prototype
- **React Router** (`react-router-dom` at `7.18.5` for security — RSC mode advisory accepted, not used in the project)
- **TanStack Query** — all server data (fetch, cache, invalidation)
- **MSW (Mock Service Worker)** — stateful API mock for local development without a backend; turned on/off through `VITE_USE_MOCKS` (`false` in production)
- **Leaflet** — schedule map, loaded on demand (DEC-38)
- **Recharts** — dashboard charts
- **oxlint** — lint

### Folder and layer architecture
```
web/src/
├── features/<name>/     → each business resource (Clientes, Produtos, Serviços,
│                           Agenda, Orçamentos, Atendimentos, Configuração)
├── components/ui/       → reusable kit: Drawer (slide-over), DataTable,
│                           ConfirmDialog, TextField/NumberField/SelectField,
│                           Toast, Card, Kpi, Money, Pill, RankBar, Alert
├── lib/api.ts            → unwraps the ApiResponse envelope, injects Bearer, handles 401
├── lib/resource.ts       → createResource factory (list/create/update/delete
│                           with automatic TanStack Query invalidation)
├── types/api.ts          → types mirroring the API's real DTOs (camelCase)
└── mocks/lib/http.ts     → stateful mock (makeStore + crudHandlers)
```

### UX/architecture decisions
- **Forms in a side drawer (slide-over)**, not a central modal or a full page — keeps the list visible while editing.
- **Mock↔real API seam:** `VITE_USE_MOCKS=true|false` turns MSW on/off; turning it off points to the real API through `VITE_API_BASE_URL`, without changing feature code.
- **Atendimento delta solved in the front end:** `GET /api/atendimento` returns the real `AtendimentoResponse` (only `clienteId`, no name); the client name is resolved in the front end by joining with the already loaded client list. It ended the fictitious "AtendimentoResumo" format that existed in the presentation.

See DEC-25 in `DECISIONS.md` for the full history of the decision, and TASKS.md (section "Web Frontend") for the table of tasks/commits and open items (component tests, Recharts lazy-load).

---

## 11. Mobile (Agent App)

Mobile app for the field agent, in `mobile/` in the `Agesto-Platform/Agesto` monorepo. Consumes the C# API through HTTPS+JWT (section 1), with a local offline persistence layer. **Action-first** design — in contrast with the Web (section 10), which is the owner's analytical platform — using the same base visual identity (blue `#243FA6`/`#2B4ACB`, green `#12B886`/`#0E9E63`, light theme). See DEC-26 in `DECISIONS.md` for the full history of the decision.

### Stack
- **React Native + TypeScript**, via **Expo (prebuild)**
- **Expo Router** — navigation, including the tab bar (Início/Agenda/Atendimentos/Clientes/Mais)
- **theme + StyleSheet** — typed styling, prototype tokens (not NativeWind)
- **expo-sqlite** — offline persistence on the device, behind the `LocalDb` interface, with an in-memory adapter for Web/tests
- **expo-secure-store** (device) / `localStorage` (web) — JWT token storage, split by platform
- **In-code mock layer** (`config.useMocks`) — analogous to the web's `VITE_USE_MOCKS` (DEC-25)
- **Jest (jest-expo)** — 119 tests in the `develop` CI (11/11/2026), covering data, sync and app rules

### Folder and layer architecture
```
mobile/src/
├── db/
│   ├── types.ts          → LocalDb interface (single persistence contract)
│   ├── index.native.ts   → expo-sqlite adapter (device)
│   └── index.ts          → in-memory adapter (Expo Web / Jest)
├── sync/                 → Carga and Descarga (POST/GET against /api/sync/*),
│                           including the syncAgenda step (see section 7)
├── lib/                  → API client (envelope + 401), utilities
├── auth/                 → login, route guard, session (src/lib/session.ts)
├── app/                  → Expo Router routes
├── features/             → business screens (Home, Agenda, Registrar Atendimento,
│                           Clientes, Mais)
└── ui/                   → theme (colors, typography) + StyleSheet components
```

### Offline Carga/Descarga cycle
1. **Login** — JWT authentication against `/api/auth/login`; token stored via `expo-secure-store`/`localStorage`.
2. **Carga** — always full (DEC-33); fills the local database with clients, products, services and configuration (`GET /api/sync/carga`), plus quotes (`SyncCargaResponse.Orcamentos`), which the app does not store or show yet. An additional `syncAgenda` step fetches and caches `GET /api/atendimento/agenda` separately, because the Carga does not include the schedule (backend delta, see section 7 and DEC-17).
3. **Offline use** — action-first Home (Registrar CTA + the day's schedule Próximo/Ainda hoje); recording an atendimento (client + catalog items by quantity + status) saves it locally as pending; quick offline client registration saves it as `PendingCliente`.
4. **Descarga** — pushes pending clients and atendimentos to `POST /api/sync/descarga`; marks as synced only the uuids the server confirmed (rejected ones stay pending) and relinks atendimentos of clients created offline to the server id (DEC-33). The Sincronizar button does a Descarga followed by Carga + schedule. The app also syncs on its own when it opens, when the user returns to it and when the internet comes back (I5): with something pending it sends right away, with nothing pending only if the last one was more than 5 minutes ago, and never with the record or client screen open, so as not to send a half-done correction. One sync at a time (`sincronizarUmaVez`), and open screens reload when it finishes. The "Mais" tab shows sync status (pending items, last sync, Sincronizar button) and logout.

### Known limitations (see DEC-26 and TASKS.md)
- Lookup of the history of one's own atendimentos was not implemented in this phase (out of the scope of mob-01 to mob-07).
- The day's route by address already exists (DEC-37); optimization by proximity ("Otimizar dia") does not yet.
- React Native component testing (`@testing-library/react-native`) was postponed due to version incompatibility (lib v14 + jest-expo + React 19).

### Verification
The cycle was validated on **Expo Web**, without a physical Android/iOS device in this phase. The `LocalDb` behind an interface allows using an in-memory adapter on Web/tests. In the `develop` CI (11/11/2026): typecheck, lint and 119 green Jest tests. Validation on a physical device remains pending.
