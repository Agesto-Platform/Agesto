# Agesto — System Requirements

> **Document state:** under audit. This file was rebuilt on 17/08/2026 after an accidental overwrite outside Git. Rules confirmed by the code and by the decisions are valid; sections without evidence must be treated as proposals until the audit recorded in `docs/project/README.md` is finished.

> **Product focus:** Agesto is focused on the **Service Provider**. The backbone of the product is the service life cycle — Orçamento (quote) → Agendamento (scheduling) → Execution (Atendimento) → Cobrança (billing). Product sales are a secondary feature (a "plus"), enabled according to the `TipoOperacao` configured by the company. See DEC-15 in `DECISIONS.md`.

## Mandatory glossary

Before any implementation, understanding the distinction between these terms is critical:

| Term | Meaning | Example |
|-------|-------------|---------|
| `Empresa` | Paying customer of the SaaS (micro-entrepreneur) | "AC Fernando", "Doce Sabor" |
| `Usuario` | Person who logs into the system | "Fernando" (owner), "Carlos" (agent) |
| `Cliente` | End consumer of our customer's business | "Vó Joana" (who bought the candy) |
| `Perfil` | Role of the Usuario within the Empresa | `Dono` (owner) or `Agente` (agent) |

---

## 1. Company and User Management

### 1.1 Company sign-up
- Sign-up automatically creates an `Empresa`, a `Usuario` with `Perfil = Dono` and a default `Configuracao` (`TipoOperacao = Servico`)
- The email is normalized (trim + lowercase) before any operation
- The email must be unique in the system
- Minimum password of 8 characters, stored hashed (ASP.NET Identity PasswordHasher)
- **[Implemented]** Closed sign-up: `POST /api/auth/register` requires `X-Registration-Key`; without the key it answers 404. Reopening depends on email verification, not implemented yet (DEC-34)
- **[Implemented]** The Agesto team also creates a company with a Dono through the superadmin area; the Dono receives an email invitation and creates their own password (DEC-52, DEC-55)
- **[Implemented]** Deleting one's own account (`DELETE /api/usuario`, LGPD): the user is anonymized with `DeletedAt` instead of deleted; the company is not left without an active Dono (DEC-44)

### 1.2 Access profiles
- **Dono:** accesses the Web module, sees data from all the company's agents, manages settings
- **Agente:** accesses the Mobile module, sees only their own atendimentos
- **Platform admin (Agesto team):** separate account, outside the companies, which accesses only the superadmin area at `/admin` (DEC-52)
- The system must distinguish profiles through the `perfil` claim in the JWT

### 1.3 Multiple agents
- An `Empresa` can have several `Usuarios` with `Perfil = Agente`
- Agents share the company's same catalog of `Clientes`, `Produtos` and `Servicos`
- Each `Atendimento` records which agent performed it (`UsuarioId`) besides the company (`EmpresaId`)

---

## 2. System Configuration

### 2.1 Operation types
`Configuracao` defines how the company operates:

| Type | Description |
|------|-----------|
| `Servico` | Services only (default) |
| `Venda` | Product sales only |
| `Hibrido` | Sales and services |

- The default `TipoOperacao` is `Servico` — it reflects the product's focus on the provider (DEC-15). `Venda` and `Hibrido` are still supported for whoever needs them.
- There is exactly **1 Configuracao per Empresa**
- The configuration is managed by the Dono in the Web module
- The Mobile module uses the configuration to decide which features to show (e.g. an ad hoc product sale only shows up if `TipoOperacao` enables it)
- **[Implemented]** The **web** reacts to `TipoOperacao`: in `Venda` mode the sidebar hides **Serviços** and **Agenda**, and the item picker (Atendimento/Orçamento) hides the **Serviço** option. **`Produtos` is never hidden** — it is material/stock, not "sales" (DEC-18). `Servico`/`Hibrido` show everything.

### 2.2 Agent schedule mode and stock control (DEC-27)

`Configuracao` has two more parameters per Empresa, editable by the Dono in Parametrização (web) and propagated to mobile through the Carga:

| Field | Values | Effect |
|-------|---------|--------|
| `ModoAgendaAgente` | `Flexivel` (default) / `Fixa` | **Flexível:** the agent records *now* **or** schedules for the future in the app. **Fixa:** the agent only carries out the Dono's schedule — **does not schedule** (walk-in/immediate recording is still allowed). |
| `ControlaEstoque` | `true` (default) / `false` | **true:** catalog items deduct/validate stock. **false:** the catalog becomes a list of materials with price/cost, **without** deduction or validation (pass-through provider). |

- **[Implemented]** Safe default (`Flexivel` + `ControlaEstoque = true`) on every path; the migration preserves the behavior of existing companies.
- **[Implemented]** `ControlaEstoque` is applied at the 5 stock mutation points (product item create/edit/remove, cancel atendimento, Descarga).
- **[Implemented]** `Fixa` has server enforcement: the Descarga ignores the agent's `DataAgendada` when the company is `Fixa` (the Dono's online path stays open — building the schedule is their role).

---

## 3. Client Management

- Full CRUD of clients (end consumers)
- CPF is mandatory and unique per `Empresa` — accepted format: with or without a mask
- CPF is normalized (digits only) before storing
- Clients are shared among all agents of the same company
- Registration can be done on the Web or on Mobile
- Simultaneous registration conflict (offline + online): the last write by `UpdatedAt` prevails
- **[Implemented]** Structured address fields — `Logradouro`, `Numero`, `Bairro`, `Cidade`, `Cep` (commit `da828bc`) —, needed to enable the Agenda (§13). **[Implemented]** Geolocation: `Latitude`, `Longitude` and `GeocodificadoEm` filled in the background by OpenRouteService, from the address only (DEC-38). See DEC-17.

---

## 4. Product Management

- Full CRUD of products
- Fields: name, price, stock quantity
- Stock must be decremented when recording a catalog item in an atendimento (sale or service) and returned on cancellation
- Negative stock is not allowed — the system must reject an operation without enough stock
- Catalog shared among all agents of the company
- `Produto` is tied to **stock**, not to "sales" — a catalog product can be used both in a sales and in a service context. "Sale" is just one of the usage contexts (`TipoOperacao`), not a product category.

---

## 5. Service Management

- Full CRUD of services
- Support for two billing types:

| Type | Field | Subtotal calculation |
|------|-------|---------------------|
| `PorHora` | `ValorHora` (mandatory) | `Quantidade × ValorHora` |
| `Empreitada` | `ValorEmpreitada` (mandatory) | `ValorEmpreitada` (fixed, no multiplication — DEC-04) |

- `TipoCobranca` is mandatory on creation
- An `Empreitada` service ignores `Quantidade` in the calculation — the value is always fixed by default
- Catalog shared among all agents of the company
- **[Implemented]** The catalog's `ValorHora`/`ValorEmpreitada` are only a **suggestion/pre-fill** — the item's real value can be edited during the atendimento (DEC-23)
- A service outside the catalog does not exist as an ad hoc line: it is always a **quick registration** that creates a reusable `Servico` before it becomes an item (DEC-22)

---

## 6. Atendimentos and Quotes

### 6.1 Recording an atendimento
- An atendimento belongs to an `Empresa` and a `Cliente`
- It records which `Usuario` (agent) performed it
- Possible statuses: `Pendente`, `Concluido`, `Cancelado`
- `DataRegistro` can be provided by the agent (offline-first support)
- **[Implemented]** `DataAgendada` allows scheduling the atendimento for a future date (DEC-17), consumed by the Agenda endpoint (§13)

### 6.2 Atendimento items
- An atendimento can have `ItemProduto` and `ItemServico` at the same time (Hybrid mode)
- **[Implemented]** `ItemProduto.ProdutoId` is optional — catalog item (deducts stock) vs ad hoc item with a free description (does not deduct stock). `ItemServico.ServicoId` remains mandatory (DEC-18, DEC-22)
- `PrecoUnitario` is captured at the time of the atendimento (snapshot) — immune to future catalog price changes, and it is **editable** when recording, with the catalog as the default (DEC-05, DEC-23)
- **[Implemented]** `ItemProduto.Custo` (optional) allows recording the material cost, enabling margin per atendimento: `Margem = ValorTotal − CustoTotal` (DEC-19)
- The atendimento's `ValorTotal` is recalculated automatically when items are added, updated or removed
- Formula: `ValorTotal = Σ ItemProduto subtotals + Σ ItemServico subtotals`

### 6.3 Filters
- The agent sees only their own atendimentos
- The Dono sees atendimentos from all the company's agents

### 6.4 Quote (Orçamento)
- **[Implemented]** `Orcamento` is an entity separate from `Atendimento` — it affects neither stock nor financial metrics while it is not approved (DEC-16)
- When approved by the client, the quote is converted into an `Atendimento` through `POST /api/orcamento/{id}/converter`; stock deduction only happens at that moment
- **[Partially implemented]** Quotes are part of the mobile sync Carga (`SyncCargaResponse.Orcamentos`), but the app does not store them yet nor has a quote screen (checked on 11/11/2026)
- **[Planned / not implemented]** Quote Descarga (create a quote from offline mobile) — flow decision open

---

## 7. Mobile Module — Specific Requirements

> The subsections below describe the behavior built today in the mobile app (`mobile/`, tasks mob-01 to mob-07, on `main` of the `Agesto-Platform/Agesto` repo). See DEC-26 in `DECISIONS.md` and section 11 of `DESIGN.md` for the stack and architecture.

### 7.1 Offline-first
- **[Implemented]** The agent can record atendimentos and register clients without an internet connection — data saved locally (`expo-sqlite` on the device; in-memory adapter on Expo Web/tests) behind the `LocalDb` interface
- **[Implemented]** The `Uuid` is generated on the device for identification before sync
- `DataRegistro` must reflect the real moment of the atendimento, not of the sync

### 7.2 Synchronization
Two distinct flows:

**Carga (Server → Mobile):**
- Fires when the agent opens the app or asks for a sync
- Sends: updated clients, products, services, the company's configuration
- Criterion: the backend accepts `ultimaSincronizacao`, but the app always asks for the full Carga, to propagate deletions (DEC-33)
- **[Implemented in the API]** `SyncCargaResponse.Orcamentos` — the Carga also sends the company's quotes (commit `5e82411`); the app does not store or show them yet
- **[Implemented, with a workaround]** The Carga **does not include the schedule**. The mobile app works around this with an extra `syncAgenda` step, which fetches and caches `GET /api/atendimento/agenda` separately. **[Backend delta]** ideally the schedule would be part of the Carga — see TASKS.md.

**Descarga (Mobile → Server):**
- Fires when the agent syncs
- Sends: atendimentos performed offline, new clients and services registered and completions of scheduled atendimentos (DEC-33, DEC-36, DEC-39)
- `Cliente` conflict: the last write by `UpdatedAt` prevails
- **[Implemented]** Descarga of pending clients and pending atendimentos — the app pushes both and marks them as synced on receiving the server's confirmation
- **[Planned / not implemented]** `Orcamento` Descarga (create a quote offline on mobile) — flow decision still open (whether the agent should be able to create a proposal offline). Today quote sync is Carga only (read).
- **[Implemented]** An offline atendimento references a client created offline by `ClienteUuid`; the Descarga returns `ClientesMapeados` and each atendimento is all-or-nothing, with the rejected ones pending on the device (DEC-33)

### 7.3 Mobile features
- **[Implemented]** Login and authentication (JWT, token stored via `expo-secure-store` on the device / `localStorage` on the web)
- **[Implemented]** Client registration and lookup (synced reference + quick offline registration)
- **[Implemented]** Product and Service catalog lookup (through the Carga)
- **[Implemented]** Quick service registration when recording, offline, sent in the Descarga and flagged for the Dono's review; the Dono turns it on or off in Parametrização (DEC-36)
- **[Implemented]** Recording atendimentos (client + catalog items by quantity + status), saved offline as pending
- Lookup of the history of one's own atendimentos — not implemented in this phase (out of the scope of mob-01 to mob-07)
- **[Implemented]** Manual sync ("Mais" tab: pending items, last sync, Sincronizar button) and automatic sync when the app opens, when the user returns to it and when the internet comes back (I5). With the app closed it does not sync (no background task)
- **[Implemented]** Action-first Home with a CTA to record an atendimento and the day's schedule (Próximo / Ainda hoje), consuming the Agenda endpoint (`GET /api/atendimento/agenda`, enriched with `AgendaItemResponse`) through the `syncAgenda` workaround described in 7.2. **[Implemented]** "Iniciar rota" opens Google Maps with the day's pending visits, in time order (DEC-37). **[Planned / not implemented]** Route optimization by proximity ("Otimizar dia", phase 2).
- **[Implemented]** Dedicated **Agenda** (full schedule grouped by day) and **Atendimentos** (list with status and a pending-upload badge) screens.
- **[Implemented]** **Scheduling in the field** when `ModoAgendaAgente = Flexivel` (see §2.2): when recording, a "Registrar agora / Agendar" (record now / schedule) toggle with a day + time picker (scheduled as `Pendente` with `DataAgendada`); the Agenda tab shows the "+ Agendar" CTA. In `Fixa` mode the app hides scheduling (immediate recording/walk-in only), and the server enforces it.
- **[Implemented]** The stock hint on the agent's screens disappears when `ControlaEstoque = false`.
- **[Implemented]** Editable item value in the app, completing a scheduled atendimento in the app and correcting or deleting what has not been sent yet (DEC-39).

---

## 8. Web Module — Specific Requirements

- **[Implemented]** Login and authentication (JWT)
- **[Implemented]** "Visão geral" (overview) dashboard with KPIs, chart, rankings, alerts and a table of the latest atendimentos (all agents)
- **[Implemented]** Configuration management (`TipoOperacao`)
- **[Implemented]** CRUD of Produtos, Serviços, Clientes
- **[Implemented]** Agenda (timeline grouped by day), Orçamentos (item editor, status, conversion into atendimento) and Atendimentos (items/stock/margin)
- **[Implemented]** Relatórios — Rentabilidade/Serviços/Produtos/Estoque tabs
- Viewing atendimentos from all agents — implemented
- **[Implemented]** Management of the company's users: the Dono registers agents (the person gets an email invitation and creates their own password), edits, deactivates/reactivates and resends the invitation; the Agesto team also creates accesses through the superadmin (DEC-55); assigns atendimentos to an agent (DEC-35)
- **[Implemented]** Schedule map ("Mapa" tab, Leaflet + OpenStreetMap) with the geocoded clients (DEC-38)
- **[Implemented]** Estimated duration in the service form and R$/h per service in Relatórios (DEC-45)
- **[Implemented]** Agente panel with an AI chat about the period's numbers and the schedule (DEC-21), still with the "Prévia" (Preview) badge
- **[Implemented]** Superadmin area at `/admin` for the Agesto team: companies, users, team and auditing (DEC-52)
- Consumes the real API in production (DEC-32); the stateful mock (MSW) stays for local development, see DEC-25

---

## 9. Metrics Module (DEC-20)

- **[Implemented]** Deterministic aggregation layer (C#/SQL, no AI) — the same data source used by the dashboards and by the future AI interpretation
- Endpoints: `GET /api/metrics/vendas` (best-selling product, average ticket, revenue per period), `/api/metrics/servicos` (revenue, hours and revenue per hour per service, DEC-45 — margin/hour and average time are still pending, because cost is not yet assigned to the service), `/api/metrics/estoque` (turnover, idle products, imminent stockout), `/api/metrics/dashboard` (aggregator) and `/api/metrics/rentabilidade` (revenue, cost, margin, margin %, average ticket, number of completed atendimentos)
- Every query filters by `EmpresaId` + `DeletedAt == null`
- Revenue counts only `Concluido` atendimentos; stock counts items of non-`Cancelado` atendimentos

---

## 10. Generic Atendimento Item, Cost and Margin

> Detailed in §6.2. Normative summary: optional `ItemProduto.ProdutoId` (catalog vs ad hoc, DEC-18); `ItemServico.ServicoId` always mandatory (DEC-22); optional `ItemProduto.Custo` enables margin per atendimento (DEC-19); `PrecoUnitario` editable on both, with the catalog as the default (DEC-23).

---

## 11. Reserved

> Section reserved for future expansion of domain requirements (numbering kept to preserve the existing cross-references to §13 — Agenda and Route).

---

## 12. Reserved

> Reserved section — same note as §11.

---

## 13. Agenda and Route

- **[Implemented]** `Atendimento.DataAgendada` + `GET /api/atendimento/agenda`, filtered by profile: the Agente sees only their own schedule; the Dono sees all/filters (DEC-17)
- **[Implemented]** Endpoint enriched with `AgendaItemResponse` (client name/phone/address + service summary), avoiding N+1 on mobile (commit `5e82411`)
- **[Implemented]** `Cliente` geolocation (DEC-38), the day's route in Google Maps from the app (DEC-37) and the schedule map on the web (DEC-38)
- **[Implemented]** `Servico.DuracaoMinutos`, used today in revenue per hour (DEC-45)
- **[Planned / not implemented]** Route optimization by proximity ("Otimizar dia") — phase 2

---

## 14. AI/Insights Module

- AI native to the product — neither configurable nor paid separately by the customer (DEC-03, DEC-21)
- Read-only access to the company's data (read-only in the MVP)
- Mandatory multi-tenant isolation — the AI never mixes data from different companies (`empresaId` always extracted from the JWT)
- Sensitive data (CPF, etc.) masked before being sent to the model
- The metrics layer (§9) feeds the AI — the AI never receives raw data, only already computed aggregations (DEC-20)
- **[Revised decision — DEC-21]** The AI runs **inside the C# backend** through the official Anthropic Claude SDK, and not as a separate Python/FastAPI service. The Python module (KAN-30) is obsolete — see TASKS.md
- Per-use billing is on the SaaS operator (Davi), not on the end customer (BYOK discarded — DEC-03, DEC-21)
- **[Implemented]** `POST /api/insights` (period summary, highlights, alerts and recommendations) and `POST /api/agente/perguntar` (Agente panel chat), Dono only, with Claude Haiku 5.5 by default (DEC-21)
- **[Implemented]** The chat receives the period's metrics and the schedule for the next 7 days without the client's name, phone or address
- **[Implemented]** Limit per company (10 reports and 30 questions per hour) and token consumption logged per `EmpresaId`
- **[Implemented]** AI consumption recorded per company and day (`UsosIa` table, the `TenantUsage` from DEC-21) and a limit of 20 questions per day to the Agente
- **[Does not apply for now]** Per-plan limit (DEC-21): there is only one plan (DEC-57), and every company has 20 questions per day

---

## 15. Security

- JWT mandatory on all routes except `/auth/register`, `/auth/login`, `/health` and `GET /api/app/versao` (and, in the superadmin area, `/admin/auth/login` and `/admin/auth/setup`)
- `empresaId` and `usuarioId` always extracted from the JWT — never from the request body
- Multi-tenant isolation: every query filters by `EmpresaId`
- CPF unique per company (composite index `EmpresaId + Cpf`)
- Soft delete on all operational entities (`DeletedAt`)
- HTTPS mandatory in production
- Password never stored in plain text
- The AI API key stays only on the server — never on the front end/mobile, never in the tenant's `Configuracao` (DEC-21)
- **[Implemented]** Account lockout for 15 minutes after 5 wrong passwords in a row, on top of the per-IP limit; creating the password through the email link unlocks it (DEC-43, DEC-55)
- **[Implemented]** Superadmin area with its own accounts and JWT (separate audience): a customer token does not open `/admin` and vice versa; every admin action goes to the audit log (DEC-52)
- **[Implemented]** A company blocked by the Agesto team loses login and already issued tokens (DEC-52)

---

## 16. Non-functional Requirements

- RESTful API with standardized responses through `ApiResponse { Success, Message, Data, Errors }`
- Input validation through Data Annotations on the DTOs
- Validation errors return `400 Bad Request` with a list of errors
- Entities are never exposed directly — always through DTOs
- CORS configured for `localhost:5173` in development
- Unit tests mandatory for critical business rules (xUnit + Moq)
