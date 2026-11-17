# Agesto — Architecture Decisions

> Formerly called "Micro-ERP Auto" (renamed on 04/08/2026, see DEC-24).

> This document records important decisions made during development, the reasoning behind each one, and what was discarded. The goal is to keep decisions already made from being reopened without context.

---

## DEC-01 — `Empresa` entity as the system tenant

**Status:** Decided — implemented (commit `c48dbca`)

**Decision:** Multi-tenant isolation uses `EmpresaId`, not `UsuarioId`.

**Context:** The initial model used `UsuarioId` for isolation — each user was an independent silo. This conflicted with the requirement of multiple agents per micro-entrepreneur: two agents of the same company could not share clients or stock, or see the consolidated dashboard.

**Discarded alternatives:**
- Keep `UsuarioId` as the tenant → makes the field agent model unworkable
- Use `Tenant` as the name → technical English term, less clear for the Brazilian team

**Impact:** All operational entities (`Cliente`, `Produto`, `Servico`, `Atendimento`, `Configuracao`) filter by `EmpresaId`. `Atendimento` also keeps `UsuarioId` to know which agent recorded it.

---

## DEC-02 — Sign-up creates Empresa + Usuario + Configuracao automatically (Option A)

**Status:** Decided — implemented

**Decision:** The `POST /api/auth/register` endpoint creates all three resources automatically. The first user is always `Perfil = Dono`.

**Context:** There were two options:
- **Option A:** Sign-up creates everything automatically (simple, no extra screen)
- **Option B:** Separate flow — first create the Empresa, then create the Usuarios

**Discarded alternative:**
- Option B → more robust but too complex for the MVP

**Consequence:** The company name is provided at sign-up through the `NomeEmpresa` field in `AuthRegisterRequest`. The owner can edit it later in the settings.

---

## DEC-03 — AI module native to the product (not BYOK)

**Status:** Decided after the post-CP III meeting

**Decision:** AI is a native feature of the product. The system holds the AI API key (Anthropic Claude). The customer neither configures nor pays separately for AI.

**Context:** There was a conflict of vision between two team members:
- **BYOK (Bring Your Own Key):** the customer brings their own token — initially adopted by the Tech Lead
- **Native AI:** the system controls the key, AI is part of the product — proposed by Diego

**Discarded alternative:**
- BYOK → discarded at the post-CP III meeting. The `AiProvider`, `AiApiKey` and `AiEnabled` fields that had been committed to `Configuracao` were removed in commit `3b5c540`.

**Implications:**
- The team (as a company) is the LGPD operator towards the AI provider
- Requires cost control per company (future: `TenantUsage`)
- Sensitive data must be masked before being sent to the model
- Isolation by `empresaId` is mandatory in every AI query

---

## DEC-04 — Empreitada (fixed-price job) ignores Quantidade in the Subtotal calculation

**Status:** Decided — implemented (commit `KAN-62`)

**Decision:** Services of type `Empreitada` have a fixed `Subtotal = ValorEmpreitada`. `Quantidade` is ignored in the calculation.

**Context:** We discussed whether quantity made sense for an empreitada (e.g. 2 AC installations). Conclusion: if the client wants multiple units, the agent adds multiple separate `ItemServico` — one per service. Using quantity for an empreitada would be a hack.

**Practical example:**
```
Technician installs 2 AC units (R$600/unit):
→ Adds ItemServico "Instalação AC" × 1 → Subtotal: R$600
→ Adds ItemServico "Instalação AC" × 1 → Subtotal: R$600
→ Atendimento ValorTotal: R$1.200
```

> **Updated by DEC-23:** the catalog (`ValorEmpreitada`) becomes only the suggested/pre-filled value; the provider can adjust it during the atendimento. The rule of not multiplying by `Quantidade` remains the default behavior.

---

## DEC-05 — PrecoUnitario captured at the time of sale (snapshot)

**Status:** Decided — implemented

**Decision:** `ItemProduto.PrecoUnitario` and `ItemServico.PrecoUnitario` store the price at the time of sale, not a reference to the current price.

**Reason:** Protects the financial history against future price changes. If a product cost R$10 and was raised to R$15, past sales stay correct.

**Warning:** The ItemServices' `UpdateAsync` **must not** overwrite `PrecoUnitario` with the current product/service value. Only `Quantidade` and `Subtotal` are recalculated.

> **Updated by DEC-23:** the snapshot still applies — the value stays frozen in the history — but it is now **typed/editable during the atendimento**, not just inherited from the catalog. The catalog becomes a suggestion/default.

---

## DEC-06 — Cliente conflict during sync: last write wins

**Status:** Decided

**Decision:** When the same client is edited on the Web and on offline Mobile at the same time, the record with the most recent `UpdatedAt` prevails.

**Reason:** The simplest solution, and enough for the MVP. Avoids complex conflict-merging logic.

**Known limitation:** In rare cases, a valid edit can be overwritten. Acceptable for the target audience (micro-entrepreneurs with few agents).

---

## DEC-07 — Configuracao is 1-to-1 with Empresa (not with Usuario)

**Status:** Decided — implemented

**Decision:** `Configuracao` belongs to the `Empresa`, not to the `Usuario`. All agents of the same company work under the same configuration.

**Reason:** `TipoOperacao` defines how the company operates — it makes no sense for each agent to have a different configuration.

**Planned future:** A system of per-agent profiles (e.g. salesperson vs technician), where each profile can have specific permissions. Not planned for the MVP.

---

## DEC-08 — TipoOperacao and StatusAtendimento are still free strings

**Status:** ✅ Resolved — commit `2a7ad7f` (KAN-64)

**Situation:** The `TipoOperacao` and `StatusAtendimento` enums were created and applied to the entities, DTOs and AppDbContext (commit `refactor(enums)` on 17/06/2026). The `ConvertEnumsToString` migration was left pending because `dotnet ef` was not installed on the machine.

**Resolution applied:** `dotnet ef` was installed and the `ConvertEnumsToString` migration was generated and applied (commit `2a7ad7f`), syncing the EF Core history with the real schema.

**Enums created:**
```csharp
// Enums/TipoOperacao.cs
public enum TipoOperacao { Venda, Servico, Hibrido }

// Enums/StatusAtendimento.cs
public enum StatusAtendimento { Pendente, Concluido, Cancelado }
```

---

## DEC-09 — Uuid as a string (not a native Guid)

**Status:** ✅ Resolved — commit `3972f8d` (KAN-65)

**Temporary decision (history):** `Uuid` fields on the offline-first entities were `string` (36 chars).

**Original reason:** Implemented before the decision was revisited. PostgreSQL has a more efficient native `uuid` type.

**Resolution applied:** `Uuid` fields converted from `string` to native `Guid` (`Guid.NewGuid()` as the default value), `HasMaxLength(36)` removed from AppDbContext, the matching migration generated and applied.

---

## DEC-10 — AuthService accesses the DbContext directly (no Repository)

**Status:** Technical debt — low priority. `IUsuarioRepository` already exists (used by `AtendimentoService`, DEC-35), but `AuthService` still accesses `AppDbContext` directly (checked on 21/10/2026)

**Temporary decision:** `AuthService` is the only Service that accesses `AppDbContext` directly, without going through a Repository.

**Reason:** Auth has particularities (chained creation of Empresa + Usuario + Configuracao) that make a Repository less natural here.

**Planned action:** Create `IUsuarioRepository` to standardize with the other Services. Low urgency.

---

## DEC-11 — Stock integrated into the sales flow

**Status:** ✅ Resolved — commit `fix(stock)` on 17/06/2026

**Previous situation:** `ItemProdutoService.CreateAsync` neither checked nor decremented `QuantidadeEstoque`. Soft delete did not return stock.

**Fix applied:**
- `CreateAsync`: validates there is enough stock (throws `EstoqueInsuficienteException`) and decrements it.
- `UpdateAsync`: computes the difference between the new and old quantity and adjusts stock.
- `DeleteAsync`: returns the quantity to stock before the soft delete.
- `ItemProdutoController`: catches `EstoqueInsuficienteException` and returns HTTP 400.

**Later addition:** cascading soft delete of items and stock return when deleting a whole `Atendimento` (commit `1b8b433`).

---

## DEC-12 — GitHub Education for branch protection

**Status:** ⚫ Obsolete — superseded by DEC-29: the repository is public in the `Agesto-Platform` organization and the `Protected branches` ruleset is active on `develop` and `main` (checked on 21/10/2026)

**Situation:** Branch protection rules require a paid plan for private repositories. Currently direct commits to `develop` are possible without a PR.

**Mitigation:** Process agreement — nobody pushes directly to `develop` or `main` without approval from Davi Gomes or Diego Mendes.

**Planned action:** Tech Lead to request the GitHub Education Pack with the Uniube academic email.

---

## DEC-13 — Inconsistent EF Core versions between Api and Tests

**Status:** ✅ Resolved — commit `29616ba` (KAN-66)

**Situation:** `MicroERP.Api` used EF Core `8.0.4`, `MicroERP.Tests` used `8.0.26`. It caused warning MSB3277 in the build.

**Risk:** Tests could expect `8.0.26` behavior but run with the `8.0.4` assembly.

**Resolution applied:** Versions of the three packages (`EntityFrameworkCore`, `Relational`, `InMemory`) aligned at `8.0.11` in both projects. Current build: 0 warnings, 0 errors.

---

## DEC-14 — Multi-tenant bug in the legacy controllers (KAN-63)

**Status:** ✅ Resolved — commits `abbcfa9` and `8305606` (KAN-63)

**Situation:** After the multi-tenant refactor (KAN-56), Services and Repositories started filtering by `EmpresaId`, but the legacy controllers kept extracting `usuarioId` (claim `sub`) and passing that value as if it were `empresaId`.

**Impact:** Broken multi-tenant isolation. Before the fix, it only "worked" by coincidence when `usuarioId == empresaId` (single-company scenario in dev). In production with multiple users per company, one company's data could leak to another.

**Affected controllers:** `ClienteController`, `ProdutoController`, `ServicoController`, `AtendimentoController`, `ItemProdutoController`, `ItemServicoController`.

**Resolution applied:** Created the `TryGetEmpresaId` helper (reading the `empresaId` claim, issued by `AuthService` in the JWT) in `ApiControllerBase`, and all affected controllers were migrated to use it instead of `TryGetUsuarioId`. The `TryGetUsuarioId` helper was also extracted to `ApiControllerBase` (commit `0a9a74b`) and is still used where the agent's identifier is needed (e.g. `Atendimento.UsuarioId`). `ConfiguracaoController` was correct from the start and served as the reference.

---

## DEC-15 — New focus: Service Provider first

**Status:** Decided — approved by Davi (product pivot)

**Decision:** The product changes focus. It stops being a hybrid ERP with equal weight on sales and services, and becomes focused on the Service Provider. Product sales become secondary (a "plus"), enabled only according to the `TipoOperacao` configured by the company. The default `TipoOperacao` changes from `Hibrido` to `Servico`. `Hibrido` and `Venda` still exist for whoever needs them.

**Context:** The product was born focused on a niche (AC installer), later evolving into a generic hybrid model. The pivot decision makes the backbone of the product the service life cycle — Orçamento (quote) → Agendamento (scheduling) → Execution (Atendimento) → Cobrança (billing) — instead of treating sales and services as equal. The app must be flexible for any type of provider, not just AC installers.

**Implications:**
- The mobile prototype's Kanban (Agendado → Hoje → Andamento → Concluído) stops being just a visual prototype and becomes a real domain model.
- New MVP priorities: Orçamento, Agenda and Rota (see DEC-16 and DEC-17).
- `TipoOperacao = Venda` and `Hibrido` are still supported, but are no longer the main path of the product.

---

## DEC-16 — Orçamento as an entity separate from Atendimento

**Status:** ✅ Resolved — implemented (commit `fffaba0`)

**Decision:** `Orcamento` is a document of its own, distinct from `Atendimento`. It does not affect stock. When approved by the client, it is converted into an `Atendimento`.

**Context:** We discussed the alternative of using a single entity (`OrdemServico`) with a status that goes through Orçamento → ... → Concluído. That alternative was discarded to keep the financial reports clean — a rejected quote must not pollute sales/stock data.

**Discarded alternatives:**
- Single `OrdemServico` entity with a progressive status → would mix documents that never became a real sale/service with real financial data, complicating reports.

**Note:** The larger number of entities was considered acceptable by the product owner (Davi), as long as it is well organized. He preferred a clear separation between "intent" (quote) and "execution" (atendimento).

**Resolution applied:** `Orcamento` + `ItemOrcamento` entities created, with full CRUD. Transactional conversion through `POST /api/orcamento/{id}/converter` — it only converts if the quote is `Aprovado`, and stock deduction happens exclusively at conversion time (not when the quote is created). Commit `fffaba0`. `SyncCargaResponse.Orcamentos` was also added later (commit `5e82411`), taking quotes to mobile in the sync Carga — the **Descarga** (creating a quote offline) is still open, see TASKS.md.

---

## DEC-17 — Agenda and Rota as priorities; Cliente gets an address

**Status:** 🟡 Partially resolved — address and schedule implemented (commits `da828bc`, `7007361`); lat/lng and the day's route delivered later by DEC-37 and DEC-38; "Otimizar dia" (optimize day, phase 2) is still missing

**Decision:** Scheduling atendimentos and field routing become priorities of the provider MVP. The `Cliente` entity needs an `Endereco` field (today it only has Nome, Telefone, CPF), with geolocation (lat/lng) planned for a future stage.

**Context:** A field service provider depends on knowing where and when to serve. Without a structured address on `Cliente`, it is not possible to build a geolocated schedule or the day's route.

**Implications:**
- `Cliente.Endereco` must be added to the schema when the feature is implemented.
- Lat/lng is marked as a future stage, not mandatory in the first cut.

**Resolution applied (partial):**
- `Cliente` gained the fields `Logradouro`, `Numero`, `Bairro`, `Cidade`, `Cep` (commit `da828bc`).
- `Atendimento` gained `DataAgendada` and the `GET /api/atendimento/agenda` endpoint, filtered by profile (Agente sees only their own schedule; Dono sees all/filters), made possible by the new `TryGetPerfil` helper in `ApiControllerBase` (commit `7007361`).
- Later, the schedule endpoint was enriched to return `AgendaItemResponse` with the client's name/phone/address and a service summary, removing N+1 calls on mobile (commit `5e82411`).
- **Pending:** geolocation and the day's route were delivered later (DEC-37 and DEC-38); only ordering by proximity ("Otimizar dia", phase 2) is left.
- **Delta found on mobile (mob-04, see DEC-26):** the sync Carga does not include the schedule; the mobile app needed a separate `syncAgenda` step (cached `GET /api/atendimento/agenda`) as a workaround. Ideally the schedule would be part of the Carga.

---

## DEC-18 — Generalized atendimento item: catalog vs ad hoc

**Status:** ✅ Resolved — implemented (commit `61a9c29`)

**Decision:** The `ProdutoId` field of the atendimento item becomes optional (nullable). If `ProdutoId` is filled in, the item comes from the catalog and **deducts stock**. If it is null, the item is ad hoc (avulso) — free description (e.g. "Cano PVC 50mm" bought on the spot at the store), and **does not deduct stock**.

**Context:** A single, simple rule: what triggers stock deduction is the presence of `ProdutoId`, not the usage context (sale or service). A catalog product installed during a service atendimento also deducts stock, because it physically left the shelf — the same applies to sales and services.

**Important clarification (to avoid future confusion):** `Produto` is tied to STOCK, not to "sales". "Sale" is just a usage context. They are two independent axes:
- (a) item origin = `ProdutoId` filled in (catalog) vs ad hoc (free description)
- (b) usage context = `TipoOperacao` (Venda / Servico / Hibrido)

A catalog product can live in both contexts. An ad hoc over-the-counter product sale is just a capability enabled by `TipoOperacao`, not a different kind of product entity.

**Implications:**
- `ProdutoId` on the item is no longer mandatory in the schema.
- The stock deduction/return logic (DEC-11) now checks `ProdutoId != null` as a condition, instead of assuming every item has a linked product.

> **Note (DEC-22):** the ephemeral ad hoc item (without a catalog entity) applies only to **products**. There is no equivalent for services — a service outside the catalog becomes a quick catalog entry, see DEC-22.

**Resolution applied:** `ItemProduto.ProdutoId` made nullable, with a new `Descricao` field for the ad hoc item; the stock deduction/return rule now checks `ProdutoId != null`. Commit `61a9c29`.

---

## DEC-19 — Cost tracking per item and margin per atendimento

**Status:** ✅ Resolved — implemented (commits `61a9c29`, `2b0d253`)

**Decision:** Each atendimento item gets a `Custo` field (optional, filled in freely by the provider). `Subtotal` (what goes into `ValorTotal`, what the client pays) and `Custo` (what the provider paid) are independent fields — the provider chooses which one to fill: if they charge the client for the material, they fill `Subtotal`; if they absorb the cost, they fill only `Custo`.

**Context:** Deliberate philosophy: no rule, no automatic markup, no cross-validation between `Subtotal` and `Custo`. The provider records it however they want. If they do not fill `Custo`, nothing breaks — the current behavior (DEC-05, price snapshot) still applies.

**Implications:**
- Enables **margin per atendimento**: `Margem = ValorTotal − Σ Custos`.
- A feature of direct value for the provider to understand the real profit of each service, not just revenue.
- There is no schema dependency between DEC-19 and DEC-18 — `Custo` applies to both catalog and ad hoc items.

> **Note:** the `Custo` field lives on `ItemProduto` (both catalog and ad hoc). The cost of material used in a service is recorded as an **ad hoc product line** (e.g. a TV bracket bought at the store), not as a field on `ItemServico`.

**Resolution applied:** `ItemProduto.Custo` field added (commit `61a9c29`); `Atendimento.CustoTotal` is now recalculated and `AtendimentoResponse` now exposes `Margem = ValorTotal - CustoTotal` (commit `2b0d253`). Later, margin was also aggregated at the business level in the new `GET /api/metrics/rentabilidade` and in the `Rentabilidade` block of `DashboardResponse` (revenue, cost, margin, margin %, average ticket, number of completed atendimentos in the period) — commit `5e82411`.

---

## DEC-20 — Metrics layer separate from the AI layer

**Status:** ✅ Phase 1 implemented — commit `87f54e6` (KAN-77: KAN-78, KAN-80, KAN-81 done; KAN-79 partial). The margin/time part is still postponed, depending on DEC-19/KAN-72.

**Decision:** The system will have two distinct layers:
1. **Metrics layer (analytics)** — deterministic aggregations computed in the backend (C#/SQL): `GROUP BY`, `SUM`, `AVG`, stock turnover, margin, etc. Correct, cheap, no AI. This layer feeds both the dashboards/charts and the AI.
2. **AI layer** — receives the already computed metrics and interprets them in natural language (summaries, highlights, alerts, recommendations).

**Context:** "Product X sells more", "service Y made more profit" are aggregations, not AI work. Sending raw rows to the model and asking it to compute leads to arithmetic errors (LLMs hallucinate at math). The AI never does the math — it receives ready numbers and interprets them. E.g. it receives "Serviço A: R$4.200 revenue, 12h, margin R$2.800" and answers "Serviço A is your most profitable per hour, prioritize your schedule for it".

**Important synergy:** the metrics layer is the same thing as the reports/dashboards backend (previously postponed). It is not separate work. And the margin per atendimento defined in DEC-19 is what enables profit-per-service analyses.

**The AI does not read chart images** — it reads the same data that generates the chart. Same data source, two consumers (chart rendering + AI insight).

**Discarded alternatives:**
- Sending raw data (`Atendimento`/`ItemServico` rows) straight to the model and asking it to aggregate → discarded because of the risk of arithmetic errors and higher token cost.

**Implications:**
- Implementation order: the metrics layer (which already delivers the charts/dashboards) is implemented **first**; the AI on top comes later.
- Planned base metrics: best-selling product (quantity and revenue), average ticket, revenue per period; revenue per service type, average time, margin/hour; stock turnover, idle products, imminent stockout; margin per atendimento (DEC-19).
- The AI interprets these metrics in four blocks: (1) period summary, (2) highlights (e.g. most profitable service per hour), (3) alerts (idle product, stock running out), (4) recommendations (restock/promote). A structured endpoint can return all four.

**Resolution applied (Phase 1):** implemented `MetricasController`, `MetricasService`/`IMetricasService`, `MetricasRepository`/`IMetricasRepository` and the endpoints `GET /api/metrics/vendas`, `/api/metrics/servicos`, `/api/metrics/estoque` and `/api/metrics/dashboard`, with their own DTOs (`MetricasVendasResponse`, `MetricasServicosResponse`, `MetricasEstoqueResponse`, `DashboardResponse`) and `MetricasServiceTests` tests (InMemory DbContext). All queries filter by `EmpresaId` + `DeletedAt == null`, joining through `Atendimento` (since `ItemProduto`/`ItemServico` have no `EmpresaId` of their own). Of KAN-79 (Service Metrics), only revenue per service type was delivered in this phase — margin/hour and average time are still pending, waiting for the `Custo` field (DEC-19/KAN-72) and a duration field not yet modeled.

**Later addition (commit `5e82411`):** with `Custo`/`Margem` already implemented (DEC-19), `GET /api/metrics/rentabilidade` and the `Rentabilidade` block in `DashboardResponse` were added — revenue, cost, margin, margin %, average ticket and number of atendimentos, counting only `Concluido` in the period. Margin/hour per service (the remaining part of KAN-79) is still postponed — service duration and revenue per hour already exist (DEC-45, 11/11/2026), but assigning cost to the service is missing; the owner's decision is to replace "most profitable service per hour" with "top-earning services" in the panel, a metric that already exists.

---

## DEC-21 — Native AI paid per use; interprets metrics; cost controls

**Status:** Decided. (Reaffirms and details DEC-03.) 🟢 Implemented and in production since 10/11/2026 (PRs #126 to #130), requested by Davi Oliveira for testing with the test accounts. AI remains out of the launch scope (DEC-46) until a new decision.

**Decision:** AI is native and paid per use by the SaaS operator (Davi), not BYOK. A single API key (Anthropic Claude) lives on the server; all tenants use this key; the per-token cost is built into the plan's monthly fee. Every subscribing customer has access to AI.

**Discarded alternatives:**
- **BYOK** (customer brings their own token) — discarded in DEC-03; it breaks the "every customer has AI" proposition.
- **Free AI / self-hosted open model (Llama/Mistral via Ollama)** — discarded for the MVP: "free" shifts the cost to infra (a 24/7 GPU server) and ops, unworkable for a solo dev, with lower quality. Paying per use is cheaper at a micro-ERP's volume (an analysis costs cents with an economy model) and has zero fixed infra.

**Cost controls (AI spends the operator's money):**
- Economy model (e.g. Claude Haiku) for the common case; a more capable model only where deep reasoning is needed.
- Prompt caching for repeated context.
- Usage limit per company per plan (smaller free tier, larger paid plan).
- Usage tracking per `EmpresaId` (the `TenantUsage` already planned in DEC-03) to know who consumes what and charge accordingly.

**Security (kept from DEC-03):** key only on the server (never on the front end/mobile, never in the tenant's `Configuracao`); mask CPF and sensitive data before sending to the model; multi-tenant isolation by `EmpresaId` in every query that feeds the prompt; read-only in the MVP (the AI reads and suggests, never writes).

**Open point:** ✅ RESOLVED on 20/07/2026. Owner's decision (solo dev, Davi): the AI layer runs **inside the C# backend**, using the official Anthropic SDK — not a separate Python/FastAPI service (original design, KAN-30). Reason: it removes an extra codebase for a solo dev, reducing the operational surface (see `project_solo_dev`). Consequence: the "Módulo IA/Insights (Python)" epic (KAN-30) becomes **obsolete** — see TASKS.md.

**Implementation (10/11/2026):**
- `POST /api/insights`: period report in four blocks (summary, highlights, alerts and recommendations), with structured output. `POST /api/agente/perguntar`: chat of the Agente panel on the web. Both for the Dono only.
- Default model `claude-haiku-5-5` (the economy model of this decision), swappable through `Insights__Modelo` without changing code. Key in `Insights__AnthropicApiKey` on Render; without it, the endpoints answer 503.
- The model receives only the period's already computed metrics (DEC-20). In the chat, it also receives the schedule for the next 7 days without the client's name, phone or address.
- Read-only: the AI does not create, change or delete anything.
- Cost controls delivered: limit per company (10 reports and 30 questions per hour) and token consumption logged per `EmpresaId`. Pending: the consumption table (`TenantUsage`) and the per-plan limit.
- **Daily limit and consumption (13/11/2026, requested by Davi):** each company has up to **20 questions per day** to the Agente (Brasília day; `Insights__PerguntasPorDia` changes the number without touching code). The `UsosIa` table is the `TenantUsage`: one row per company and day, with questions, reports and input and output tokens. The question is reserved before calling the model, in a single `INSERT ... ON CONFLICT` with the limit condition, so simultaneous questions cannot go past 20. If the model fails, the question is given back. Above the limit, the API answers 429 and the Agente panel locks the input box until the next day. `GET /api/agente/uso` shows how many are left, and the panel displays the counter. Insights reports are recorded, but do not count towards the limit of 20 (they keep the hourly limit). Per-plan limit: by Davi's decision (13/11/2026), it stays as is while there is only one plan (DEC-57); every company has 20. In production since release #177 (13/11/2026).
- Manual security tests in production (data leakage, isolation between companies, injection through product name, write requests) passed on 10/11/2026.

---

## DEC-22 — Service outside the catalog = quick registration (not an ephemeral line)

**Status:** ✅ Resolved — implemented by design (commit `61a9c29`)

**Decision:** When a service comes up that is not in the catalog, the provider does a **quick registration** that creates a reusable `Servico` (catalog) entity, and then adds the item normally. There is NO "ephemeral ad hoc service" (a line with a null `ServicoId`). Therefore `ItemServico.ServicoId` remains **mandatory**. No schema change — it reuses the existing `POST /api/servico`.

**Context:** A deliberate contrast with the **ad hoc product** (DEC-18): a product/material bought at the store on the spot (e.g. a TV bracket) is genuinely one-off and stays as an ephemeral line (null `ProdutoId` + free description), so as not to pollute the product catalog. Services, on the other hand, tend to repeat and need to show up in the metrics (revenue per service type, margin/hour — DEC-20/KAN-77 layer). An ephemeral service would not enter these rankings. That is why a service becomes catalog; an ad hoc product does not.

**Discarded alternative:** `ItemServico` with a null `ServicoId` + free description (ephemeral service line) — discarded because the service would be lost in the metrics and reuse/profitability history would be impossible.

**Implications:** intentional asymmetry: ephemeral ad hoc product vs service always in the catalog. "Quick service registration" UX in the atendimento flow (frontend/mobile), but no new backend.

**Resolution applied:** no schema change was needed — `ItemServico.ServicoId` remains mandatory, as decided. Commit `61a9c29` (the same batch that delivered DEC-18/19/23) only confirms that the backend behavior is already aligned with this decision; the quick registration itself is a UX responsibility on frontend/mobile, not built yet.

---

## DEC-23 — Item value is editable in the atendimento; the catalog is only a suggestion

**Status:** ✅ Resolved — implemented (commit `61a9c29`)

**Decision:** The value of any atendimento item (product or service) becomes **typed/editable during the atendimento**. The catalog value (`Produto.Preco`, `Servico.ValorHora`, `Servico.ValorEmpreitada`) becomes just a **suggestion/pre-fill**; the provider can override it depending on difficulty/situation (e.g. the same service costs more in a difficult case).

**Context:** The same service can have different prices depending on the situation; forcing the catalog value made this rigid.

**Relation to earlier decisions:**
- **DEC-05** (PrecoUnitario snapshot) still applies: the value stays frozen in the atendimento history. The change is that it is now **entered/editable**, not just inherited from the catalog.
- **DEC-04** (Empreitada = fixed ValorEmpreitada, ignores quantity): becomes "the catalog pre-fills this value, but the provider can adjust it". The rule of not multiplying by quantity remains the default behavior.

**Implications:** `ItemProdutoService`/`ItemServicoService` no longer derive the `Subtotal` strictly from the catalog — they accept the value provided (with the catalog as the default). Applies to product and service items.

**Resolution applied:** `PrecoUnitario` became optional in the `ItemProduto` and `ItemServico` requests; when provided, it overrides the default from the catalog. Commit `61a9c29`.

---

## DEC-24 — Product renamed to "Agesto" and its own public repository

**Status:** ✅ Resolved — 04/08/2026 (owner's decision, solo dev)

**Decision:** The product is now called **Agesto** (formerly "Micro-ERP Auto"). The code now lives in a **new repository of its own, public**, separate from the original academic repository (`Auto-academic-erp/micro-erp-auto`), which was created by another group member and is abandoned as legacy.

**Governance update — 19/08/2026:** the repository was transferred to the organization and renamed to [`Agesto-Platform/Agesto`](https://github.com/Agesto-Platform/Agesto), preserving history, branches, pull requests and CI.

**Origin of the name:** a brand coined from Latin roots — *agere* (to act, to operate) + *gestio* (to manage, management) → **Agesto**. Chosen for sounding serious/international (avoiding Portuguese names, perceived as informal) and for being "ownable" (no prior meaning, making trademark registration easier). "Auto" was discarded for being generic and probably not registrable.

**Commercial + portfolio strategy (same repo):**
- **Public repository** — serves as a portfolio; the README is the key piece (problem, architecture, decisions, screenshots, green tests).
- **Restrictive license, not permissive** — proprietary ("All Rights Reserved") or source-available (BSL/PolyForm Noncommercial), so the code can be read but not used commercially by third parties. **Never MIT/Apache** for this product.
- **Secret hygiene (non-negotiable):** `.gitignore` for `appsettings.*.json`/`.env`; commit only examples (`appsettings.Example.json`); never the Postgres connection string, the Supabase key or the JWT `SymmetricSecurityKey`. Scan the history before publishing.
- When the product matures commercially (paying customer/partner/investor), the repository can become **private** with one click, without rework.

**Pending validation:** check domain availability (`.com`/`.com.br`) and trademark registration at INPI before investing in the final visual identity.

**Scope note:** the code identifiers (`MicroERP.Api`, `MicroERP.Tests`, `MicroERP.*` namespaces) are **not** renamed at this time — it is a mechanical refactor of low value/high risk of noise in the history; it is left for a future cleanup, if and when it makes sense. The rename here is of **product/brand and repository**, not of namespace.

---

## DEC-25 — Web Frontend stack and architecture (Dono Module)

**Status:** ✅ Resolved — implemented (web-01 to web-12, integrated into `main` on 04/08/2026)

**Decision:** The Dono's web frontend (`web/` in the `Agesto-Platform/Agesto` monorepo) uses **Vite + React 19 + TypeScript**, **Tailwind CSS v4** (CSS-first config via `@theme`, tokens ported from the approved prototype `web-dono.html`), **React Router**, **TanStack Query** for server data, **MSW** (Mock Service Worker) as a stateful mock layer while there is no real database/API online, and **Recharts** for charts. Lint via oxlint.

**Context:** The front end had to be built before the new Supabase database was ready (see `project_banco_supabase`). To avoid being blocked on the real schema, the team chose to consume the real API contract (DTOs mirrored in `types/api.ts`) against a stateful mock (MSW), allowing a switch to the real API by changing just one env var.

**Folder architecture decisions:** each business resource lives in `features/<name>/` (Clientes, Produtos, Serviços, Agenda, Orçamentos, Atendimentos, Configuração); reusable UI kit in `components/ui/` (Drawer slide-over, DataTable, ConfirmDialog, TextField/NumberField/SelectField, Toast, Card, Kpi, Money, Pill, RankBar, Alert); `lib/api.ts` unwraps the `ApiResponse` envelope and injects the Bearer token, handling 401; `lib/resource.ts` provides the `createResource` factory (list/create/update/delete with automatic TanStack Query invalidation); stateful mock in `mocks/lib/http.ts` (`makeStore` + `crudHandlers`).

**Forms in a side drawer (slide-over)**, not in a central modal or a full page — a UX decision to keep the list context visible while editing.

**Data switch seam:** the env var `VITE_USE_MOCKS=true|false` turns MSW on/off. Turning it off points straight to the real API via `VITE_API_BASE_URL`, with no code change at all in the features.

**Backend delta solved in the front end (not in the backend):** `GET /api/atendimento` (the real `AtendimentoResponse`) replaced the old fictitious "AtendimentoResumo" format that only existed in the presentation. Since the API returns only `clienteId` (not the client's name), the name is resolved in the front end by joining with the already loaded client list. If this becomes a performance bottleneck, the alternative is to expose `clienteNome` directly in the backend (not decided yet).

**Discarded alternatives:**
- Waiting for the real database/API to be ready before starting the front end → discarded, it would delay the schedule unnecessarily; the API contract was already stable enough to mock.
- Central modal for forms → discarded in favor of the side drawer, which preserves the list context.

**Dependency security:** `react-router-dom` pinned at `7.18.2` — there is a known advisory for RSC mode, accepted as a risk because the project does not use RSC.

**Demo login (mock):** `dono@agesto.app` / `agesto123`.

**Resolution applied:** 12 incremental tasks (web-01 to web-12), all with green build+lint, delivering the scaffold, app shell, API client + mock, JWT authentication, the "Visão geral" (overview) dashboard, the CRUD foundation + Clientes, Produtos, Serviços, Agenda, Orçamentos, Atendimentos and Parametrização.

**Later update:** Relatórios stopped being a placeholder in web-13 and the suite was expanded in web-14 and the following changes. The Dono Module has a functional MVP and runs in production against the real API since DEC-32; MSW is kept for local development.

---

## DEC-26 — Mobile stack and architecture (Agent App)

**Status:** ✅ Resolved — implemented (mob-01 to mob-07, integrated into `main` on 11/08/2026). The two backend deltas below: the uuid→id mapping was resolved by DEC-33; the schedule in the Carga is still pending

**Decision:** The field agent's mobile app (`mobile/` in the `Agesto-Platform/Agesto` monorepo) uses **React Native + TypeScript via Expo (prebuild)**, with **Expo Router** for navigation, design tokens ported from the approved prototype (blue `#243FA6` + green `#12B886`, light theme), and a tab bar (Início/Agenda/Atendimentos/Clientes/Mais). Styling via **theme + StyleSheet** — not NativeWind. Offline persistence via **`expo-sqlite`** on the device, behind its own interface (`LocalDb`), with an in-memory adapter for Web/tests. API client with the standard envelope + 401 handling, and an **in-code mock layer** (`config.useMocks`), analogous to the web's `VITE_USE_MOCKS` (DEC-25). JWT login with the token stored via `expo-secure-store` (device) or `localStorage` (web), split by platform.

**Context:** Like the web front end (DEC-25), mobile had to be built before the new Supabase database was ready and before the Service Provider domain backend (KAN-69) was merged/applied. The in-code mock layer follows the same philosophy as the web's MSW — consume the real API contract, mocked, switchable by a flag.

**React Native instead of Flutter:** a stack decision — TypeScript cohesion with the web (reuse of types and logic), and a smaller maintenance surface for a solo dev (see `project_solo_dev`).

**Expo (prebuild) instead of plain bare React Native:** faster tooling for a solo dev, keeping access to native modules (`expo-sqlite`, `expo-secure-store`) via prebuild when needed.

**`expo-sqlite` behind an interface (`LocalDb`), with two adapters — architecture decision:**
- `index.native.ts` — `expo-sqlite`, used on the device (Android/iOS)
- `index.ts` — in-memory adapter, used on Expo Web and in tests (Jest does not run native `expo-sqlite`)

Reason: allows checking the app end to end on Expo Web and running Jest tests without a physical Android device/emulator, keeping the same data contract in both environments.

**`theme + StyleSheet` instead of NativeWind:** robustness over convenience — avoids an extra build layer (Tailwind-in-RN) and keeps styles typed and predictable, aligned with the prototype's tokens.

**Offline-first cycle (Carga/Descarga), reusing the backend endpoints (KAN-60):**
- **Carga:** login → fills the local database with clients/products/services/configuration. The schedule does **not** come in the Carga — an additional `syncAgenda` step fetches and caches `GET /api/atendimento/agenda` separately (see DEC-17, backend delta).
- **Offline recording:** client + catalog items by quantity (lean contract) + status → saved locally as pending (`SyncedAt = null`).
- **Descarga:** pushes pending clients and pending atendimentos to the server, marks them as synced on confirmation.

**Backend deltas found during the build (not resolved in this decision, recorded as pending — see TASKS.md):**
1. The Carga (`GET /api/sync/carga`) should ideally include the schedule, avoiding the separate `syncAgenda` step on mobile.
2. An atendimento created offline cannot reference a client also created offline (`PendingCliente`), because the local atendimento does not have the client's server id before sync. Solving it would require mapping the client's uuid→id during the Descarga.

**Verification without an Android device:** the whole cycle was validated on **Expo Web** (demo login `agente@agesto.app` / `agesto123`) plus build/lint (`tsc`, `expo lint`) and 15 green Jest tests (jest-expo). React Native component testing (`@testing-library/react-native`) was postponed — version incompatibility between lib v14, jest-expo and React 19 in this time window.

**Discarded alternatives:**
- Flutter → discarded for fragmenting the stack (Dart vs TypeScript), with no reuse of types/logic with the web, worse for solo maintenance.
- NativeWind → discarded in favor of `theme + StyleSheet` (see above).
- Testing only on an Android device/emulator → discarded as the only verification path; Expo Web serves as a fast and reproducible verification environment at this point in the project.

**Resolution applied:** 7 incremental tasks (mob-01 to mob-07) — scaffold, offline data layer, API client + mock + auth, action-first Home, record atendimento, Clientes (list + quick offline registration), Descarga + "Mais" tab with sync status. Build/lint/tests green. Self-review (`revisor-frontend` agent) fixed auth invalidation on a 401 from the real API and an unmount guard. See TASKS.md for the table of commits/details and the remaining open items.

---

## DEC-27 — Parametrização: agent schedule mode and stock control

**Status:** ✅ Resolved — implemented (Plan 1, tasks param-01 to param-08, in `main`).

**Context:** the product serves both **solo providers** and **teams**, and both those who **keep stock** of material (e.g. AC installer) and those who **buy per service** (pass-through, no inventory). Instead of imposing a single behavior, two axes become **parameters per Empresa**, editable by the Dono in **Parametrização** (web).

**Decision — two new fields in `Configuracao`:**
1. `ModoAgendaAgente` (enum `{ Flexivel, Fixa }`, default `Flexivel`):
   - **Flexível (solo):** the agent records an atendimento *now* **or** schedules it for the future (date + time), straight from the app.
   - **Fixa (team):** the agent follows the schedule built by the Dono; **does not create future appointments**. **Walk-in allowed** (recording an ad hoc atendimento *now* is still allowed — owner's decision).
2. `ControlaEstoque` (bool, default `true`):
   - **true:** catalog product items deduct/return stock and validate the balance (current behavior, DEC-11/DEC-18).
   - **false:** the product catalog becomes a **list of materials with price/cost**, without deduction or validation. Serves the pass-through provider, keeping materials as catalog `Produto` (stable id, reusable, with cost — prerequisite of the future "materials kit", see DEC-28/Plan 2).

**Enforcement:**
- The **default is always safe** (`ControlaEstoque = true`, `ModoAgendaAgente = Flexivel`) on every path where the config may be missing; the migration sets `ControlaEstoque = true` for existing companies.
- `ControlaEstoque` is gated in the backend at the **5 stock mutation points** (create/edit/remove product item, cancel atendimento, import in the Descarga).
- `Fixa` has **server enforcement** (param-08): the Descarga **ignores `DataAgendada`** coming from the agent when the company is `Fixa` — defense against a forged payload, on top of the gating in the app. The **online** atendimento path (`AtendimentoController`) stays open because it is the **Dono's** tool (building the schedule is their role).

**Flow to mobile:** `Configuracao` now travels in the **Carga** (`SyncCargaResponse.Configuracao`) — before, it did not. Mobile persists it in `meta` (`appConfig`) with a safe default and uses it to: show/hide the "Agendar" mode when recording and the "+ Agendar" CTA in the Agenda tab; hide the stock hint. The offline contract (`AtendimentoSyncRequest`) gained `DataAgendada` (before, it was dropped between device and server).

**Scope:** parameter per **Empresa** (not per Usuário/agent — per-agent granularity is a future evolution). Cost/supplies on mobile remain **web-only** for now (option 2a): the Dono adjusts margin/cost on the web; the agent only records catalog items.

**Review:** `@revisor` (backend) and `@revisor-frontend` — both **approved**, with no critical/important findings; suggestions applied (explicit stock mock in a test, `appConfig.test.ts`, end of the toggle flicker). Backend 83 tests, mobile 25, web 17 — green.

**Remaining open item:** per-agent granularity of the parameter (today per company); cost/supplies on mobile (option 2b, if it ever makes sense).

---

## DEC-28 — Suggested materials kit per service

**Status:** ✅ Resolved — implemented (Plan 2, tasks kit-01 to kit-06, in `main`).

**Context:** certain services always consume the same materials (e.g. installing a washing machine uses Ts, elbows, thread seal tape). Re-entering them by hand in every quote/atendimento is repetitive and prone to omissions (which bleed stock and margin).

**Decision — a materials "kit" per Serviço:**
- New entity `ServicoItemSugerido` (`EmpresaId`, `ServicoId`, `ProdutoId`, `QuantidadePadrao`), with a unique index `(ServicoId, ProdutoId)`. No soft delete: the `PUT` **replaces the whole set** (delete-all + insert), scoped by `EmpresaId + ServicoId`.
- Materials are always a **catalog Produto** (stable id, reusable, with price/cost). Whether they deduct stock or not depends on `ControlaEstoque` (DEC-27) — solving the pass-through vs stock-keeper case.
- Endpoints `GET`/`PUT /api/servico/{id}/sugeridos`. The Service validates the tenant (the service and each product belong to the company) and dedupes by `ProdutoId` (last quantity wins).

**How it is filled (UX decision):** **curated** by the Dono on the Serviço screen (works from day 1) **+ the "salvar materiais como sugeridos" (save materials as suggested) shortcut** from a real atendimento (builds the kit from actual use — the "used before" the owner asked for — without a frequency engine). Automatic history was **discarded** for now.

**Where it shows up:**
- **Web (Dono):** "Materiais que costuma usar" (materials you usually use) editor on the Serviço; a "Materiais sugeridos (n)" block with 1 click when adding the service to an **Orçamento** and **Atendimento**; "salvar como sugeridos" shortcut.
- **Mobile (Agente):** the suggested items travel in the **Carga** (`SyncCargaResponse.Sugeridos`, flattened) and stay offline (`meta`); when recording, a **"+ Materiais sugeridos (n)"** chip adds the selected services' materials to produtoQty in 1 tap (`Math.max` on the quantity).

**Review:** self-review (reviewers blocked by the session limit in this window; "self-review" as in DEC-26). 1 bug found and fixed: the kit editor on the web overwrote unsaved edits on a focus refetch — fixed with a dirty guard + `refetchOnWindowFocus: false`. Backend 90 tests, mobile 29, web 17 — green.

**Remaining open item:** in the web Atendimento, "Adicionar" fires the mutations in parallel (partial failure not handled — low risk); cost/supplies on mobile remain web-only (DEC-27, option 2a).

---

## DEC-29 — Return to team development and organizational ownership

**Status:** 🟡 In progress — organization, transfer and team done on 19/08/2026; `Protected branches` ruleset active (revised on 10/10/2026); legal formalization still pending

**Decision:** Agesto stops operating as a project maintained by a single person and returns to team development. Davi remains responsible for product decisions. The repository was transferred to the `Agesto-Platform` organization, preserving history, branches and contributions.

**Reason:** although the MVP advanced under individual development, commercial continuity requires human review, split responsibilities, continuity of access and the ability to evolve in parallel.

**Initial rules:**
- monorepo kept while backend, web and mobile evolve in a coupled way;
- `feature/* → develop → main` flow through pull requests;
- `develop` and `main` protected by a required PR and by the Backend, Web and Mobile checks, without required approval (revised on 10/10/2026);
- permissions granted by role and with least privilege;
- official documentation versioned in `docs/project/`;
- founding team recorded as Davi Gomes Rocha (Founder and Product Owner), Depowo (Cofounder, initial focus on infrastructure) and ghzpro034 (Cofounder, generalist role);
- Davi and Depowo as Owners of the organization; ghzpro034 as Member with Write access through the visible `Core` team;
- intellectual property and final responsibilities per module still need to be formalized.

**Impact on earlier decisions:** mentions of "solo dev" remain as historical context of the original decision and do not represent the current team. The choice of React Native, C# and monorepo does not change automatically with the team's return; any revision will be a new explicit decision.

---

## DEC-30 — MVP hosting on free tiers: Cloudflare Pages + Oracle Cloud + Supabase

**Status:** ⚠️ Partially replaced by DEC-32 on 08/10/2026 — the web stays on Cloudflare Pages; the API moved from Oracle to Render and the database was recreated on Supabase in N. Virginia

**Decision:** The MVP will be hosted only on free tiers:
- **Web (Dono Module):** Cloudflare Pages, serving the static Vite build.
- **API (.NET 8):** Oracle Cloud Always Free Ampere A1 (ARM) VM, with the API in a Docker container behind a reverse proxy with HTTPS.
- **Database:** Supabase (PostgreSQL), Free plan, used only as a managed Postgres; authentication remains the API's own JWT.
- **Region:** São Paulo for the API (`sa-saopaulo-1`, as the Oracle account's home region) and for the database (Supabase South America), keeping the API next to the database.

**Reason:** zero cost in the MVP phase. The Oracle VM stays on 24h, with no cold start, and allows putting the API in Brazil next to the database. Cloudflare Pages allows commercial use on the free plan.

**Discarded alternatives:**
- **Vercel Hobby** for the web → forbids commercial use.
- **Render** for the API → no region in Brazil and a cold start of about 1 minute on the free plan.
- **Google Cloud Run** for the API → requires a card and charges outside the quota; passed over by the team.
- **Azure App Service F1** → 60 min of CPU per day limit, no support for production.
- **Neon** for the database → the team chose to keep Supabase, already used in the initial setup (KAN-14).

**Risks and mitigations:**
- **Supabase Free pauses** after 7 days without activity → the API's `/health` endpoint queries the database and is called periodically by an external monitor.
- **No automatic backup on Supabase Free** → scheduled periodic `pg_dump`, stored outside Supabase.
- **Supabase Data API exposes the `public` schema** through the REST API with the (public) `anon` key → Data API turned off in the project; the database is accessed only through the .NET API.
- **Oracle reclaims idle VMs from Always Free accounts** (7 days with CPU, network and memory below 20%), and the MVP API is idle most of the time → **account converted to Pay As You Go** with a budget alert; the VM is out of the reclaim rule and still costs nothing within the Always Free limits. Oracle also changed the limits without notice in 2026 (A1 reduced to 2 OCPUs / 12 GB) → size within the current limit and keep the deploy reproducible (Dockerfile + compose in `deploy/oracle/`) to recreate the VM.
- **Oracle's home region is permanent** and A1 capacity is not guaranteed → confirm São Paulo when creating the account.
- **Temporary domain:** while there is no own domain, the API uses `api.<IP>.sslip.io` for automatic HTTPS → public IP reserved on Oracle so the address does not change; when adopting an own domain, change the URL on the web and mobile.
- **VM operation** (OS, Docker, HTTPS, firewall, updates) is with the infrastructure team (Depowo).
- **Secrets** (connection string, JWT key) only in environment variables on the VM, never in Git.

**Impact on earlier documents:** replaces the mention of Azure in `docs/PROJETO_CONTEXTO.md` (historical context) and defines the hosting that `DESIGN.md` section 8 left open. `SETUP_LOG.md`, the historical record of the original development Supabase, was removed on 21/10/2026 because it contained personal data of former members; it remains accessible in the Git history.

**Review:** free tiers are not recommended by the providers for production. When revenue comes in, reassess Supabase Pro (no pause, with backup) and the API hosting.

---

## DEC-31 — Migrations consolidated into a single `InitialCreate` for the new database

**Status:** ✅ Applied on 08/10/2026 to the São Paulo Supabase through the SQL Editor; `__EFMigrationsHistory` contains only `20261008213822_InitialCreate` and the 12 tables were checked. With DEC-32, the database is recreated in N. Virginia with the same script

**Context:** when generating the idempotent script for the new database (DEC-30), we found that the `20260618193156_ConvertEnumsToString` migration has an empty `Up()`: the corresponding schema had been applied by hand to the old Supabase and the migration was emptied just to align the history. On a new database, the script would run without error, but would create the schema **without the `Empresas` table and without the `EmpresaId` columns**. The EF snapshot was correct, which is why `has-pending-model-changes` reported nothing.

**Decision:** replace the 10 previous migrations with a single `InitialCreate` (`20261008213822_InitialCreate`), generated from the current model. Possible because no database in use depends on the old history: the old Supabase will be replaced.

**Verification:** the generated `AppDbContextModelSnapshot.cs` differs from the previous one only by the `ModoAgendaAgente` fix below; the script has the 12 tables, including `Empresas`, and no destructive operation; build and 90 tests green.

**Discarded alternative:** rewriting by hand the `Up()` of `ConvertEnumsToString` mirroring the `Down()` (28 operations) → would preserve the history, but with the risk of manual error and no way to prove equivalence with the model.

**Model divergences found in the review:**
- `Configuracao.ModoAgendaAgente` was persisted as `integer`, without `HasConversion<string>()`, going against the enums-as-string invariant → **fixed** in the same migration (`varchar(10)`), taking advantage of the still empty database.
- `Orcamentos` and `ServicoItemSugeridos` have an indexed `EmpresaId`, but no foreign key to `Empresas` → not changed; awaiting a decision.

**Rule from here on:** no migration may have its `Up()` emptied to "sync history". A change applied by hand to any database must be reverted or reproduced by the migration.

---

## DEC-32 — API on Render and database on Supabase in N. Virginia

**Status:** 🟢 Provisioned — API on Render (`agesto-api.onrender.com`) and database on Supabase in N. Virginia in production; `/health` pinged by the Cloudflare Worker `agesto-keepalive` every 5 min since 11/11/2026 (before, cron-job.org)

**Decision:** replaces the API and database part of DEC-30:
- **API (.NET 8; .NET 10 since DEC-40):** Render, Free plan, Web Service with the existing `Dockerfile`, configured by the `render.yaml` at the root. Region **Virginia**. Deploys `main` (since DEC-41) only after CI passes (`autoDeployTrigger: checksPass`).
- **Database:** new Supabase project in **East US (N. Virginia)**, next to the API, with the same `InitialCreate` from DEC-31. The São Paulo project is no longer used.
- **Web:** no change, stays on Cloudflare Pages.

**Reason:** the Oracle VM requires operation (OS, Docker, HTTPS, firewall) and, without Pay As You Go, can be stopped for idleness; with Pay As You Go, it requires a card. Render requires neither a card nor a server to maintain.

**Why change the database region:** Render has no region in Brazil. With the API in Virginia and the database in São Paulo, each query would cross US↔Brazil (~120 ms each, several per request). With both in Virginia, the user in Brazil pays that distance once per request. The switch was made while the database was still empty.

**Discarded alternatives:**
- **Keep Oracle** → VM operation and risk of reclaim for idleness (see DEC-30).
- **Google Cloud Run** in São Paulo → requires a card.
- **Change the API architecture** (TypeScript on Cloudflare Workers or Supabase directly with RLS) → rewriting ~5,500 lines and 51 already tested endpoints just to solve hosting; goes against the principle of small changes in the MVP.

**Risks and mitigations:**
- **The API sleeps after 15 min without traffic** and takes ~1 min to wake up → an external monitor calls `/health` (uses ~744 of the 750 monthly hours; a second Free service on 24h does not fit). It was cron-job.org every 10 min; since 11/11/2026 it is the Cloudflare Worker `agesto-keepalive` every 5 min, versioned in `deploy/keepalive/` (`deploy/README.md`, section 6).
- **Supabase Free pauses** after 7 days without activity → the same ping, because `/health` runs `SELECT 1`.
- **512 MB of RAM and 0.1 CPU** → enough for the MVP; reassess at the first sign of slowness.
- **No persistent disk** → the API does not write files today; future uploads need external storage.
- **SMTP blocked** on the Free plan → future email sending through an HTTP API.
- **Brazil↔US latency** (~120 ms per request) → accepted in the MVP; mobile is offline-first.

**Impact on the code:** none on the logic. `deploy/oracle/` was removed (it stays in the Git history); the step by step is in `deploy/README.md`.

**Review:** when revenue comes in, reassess Render Starter (no sleeping) and Supabase Pro (no pause, with backup).

---

## DEC-33 — Reliable sync: full Carga, Descarga per atendimento and offline client by UUID

**Status:** 🟢 Implemented in `develop` and `main` (PR #43, 10/10/2026)

**Context:** a review of the Carga/Descarga cycle found data loss on mobile:
- the Carga was incremental (`ultimaSincronizacao`), but the app replaces the whole local table on every Carga — from the second sync on, unchanged clients/products/services disappeared from the device; deletions (soft delete) never reached the device;
- the app marked **all** pending items as synced, even those the server rejected (only reported in `Erros`), losing them;
- the Descarga saved the atendimento without the invalid items (nonexistent product, insufficient stock), with a lower `ValorTotal`; it did not validate `ClienteId` against the company; a negative quantity increased stock.

**Decision:**
1. **Always a full Carga** on mobile (no `ultimaSincronizacao`). The parameter is still accepted by the backend, but the app does not use it. The target audience's catalog volume makes the cost irrelevant; we gain propagation of deletions without tombstones.
2. **All-or-nothing Descarga per atendimento:** client, items, quantities (> 0) and stock (summed per product) are validated before saving; any failure rejects the whole atendimento, which stays pending on the device. One atendimento's failure does not block the others in the batch.
3. **Explicit confirmation:** `SyncDescargaResponse` returns `ClientesSincronizados` and `AtendimentosSincronizados` (imported now or already existing). The device only marks as synced what is in those lists.
4. **The client's UUID is born on the device:** `ClienteCreateRequest.Uuid` (optional; absent = generated on the server). Resending the same client is idempotent.
5. **An atendimento references a client created offline** through `AtendimentoSyncRequest.ClienteUuid` (`ClienteId` becomes optional). Clients are processed before atendimentos in the same batch; the response brings `ClientesMapeados` (uuid → id) and the device relinks the local atendimentos to the server id. An offline client with an already existing CPF is mapped to the existing client (consistent with DEC-06).
6. The mobile Sincronizar button now does a Descarga followed by Carga + schedule, and reports how many items were not sent.

**Impact:** the Descarga contract changed — API and mobile must be released together. Resolves the pending items "Map the client's uuid→id in the Descarga" (DEC-26) and the data loss above. Tests: backend 127, mobile 32 — green.


---

## DEC-34 — Security hardening after the audit

**Status:** 🟢 Implemented and validated in production on 10/10/2026 (PRs #44 and #45)

**Context:** an audit of API, front end, database and infrastructure with the system already in production. There was no active leak (Supabase Data API turned off), but there were exploitable gaps: no attempt limit, no profile check, open sign-up, irrevocable token, full personal data on the agent's phone.

**Decision:**
1. **Closed sign-up.** `POST /api/auth/register` only works with `Auth:RegistrationKey` configured and sent in `X-Registration-Key`; without the key, it answers 404. Reopening requires email verification (pending).
2. **Profiles on the back end.** `Dono` policy on every management route; the Agente uses only sync and their own schedule. A test fails if a new action does not declare the policy.
3. **Rate limiting** per IP on login and sign-up and per user on sync.
4. **Token revalidated on every request:** a deleted user, one from another company or with a changed profile loses access immediately, without waiting for the JWT to expire.
5. **LGPD:** the Agente receives a masked CPF and quotes without cost in the Carga; a deleted client is anonymized (name, CPF, phone and address), keeping the row for the history.
6. **Database:** RLS on all tables with no access for `anon`/`authenticated`; the API connects with the `agesto_api` role (DML only, `deploy/api-role.sql`) and TLS `VerifyFull` with the Supabase CA.

**Validation in production (10/10/2026):**
- Supabase: Data API turned off and `pg_graphql` not installed (no public access to the tables); RLS active on all tables.
- API: security headers and HSTS present; sign-up answers 404; login and sign-up block with 429 after the limit; payload above the limit refused with 413 (tested locally).
- Web (Cloudflare): CSP, `X-Frame-Options` and HSTS present; the CSP allows only the API used by the production bundle.
- Database: API connecting as `agesto_api` with `SSL Mode=VerifyFull`; Supabase CA checked with `openssl` on the `aws-0` and `aws-1` poolers of us-east-1. The `ssl = false` in `pg_stat_ssl` refers to the internal pooler → Postgres hop.
- Login, configuration, clients, products, services, quotes, atendimentos, schedule, sync and dashboard answering 200 with the test account after all the changes.

**Pending:**
- **Email verification** before reopening sign-up. Depends on a sending provider with an HTTP API (Render blocks SMTP; suggestion: Resend) and on an own verified domain.
- **Automatic backup** of the database (the Supabase Free plan does not do it).
- ~~**Migration to .NET 10** (.NET 8 loses support on 10/11/2026).~~ Done in DEC-40.


---

## DEC-35 — User management by the Dono and the atendimento's responsible person

**Status:** 🟢 Implemented in `develop` and `main` (PR #47, 19/10/2026); migration applied on Supabase

**Context:** there was no way to create an Agente user (sign-up only creates a Dono) and every atendimento stayed with whoever created it (`UsuarioId` = creator). The agent app only worked with a user inserted directly into the database.

**Decision:**
1. **Usuários tab on the web (Dono only).** `GET/POST/PUT /api/usuario`, `POST /api/usuario/{id}/desativar`, `/reativar` and `/redefinir-senha`, all with the `Dono` policy.
2. **No email invitation.** The server generates a temporary password (10 characters, alphabet without ambiguous characters), shown only once to the Dono, who passes it on to the agent. The user is born with `DeveTrocarSenha = true` and web and app lead to the password change screen on first access (`POST /api/auth/trocar-senha`). Email is still pending from DEC-34. *Replaced by DEC-55 (12/11/2026): new access gets an email invitation and the person creates their own password; the temporary password is gone.*
3. **Deactivate instead of delete.** `Usuario.Ativo` (default `true` for existing users). An inactive user cannot log in (403) and `TokenRevalidator` drops the token immediately. Atendimento history is preserved.
4. **Rules:** the Dono cannot deactivate or demote themselves; the company needs at least one active Dono.
5. **Atendimento's responsible person.** Optional `ResponsavelId` on atendimento create/update; absent = the Dono themselves (create) or unchanged (update). Validated against the company and only active users. The agent's schedule now shows what the Dono assigned; on the web, "Toda a equipe" (whole team) and "Com {nome}" (with {name}) filters.
6. `UltimoAcessoEm` recorded at login, shown in the list.

**Impact:** migration `AddUsuarioAtivoESenhaProvisoria` (3 columns in `Usuarios`). API, web and app must ship together because of `deveTrocarSenha` at login.


---

## DEC-36 — Agent registers a service in the app, with the Dono's review

**Status:** 🟢 Implemented in `develop` and `main` (PR #47, 19/10/2026); migration applied on Supabase

**Context:** on the web, a service outside the catalog already becomes a quick registration (DEC-22), but the app could not do it: the whole service API requires the Dono profile and the Descarga only accepted items with a server id. In the field, the agent had no way to record a new service.

**Decision:**
1. **Same path as offline clients (DEC-33).** The app creates the service with a device UUID and can use it in the atendimento right away. The Descarga accepts `Servicos` (up to 100 per batch), creates them before the atendimentos and returns `ServicosSincronizados` and `ServicosMapeados`; the service item accepts `ServicoUuid` instead of `ServicoId`. The app relinks the items to the real id.
2. **No duplicates.** Resending with the same UUID does not create it again; a description equal to an active service (ignoring case and spaces) reuses the existing one, and the atendimento uses the catalog price.
3. **Dono's review.** `Servico.Revisado` and `Servico.CriadoPorUsuarioId`. Created by the agent, it is born `Revisado = false`; on the web it shows "A revisar · criado no app por Fulano" (to review · created in the app by so-and-so), with a filter and a button to mark it as reviewed (`POST /api/servico/{id}/revisar`). Editing on the web also counts as a review. Existing services stay reviewed.
4. **Switch in Parametrização.** `Configuracao.AgenteCadastraServico`, on by default. When off, the Descarga rejects a new service from the agent (the atendimento that uses it stays pending in the app with the reason); the Dono still can.

**Impact:** migration `AddServicoCriadoPeloAgente` (2 columns in `Servicos` with an FK to `Usuarios` `SET NULL`, 1 in `Configuracoes`). The Descarga contract only gained optional fields: an old app keeps working.


---

## DEC-37 — Day's route by address, without geocoding (phase 1)

**Status:** 🟢 Implemented in `develop` and `main` (PR #47, 19/10/2026)

**Context:** the ready route plan has three phases and all of them depend on the client's latitude and longitude, which require a geocoding service (cost, quota and sending the address to a third party, an LGPD point not decided yet). Opening Google Maps with the stops does not need that: the URL accepts text addresses.

**Decision:**
1. The schedule (`AgendaItemResponse`) now brings `EnderecoCompleto` (street, number, neighborhood, city and CEP); null when the client has no street.
2. In the app, the Início screen shows "Iniciar rota · N paradas" (start route · N stops): it opens Google Maps with **today's pending** visits, in time order, starting from the phone's current location. Limit of 10 stops (destination + 9 in the URL); the app warns about who was left out (no address or beyond the limit).
3. Each visit with an address gets a button that opens navigation to that client only.
4. The address goes to Google from the agent's own phone, by their action, as would already happen by copying the address. Nothing is sent by the server.

**Pending (next phases):** choose the geocoding service (suggestion: OpenRouteService), record the LGPD decision, `Cliente.Latitude/Longitude`, `Servico.DuracaoMinutos`, a map with pins on the web and "Otimizar dia". Update on 11/11/2026: only "Otimizar dia" is left; the rest was delivered (DEC-38 and DEC-45).

**Impact:** no migration. New optional field in the schedule; an old app ignores it.


---

## DEC-38 — Geocoding with OpenRouteService and schedule map with Leaflet

**Status:** 🟢 Implemented in `develop` and `main` (PR #47, 19/10/2026); migration applied on Supabase. Provider approved by Diego on 17/10/2026.

**Context:** the schedule map and route optimization (phase 2) need the clients' latitude and longitude, and the system only stores the address as text.

**Decision:**
1. **Geocoding:** OpenRouteService (free plan, the same platform that will do the phase 2 optimization), behind the `IGeocodificador` interface to switch providers without touching the rest. Key in `Geocoding__OpenRouteServiceApiKey`; without it, geocoding is off.
2. **In the background:** a `BackgroundService` geocodes clients with a street and a null `GeocodificadoEm`, in batches of 25 with 1.5 s between calls (within the ~100 per minute quota). Registration and sync do not wait for the provider. An address not found is marked and not retried; a network or quota failure leaves it pending and the worker waits 10 minutes. Changing the address clears the coordinates so it is geocoded again. Existing clients are converted on the first run.
3. **LGPD:** only the address (street, number, neighborhood, city, CEP and "Brasil") goes to the provider, never name, CPF or phone; the key goes in the header, outside the URL. A deleted client has the coordinates cleared together with the address.
4. **Map on the web:** "Mapa" tab in the Agenda, one day at a time, pins numbered by time order and colored by responsible person, with an atendimento popup and a list of those without a location. Leaflet with OpenStreetMap tiles, loaded only when the tab is opened. The panel's CSP allows `https://tile.openstreetmap.org` in `img-src`.

**Impact:** migration `AddClienteCoordenadas` (3 columns in `Clientes` + index). New variable on Render. New web dependency: `leaflet` (+ `@types/leaflet`). The OpenStreetMap tile usage policy applies to low volume; if usage grows, switching to a tile provider (e.g. MapTiler) is just changing the URL and the CSP.

---

## DEC-39 — Atendimento in the app on par with the web

**Status:** 🟢 Implemented in `develop` and `main` (PR #48, 20/10/2026). Requested by Diego on 20/10/2026, after the web × app comparison (document outside the repository).

**Context:** in the app, the agent could only use the catalog price, could not complete a scheduled visit (only create another atendimento), could not correct anything after saving and saw an "Estimado" (estimate) different from what the server charged for an empreitada with quantity 2.

**Decision:**
1. **Adjusted value (DEC-23 in the app):** the Descarga accepts an optional `PrecoUnitario` on the catalog product item and on the service item; null charges the catalog price. In the app, each item's value is editable and shows up marked as "ajustado" (adjusted).
2. **Complete an existing atendimento:** new `Conclusoes` list in the Descarga, with the server atendimento's uuid, the new status and added items (the ones already saved do not change). The Agente only completes atendimentos they are responsible for; the Dono completes any. Each item carries a device `Uuid`, and a resend is recognized by it, without duplicating. An already finished atendimento rejects new items. The schedule now brings the items already recorded (`Itens`) so the agent can see what was agreed.
3. **Correct before sending:** an atendimento or completion not yet sent can be reopened, changed or deleted on the device.
4. **Empreitada:** keeps DEC-04. App and web record one line per unit (quantity 2 = two lines), and the app's estimate matches what the server charges.

**Impact:** no migration. The Descarga and schedule contracts only gain optional fields, so an old app keeps working.

---

## DEC-40 — Backend migrated to .NET 10

**Status:** 🟢 Implemented in `develop` and `main` (PR #53, 21/10/2026) and validated in production by Davi (Live deploy on Render, login and sync tested). Requested by Davi on 20/10/2026.

**Decision:** API and tests move from `net8.0` to `net10.0` (LTS), before the end of .NET 8 support on 10/11/2026.
- ASP.NET Core and EF Core packages at `10.0.13`, `Npgsql.EntityFrameworkCore.PostgreSQL` provider at `10.0.3`; Api and Tests stay on the same EF Core version (DEC-13).
- `Swashbuckle.AspNetCore` from 6.6.2 to 10.3.1: `Microsoft.AspNetCore.OpenApi` 10 uses `Microsoft.OpenApi` 2.x, incompatible with Swashbuckle 6. Major done by hand, with validation (rule in `dependabot.yml`).
- Docker images `sdk:10.0` and `aspnet:10.0`; CI with `dotnet-version: 10.0.x`.
- `ForwardedHeadersOptions.KnownNetworks` (obsolete in .NET 10) replaced by `KnownIPNetworks`, without changing the behavior.

**Impact:** no migration (`has-pending-model-changes` reports no changes with EF Core 10). API contracts unchanged. The new Docker image was validated in the Render deploy.

---

## DEC-41 — `main` é a produção; `develop` é integração e teste local

**Status:** 🟢 Implementado em 21/10/2026, pedido por Diego e autorizado por Davi: PR #60 promoveu a `develop` para a `main` (merge commit) e Render e Cloudflare passaram a publicar a `main`; previews da Cloudflare desligados.

**Decisão:** o Render (API) e a Cloudflare Pages (web) publicam a `main`. A `develop` recebe as funcionalidades novas e é testada na máquina, com API local e Postgres local (`docker-compose.yml`, parte da KAN-14), sem ambiente de homologação na nuvem.
- Preview deployments da Cloudflare desligados, para nada fora da `main` falar com a API de produção.
- Promoção sempre por PR `develop → main` com merge commit, nunca squash, para as duas branches manterem o mesmo histórico.
- Migration nova é aplicada no Supabase antes do merge na `main` e precisa ser compatível com a versão anterior da API.

**Por quê:** o plano Free do Render dá para um serviço ligado 24 h, não dois, e o Supabase Free tem dois projetos; um ambiente de homologação na nuvem custaria dinheiro ou acordaria a API pela metade. Teste local cobre o tamanho atual da equipe.

**Impacto:** sem migration e sem mudança de código. Passo a passo em `deploy/README.md` (seções 8 e 9).

---

> **DEC-42 a DEC-45** estão reservadas para o lote de outubro do Davi Gomes (paginação opcional, bloqueio da conta, exclusão de usuário com anonimização e duração do serviço). Os PRs #98 a #102 foram fechados sem merge em 25/10/2026, a pedido dele, para retomar depois; as branches seguem no GitHub. A DEC-42 foi retomada em 28/10/2026; DEC-43 a DEC-45 foram retomadas em 11/11/2026 (PRs #133 e #134).

---

## DEC-42 — Paginação opcional nas listas

**Status:** 🟢 Implementado em `develop` e `main` (PR #98, reaberto e mesclado em 28/10/2026), pedido por Davi.

**Decisão:** `GET` de clientes, atendimentos, orçamentos, produtos e serviços aceitam `?pagina=&tamanho=` (padrão 20, máximo 100) e então devolvem `{ itens, pagina, tamanho, total }`. Sem os parâmetros, a resposta continua sendo a lista inteira.

**Por quê:** o web usa as listas completas em buscas e seletores, e o mobile não usa esses endpoints (só o sync); paginação opcional não quebra nenhum consumidor e fica pronta para quando uma tela precisar.

**Impacto:** sem migration. A paginação é feita no banco e a ordenação ganhou desempate por `Id`.

**Atualização (PAG-01, 12/11/2026):** a paginação ficou obrigatória. Sem `?pagina=&tamanho=`, as cinco listas devolvem a página 1 com 20; o teto continua 100. O web deixou de baixar listas inteiras: as telas carregam de 50 em 50, os campos de escolha de cliente, produto e serviço buscam no servidor, e os nomes de cliente e itens vêm nas respostas. Novos: busca em produtos, serviços e orçamentos, `ids` em produtos, `revisado` em serviços, `ordem=registro` em atendimentos e `GET /api/orcamento/resumo`. Usuários continua sem paginação.

---

## DEC-43 — Bloqueio da conta após senhas erradas

**Status:** 🟢 Em `main` (PR #133, release #134, 11/11/2026). Código do lote de outubro do Davi Gomes, integrado por Davi Oliveira; migration `AddBloqueioLoginExclusaoLgpdDuracaoServico` aplicada no Supabase em 11/11/2026.

**Decisão:** 5 senhas erradas seguidas na mesma conta bloqueiam o login por 15 minutos, mesmo com a senha certa; a API responde 423 com os minutos restantes. Login certo zera o contador. A senha provisória gerada pelo Dono ou pela equipe do Agesto (DEC-52) desbloqueia na hora. Vale para Dono e Agente; o login da área de superadmin não tem esse bloqueio.

**Por quê:** complementa o limite por IP, que não segura tentativas vindas de vários IPs.

**Impacto:** colunas `Usuarios.TentativasLoginFalhas` e `Usuarios.BloqueadoAte`. Quem sabe o email de alguém consegue bloquear essa conta por 15 minutos; o limite por IP reduz o abuso.

---

## DEC-44 — Exclusão da própria conta com anonimização

**Status:** 🟢 Em `main` (PR #133, release #134, 11/11/2026). Código do lote de outubro do Davi Gomes, integrado por Davi Oliveira.

**Decisão:** a exclusão da própria conta (`DELETE /api/usuario`, LGPD) deixa de apagar a linha: o usuário é anonimizado ("Usuário removido", email `removido-{id}@anonimo.invalid`), ganha uma senha aleatória e `DeletedAt`. O histórico (atendimentos, orçamentos) continua apontando para a linha, a pessoa não entra mais e o email real fica livre. A empresa não pode ficar sem Dono ativo.

**Por quê:** o DELETE físico falhava com erro 500 para quem tinha atendimentos ou orçamentos (chaves estrangeiras *Restrict*) e contrariava o soft delete das entidades operacionais.

**Impacto:** coluna `Usuarios.DeletedAt`. Listas de usuários, inclusive as da área de superadmin, ignoram os removidos, e o token deles cai na hora.

---

## DEC-45 — Duração do serviço e receita por hora

**Status:** 🟢 Em `main` (PR #133, release #134, 11/11/2026). Código do lote de outubro do Davi Gomes (KAN-79), integrado por Davi Oliveira.

**Decisão:** `Servico.DuracaoMinutos` (opcional, de 1 a 1440) entra no cadastro de serviço do web. As métricas de serviços passam a devolver horas e receita por hora: serviço por hora usa as horas lançadas; serviço por empreitada usa execuções vezes a duração estimada, e fica sem R$/h quando não tem duração. Os Relatórios mostram o R$/h por serviço.

**Por quê:** parte restante do KAN-79. A margem por hora continua pendente, porque o custo ainda não é atribuído ao serviço.

**Impacto:** coluna `Servicos.DuracaoMinutos`. O Agente IA (DEC-21) recebe as horas e o R$/h junto com as métricas.

---

## DEC-46 — Plano de lançamento do MVP: escopo e cronograma

**Status:** 🟢 Decidido por Diego em 22/10/2026 no plano de lançamento, com aval do Davi Gomes no merge do PR #106 (27/10/2026). O plano completo, com tarefas, prazos e status por pessoa, está no documento "Agesto: plano de lançamento do MVP".

**Decisão:**
1. **Público do lançamento:** o prestador de serviço com equipe pequena (Dono no web, agentes no app Android). O modo Venda/Híbrido, o comerciante e a IA (DEC-21) ficam fora do lançamento.
2. **Cronograma:** ensaio geral em 03/11, piloto pago com desconto de 04/11 a 28/11 com um cliente real, revisão do piloto em 01/12 e lançamento oficial em 15/12/2026.
3. **Portão do piloto (bloqueadores):** APK instalável, API sem dormir, backup diário do banco, sessão de 30 dias (DEC-50), CPF validado pelo dígito no app e no web, termos de uso e política de privacidade aceitos no primeiro acesso, monitor do `/health` e chave do OpenRouteService no Render.
4. **Cobrança:** sem módulo de cobrança no piloto. Para o lançamento, o Dono marca no web se o atendimento foi pago ou está em aberto, com forma e data do pagamento (cobrança mínima). A assinatura do Agesto é mensal por empresa, com faixas pelo número de agentes, paga por link de pagamento recorrente.
5. **Outras decisões do plano:** o agente pode mudar o preço no app (DEC-39 mantida); organização `agesto` no expo.dev; pacote Android `br.com.agesto.app`; acordo do piloto por escrito; termos escritos por Davi Gomes com revisão jurídica; domínio próprio (ex.: `agesto.com.br`); suporte por WhatsApp Business e email; redesign no web antes do lançamento e no app depois (DEC-51).

**Responsáveis:** Davi Gomes (mobile e geral), Davi Oliveira (web e geral) e Diego (infra e redesign). A divisão das tarefas está em `TASKS.md`, seção "Lançamento do MVP".

**Impacto:** a seção "Lançamento do MVP" do `TASKS.md` passa a ser a prioridade; o resto do backlog só entra se não atrasar o portão do piloto.

---

## DEC-47 — Android só por APK, fora das lojas

**Status:** 🟡 Decidido por Diego em 22/10/2026, com aval do Davi Gomes (PR #106, 27/10/2026). Projeto do app pronto em `develop` (PR #108, 28/10/2026: `eas.json`, `br.com.agesto.app`, `expo-updates` e aviso de versão) e página de download em `/baixar` (PR #111). Falta o primeiro `eas build` até 31/10.

**Decisão:** o app do agente não vai para a Google Play nem para a App Store. No Android ele é sempre distribuído como APK, gerado pelo EAS Build e baixado de uma página do Agesto com o passo a passo de instalação. Correções de JavaScript chegam por `eas update` (OTA); mudança nativa exige APK novo.
- Todo APK é assinado com a mesma chave, para instalar por cima do anterior sem perder os dados offline. Uma cópia da chave fica guardada fora do repositório e do Expo.
- O app avisa quando existe versão nova que precisa de APK novo.
- iPhone fica fora por enquanto: o piloto e o lançamento são só Android.

**Por quê:** evita a taxa e a revisão das lojas e dá controle total do ritmo de versões para um produto vendido diretamente a poucas empresas.

**Impacto:** `mobile/eas.json`, `android.package` = `br.com.agesto.app` e `expo-updates` no app; ícone, ícone adaptativo e splash do Agesto.

---

## DEC-48 — Cadastro aberto com verificação de email e período de teste

**Status:** ⛔ Substituída pela DEC-57 (12/11/2026): não haverá cadastro aberto; a assinatura começa pelo contato. Decidida antes por Diego em 22/10/2026, com aval do Davi Gomes (PR #106, 27/10/2026).

**Decisão:** no lançamento, qualquer prestador cria a conta pelo web, confirma o email e ganha um período de teste antes de assinar. Isso substitui, a partir do lançamento, o cadastro fechado por `Auth__RegistrationKey` da DEC-34. O rate limit por IP continua.

**Por quê:** a venda direta não escala se cada conta nova depender de alguém da equipe. A DEC-34 já condicionava reabrir o cadastro à verificação de email.

**Impacto:** depende de domínio próprio e de provedor de email por API (ex.: Resend), que também atende o "esqueci a senha". A chave de cadastro fica só para contas criadas pela equipe durante o piloto.

---

## DEC-49 — Hospedagem paga para o piloto e o lançamento

**Status:** 🟡 Decidido por Diego em 22/10/2026, com aval do Davi Gomes (PR #106, 27/10/2026). A fazer: Render Starter antes do ensaio, Supabase Pro no lançamento.

**Decisão:**
1. **API:** Render Starter antes do piloto, para a API não dormir (no Free a primeira chamada leva cerca de 1 minuto e o app do agente sofre com isso no campo).
2. **Backup:** `pg_dump` diário por GitHub Actions, guardado fora do Supabase, com um teste de restauração antes do piloto.
3. **Banco:** Supabase Pro a partir do lançamento, para ter backup gerenciado e não pausar por inatividade. No piloto, o Free com o backup do item 2 basta.

**Por quê:** revê o "plano gratuito" das DEC-30 e DEC-32 para clientes pagantes, que não podem esperar a API acordar nem perder dados.

**Impacto:** custo mensal fixo de hospedagem, a entrar no preço da assinatura (DEC-46). Sem mudança de código; o backup ganha um workflow novo em `.github/workflows/`.

---

## DEC-50 — Sessão de 30 dias

**Status:** 🟢 Decidido por Diego em 22/10/2026, com aval do Davi Gomes (PR #106, 27/10/2026). Implementado em `develop` e `main` (PR #109, 28/10/2026): `Jwt:ExpiresMinutes` = 43200. Desativar o usuário já derruba a sessão; trocar a senha ainda não derruba as sessões abertas (o `TokenRevalidator` só confere usuário ativo, empresa e perfil), ponto em aberto.

**Decisão:** o login vale 30 dias na API e no app (hoje o JWT expira em 120 minutos, `Jwt:ExpiresMinutes`). A revogação da DEC-34 continua: desativar o usuário ou trocar a senha derruba a sessão na próxima requisição.

**Por quê:** o agente trabalha offline e não pode ser deslogado no meio do dia, sem internet, com atendimentos pendentes de envio.

**Impacto:** sem migration. Configuração no Render e ajuste no app para tratar sessão vencida sem perder dados locais.

---

## DEC-51 — Redesign do web

**Status:** 🟢 Em `develop` e `main` (PRs #80 a #95, de 22 a 25/10/2026): Diego fez o redesign e Davi Oliveira o ajuste do painel do Agente (#95).

**Decisão:** o painel do Dono passou a seguir os templates aprovados em `agesto/design/templates`, com os mesmos dados e fluxos de antes:
- paletas Marinho + Vermelho (padrão) e Oceano, cada uma com tema claro e escuro, escolhidas em "Aparência"; fonte Geist servida pelo próprio app, sem CDN;
- sidebar recolhível, trilha de navegação, busca (Ctrl K) e menu em gaveta no celular;
- login novo sem entrar com conta social, símbolo Bloco como marca e favicon;
- gavetas e diálogos por cima da tela inteira, revisão visual das telas e painel do Agente recolhido entre telas.

**Por quê:** a DEC-46 pede o redesign no web antes do lançamento; o app recebe o mesmo visual depois.

**Impacto:** só front-end, sem mudança na API. O painel do Agente aparece como "Prévia" e não faz parte do lançamento (a IA ficou fora do escopo na DEC-46); desde 10/11/2026 o chat dele funciona com a IA da DEC-21, ainda com o selo "Prévia". Falta fechar o design system até 17/11.

---

## DEC-52 — Área de superadmin da equipe do Agesto

**Status:** 🟢 Em `main` (PR #131, release #132, 10/11/2026), decidido por Davi Oliveira em 10/11/2026. Migration `AddSuperadmin` aplicada no Supabase em 10/11/2026; o primeiro admin foi criado no mesmo dia.

**Decisão:** a equipe do Agesto gerencia as empresas clientes em `/admin`, no web atual:
- contas de admin separadas dos usuários das empresas (tabela `AdminsPlataforma`); o token de admin tem audiência própria e a claim `escopo=plataforma`, então o token de um cliente não abre o `/admin` e o de admin não abre o painel do cliente;
- listar e ver empresas, criar empresa com Dono (senha provisória), bloquear e desbloquear empresa com motivo, e desativar, reativar ou gerar senha provisória para usuários de qualquer empresa (*desde a DEC-55, a senha provisória virou convite e "enviar link de senha" por email, e a equipe também cria acessos numa empresa*);
- equipe de admins (cadastrar, desativar e reativar; ninguém desativa a si mesmo; *desde a DEC-55, cadastrar é convidar por email*);
- auditoria de toda ação de admin, inclusive logins e tentativas recusadas (tabela `AuditoriasAdmin`).

**Por quê:** substituir o cadastro por `curl` com `X-Registration-Key` e dar à equipe um jeito de atender os clientes (acesso, senha, inadimplência) sem mexer no banco. Integrações ficam para depois.

**Impacto:** empresa bloqueada perde o login e os tokens já emitidos (`TokenRevalidator`, inclusive no sync do app). O primeiro admin é criado por `POST /api/admin/auth/setup` com `Admin__SetupKey`, uma vez só (`deploy/README.md`, seção 10). O login de admin vale 30 dias (`Admin__ExpiresMinutes`), por escolha do Davi Oliveira; desde 13/11/2026 vale 24 horas (DEC-53). Pendências: a senha provisória derrubar as sessões já abertas do usuário (também em aberto na DEC-50).

**Login de admin mais forte (13/11/2026, branch `feature/superadmin-2fa-e-expo-web`):**
- **Bloqueio por conta:** 5 senhas erradas seguidas bloqueiam o login do admin por 15 minutos, igual ao dos usuários (DEC-43). Fica na auditoria ("conta-bloqueada").
- **Verificação em duas etapas por email** (escolha do Davi, no lugar do app autenticador): depois da senha, o Agesto manda um código de 6 dígitos pelo Brevo, que vale 10 minutos e uma vez só, preso àquela tentativa de login por um desafio. Cinco códigos errados invalidam o desafio, e um login novo invalida o código anterior. O banco guarda só os hashes. A tela pede o código, mostra o email mascarado e permite reenviar. `Admin__DoisFatores=false` desliga a segunda etapa só em emergência (ex.: Brevo fora do ar).

---

## DEC-53 — Token do web em `localStorage`: risco aceito no MVP

**Status:** 🟡 Risco aceito por Davi Oliveira em 11/11/2026, com gatilhos de revisão. Sem mudança de código.

**Decisão:** o web continua guardando o JWT em `localStorage`: o token das empresas em `web/src/lib/token.ts` e o de admin (`agesto_admin_token`) em `web/src/admin/sessao.ts`. O cookie httpOnly recomendado em `docs/SECURITY_NOTES.md` (seção 1) fica para depois. O app segue com `expo-secure-store`.

**Por quê:**
- API (`agesto-api.onrender.com`) e web (Cloudflare Pages) estão em sites diferentes. Cookie de login entre eles exige `SameSite=None`, proteção contra CSRF e credenciais no CORS, e navegadores que bloqueiam cookie de terceiros podem quebrar o login. Fazer bem pede domínio próprio com API e web no mesmo site.
- O app usa token Bearer; a API teria de aceitar os dois modos.
- O risco hoje é contido: a CSP de `web/public/_headers` só roda script do próprio site (`script-src 'self'`) e só conecta no próprio site e na API; o React escapa o texto exibido; o único `dangerouslySetInnerHTML` (`Icon.tsx`) usa desenhos fixos do código; o `TokenRevalidator` derruba na hora o token de usuário desativado ou de empresa bloqueada; e só há contas de teste.

**Risco aceito:** um XSS que passe pela CSP leva um token válido por até 30 dias (DEC-50 e DEC-52), e trocar a senha ainda não derruba as sessões abertas.

**Revisar quando acontecer o primeiro destes:** domínio próprio do Agesto, primeiro cliente pagante ou fim da fase de contas de teste. Nesse ponto, migrar o web para cookie httpOnly.

**Até lá:**
- não remover nem afrouxar a CSP de `web/public/_headers`;
- não usar `dangerouslySetInnerHTML` com dado de usuário ou da API;
- pendências que reduzem o risco sem migrar: encurtar a validade do token de admin (feito em 13/11/2026: 24 horas por padrão em `Admin__ExpiresMinutes`, decidido pelo Davi Oliveira) e fazer a troca de senha derrubar as sessões abertas (versão do token, também em aberto nas DEC-50 e DEC-52).

**Impacto:** nenhum agora. A migração futura mexe na emissão do token, na autenticação da API, no CORS e no cliente HTTP do web.

---

## DEC-54 — "Esqueci a senha" do Dono por email, com o Brevo

**Status:** 🟢 Em `main` (PR #161, release #163, 12/11/2026), escolhido por Davi Oliveira. Migration `AddTokenRedefinicaoSenha` aplicada no Supabase; Brevo configurado no Render e envio testado em produção em 12/11/2026.

**Decisão:** o Dono pede, na tela de login, um link para criar uma senha nova:
- `POST /api/auth/esqueci-senha` responde sempre a mesma mensagem, exista o email ou não. Só gera link para Dono ativo de empresa ativa; o agente continua recebendo senha provisória do Dono (DEC-35).
- O token tem 32 bytes aleatórios e vale 15 minutos, uma vez só. No banco fica só o hash SHA-256 (tabela `TokensRedefinicaoSenha`). Um pedido novo invalida o anterior, e cada conta recebe no máximo um email a cada 2 minutos.
- O link é `{Email:UrlWeb}/redefinir-senha#token=...`: depois do `#`, o token não vai ao servidor do web nem aparece em logs.
- `POST /api/auth/redefinir-senha` troca a senha, tira o bloqueio por senhas erradas (DEC-43) e invalida todos os links abertos da conta.
- O envio é pelo Brevo (API HTTP; o Render Free bloqueia SMTP), numa fila em memória fora da requisição: a resposta leva o mesmo tempo exista o email ou não, e uma lentidão do Brevo não segura a tela.
- Sem `Email__BrevoApiKey` e `Email__RemetenteEmail`, o envio fica desligado e a rota continua respondendo igual.

**Por quê:** o Dono sem acesso dependia da equipe do Agesto para uma senha provisória (DEC-52). O Brevo foi escolhido por Davi Oliveira; o plano gratuito envia até 300 emails por dia.

**Impacto:** migration `AddTokenRedefinicaoSenha` (tabela nova com RLS e a policy do `agesto_api`). Variáveis novas no Render (`deploy/README.md`, seção 3). Enquanto o SEG-01 não entrar (PR #155), redefinir a senha não derruba as sessões já abertas.

**Atualização (DEC-55, 12/11/2026):** o "Esqueci a senha" passou a valer também para o Agente (no app e no web), e a mesma tabela guarda os links de convite.

---

## DEC-55 — Acessos novos por convite no email; fim da senha provisória

**Status:** 🟢 Em `main` (PR #162, release #163, 12/11/2026), decidido por Davi Oliveira. Migration `AddConvitesPorEmail` aplicada no Supabase; envio testado em produção em 12/11/2026.

**Decisão:** ninguém mais recebe senha de outra pessoa. Todo acesso novo nasce com o **convite pendente** e a pessoa cria a própria senha pelo link do email:
- **Quem cria acesso:** o Dono, na tela Usuários (funcionário Agente ou outro Dono da empresa), e a equipe do Agesto, no superadmin (Dono da empresa nova e qualquer acesso de uma empresa). Novo administrador da equipe também é convidado assim; só o primeiro admin continua pelo setup com `Admin__SetupKey`.
- **Convite:** link `{Email:UrlWeb}/criar-senha#token=...` (admin: `/admin/criar-senha`), válido por **72 horas** e uma vez só; um convite novo invalida o anterior. Ao usar, a senha é criada e o email fica confirmado (`Usuario.EmailConfirmadoEm`, `AdminPlataforma.EmailConfirmadoEm`). O email do agente aponta para o app e para `/baixar`.
- **Senha provisória:** sai do Dono e do superadmin. O Dono só **reenvia o convite** de quem ainda não criou a senha. No superadmin, "senha provisória" virou **"Enviar link de senha"** (reenvia o convite, ou manda um link de 72 horas a quem já tem acesso; a senha atual vale até o link ser usado).
- **Esqueci a senha:** Dono e Agente (link de 15 minutos, DEC-54).
- **Acessos que já existiam:** não mudam. A migration marca o email deles como confirmado pela data de criação; ninguém perde a senha nem recebe email.

**Por quê:** pedido de Davi Oliveira em 12/11/2026. A senha provisória passava por terceiros (Dono, equipe, WhatsApp); com o convite, só a própria pessoa conhece a senha e o email fica confirmado.

**Impacto:** migration `AddConvitesPorEmail` (colunas `EmailConfirmadoEm`, e `AdminId` e `Tipo` na tabela de links). Rotas novas: `POST /api/usuario/{id}/reenviar-convite`, `POST /api/admin/empresas/{id}/usuarios`, `POST /api/admin/empresas/{id}/usuarios/{usuarioId}/enviar-link-senha`, `POST /api/admin/equipe/{id}/reenviar-convite` e `POST /api/admin/auth/criar-senha`. Saem `POST /api/usuario/{id}/redefinir-senha` e `.../senha-provisoria`. Telas novas no web: `/criar-senha` e `/admin/criar-senha`; o app ganha "Esqueci a senha". Revê o item 2 da DEC-35 e a senha provisória da DEC-52.

## DEC-56 — WhatsApp por link (wa.me), sem integração com a conta do Dono

**Status:** 🟢 Links em `main` (PR #168, release #169, 12/11/2026), escolhido por Davi Oliveira. PDF do orçamento na branch `feature/orcamento-pdf` (12/11/2026).

**Decisão:** o Agesto conversa com o WhatsApp só por **links `wa.me`**. O botão abre o WhatsApp de quem está usando o Agesto (web ou app), na conversa com o cliente e, quando faz sentido, com a mensagem já escrita. A pessoa revisa e envia pelo próprio WhatsApp. O Agesto não guarda sessão, credencial nem conversa:
- **Orçamento (web):** vai como **PDF** (pedido do Davi em 12/11/2026, no lugar da mensagem com os itens). O PDF é gerado no navegador e leva empresa, cliente, itens e total, **nunca custo nem margem**. Como o `wa.me` não aceita anexo: no celular, "Enviar PDF por WhatsApp" abre o compartilhar do sistema com o arquivo, e a pessoa escolhe o WhatsApp e o contato; no computador, o PDF é baixado e a conversa do cliente abre no WhatsApp, para anexar o arquivo. "Baixar PDF" serve para email ou impressão.
- **Clientes e Agenda (web), agenda do app:** botão ou link que abre a conversa com o cliente.
- **Telefone:** aceita DDD + número (10 ou 11 dígitos) ou já com o 55; sem telefone válido, o botão não aparece (no orçamento, fica desligado e explica o motivo).
- **Fora desta fase:** conversar com os clientes dentro do Agesto. Se for preciso, o caminho é a API oficial do WhatsApp (Cloud API, da Meta), em uma DEC própria com custo e escopo. **Baileys não**, nem outras bibliotecas que imitam o WhatsApp Web.

**Por quê:** pedido de Davi Oliveira em 12/11/2026, para o Dono falar com os clientes pelo WhatsApp a partir do Agesto. O Baileys foi avaliado e recusado: não é oficial e pode levar ao banimento do número do Dono; a sessão guardada daria acesso ao WhatsApp inteiro dele; exigiria um serviço Node.js sempre ligado, fora da arquitetura atual; quebra quando o WhatsApp muda; e aumentaria muito os dados pessoais sob responsabilidade do Agesto (LGPD). O link entrega o principal, cabe antes do lançamento e não tem nenhum desses riscos.

**Impacto:** `OrcamentoResponse` ganha `ClienteTelefone`, e `ConfiguracaoResponse` ganha `EmpresaNome` e `EmpresaDocumento` (sem migration; o nome também passa a aparecer na conta do web, no lugar de "Minha empresa"). Utilitários `web/src/lib/whatsapp.ts` e `mobile/src/lib/whatsapp.ts`; PDF em `web/src/features/orcamentos/pdf.ts`, com a dependência `jspdf` carregada só quando o orçamento abre. O app só recebe o botão num próximo build ou update.

## DEC-57 — Venda por contato, sem cadastro aberto; página de venda na raiz do web

**Status:** 🟢 Em `main` (página de venda: PR #172, release #173, 12/11/2026; `/conheca`: PR #174, release #175, 13/11/2026), decidido por Davi Oliveira e testado por ele em produção. Substitui a DEC-48.

**Decisão:** o Agesto **não terá cadastro aberto**. Quem quer assinar entra em contato, e a equipe cria a empresa no superadmin; o Dono recebe o convite por email e cria a senha (DEC-52, DEC-55).
- **Página de venda:** quem não está logado e abre a raiz do web (`/`) vê a apresentação do Agesto. Quem está logado continua indo direto para a Visão geral. A página fica sempre no modo claro (paleta Marinho), e o login ganha o link "Conheça e fale com a gente". O endereço **`/conheca`** mostra a página para qualquer pessoa, logada ou não; é o link para divulgar (redes, WhatsApp, propostas) e para mostrar o Agesto sem sair da conta. Para quem está logado, o botão "Entrar" vira "Ir para o painel".
- **Conteúdo:** a promessa "sua empresa inteira em um lugar só", os recursos, o fluxo do orçamento ao resultado, como começar, os preços, as dúvidas frequentes e o contato.
- **Preços** (definidos pelo Davi em 12/11/2026): **assinatura de R$ 49,90/mês** por empresa, com o acesso do Dono e todos os recursos, **mais 1 licença de funcionário inclusa**. Cada funcionário a mais custa **R$ 19,90/mês**. A página tem uma calculadora que leva a quantidade de funcionários para a mensagem do WhatsApp.
- **Pagamento:** cartão de crédito, boleto ou Pix. A forma, e outros acordos, são combinados no contato; a página não fala de fidelidade nem de cancelamento.
- **Contato:** WhatsApp comercial (34) 99632-6130, pelo link `wa.me` (DEC-56), e o email agesto.contact@gmail.com. Não há formulário, para não abrir endpoint público na API.
- **Hospedagem:** no mesmo projeto do web (Cloudflare Pages), com o código da página num pedaço separado, carregado só por quem a abre. Quando houver domínio próprio, ou se o marketing crescer, a página pode ir para um projeto próprio (ex.: `agesto.com.br` e o painel em `app.agesto.com.br`).

**Por quê:** pedido de Davi Oliveira em 12/11/2026. A venda é feita pela equipe, com assinatura e licenças combinadas no contato. A DEC-48 previa cadastro aberto com verificação de email e período de teste; isso deixa de ser necessário. No mesmo projeto não há infra nova nem dependência do domínio próprio, que ainda não existe.

**Impacto:** sem mudança na API nem migration. `ProtectedRoute` ganha `raizPublica`; a página fica em `web/src/pages/venda/`. As tarefas de cadastro aberto saem do TASKS, e a página de apresentação passa a ser feita agora. O controle de assinatura (quem pagou e quem está em atraso) continua em aberto.

## DEC-58 — Controle de assinatura e licenças no superadmin

**Status:** 🟡 Definido por Davi Oliveira em 13/11/2026; implementado na branch `feature/controle-assinatura` (13/11/2026). Falta aplicar a migration `AddAssinatura`.

**Decisão:** a assinatura de cada empresa é controlada no superadmin, sem gateway de pagamento no MVP (cartão, boleto ou Pix são combinados no contato, DEC-57):
- **Registro manual de pagamento:** a equipe registra cada pagamento (data, valor, forma e a que mês se refere), com histórico por empresa. Cada pagamento leva o "pago até" para o fim do período pago.
- **Situação:** em dia, vence em breve ou em atraso (com os dias de atraso), e a lista de empresas do superadmin pode filtrar por ela.
- **Atraso:** bloqueio **manual** (o botão que já existe, DEC-52) e **automático**: depois de **10 dias de carência** sem pagamento, a empresa é bloqueada sozinha até a equipe registrar o pagamento e desbloquear. O desbloqueio também pode ser manual.
- **Aviso ao Dono:** um aviso no topo do painel quando a assinatura estiver perto de vencer, vencida ou na carência (com quantos dias faltam para o bloqueio), e um bloco "Assinatura" na Parametrização com plano, licenças e vencimento.
- **Licenças:** a assinatura (R$ 49,90/mês) inclui o Dono e **1 funcionário**; cada funcionário a mais é uma licença de R$ 19,90/mês (DEC-57). O número de licenças fica na empresa e só a equipe muda. O Dono **não passa do contratado**: ao tentar convidar um funcionário além das licenças, o Agesto pede para falar com a equipe.

**Por quê:** a venda é por contato e o pagamento é combinado fora do sistema; o controle precisa mostrar quem pagou, quem atrasou e travar o uso sem pagamento, com uma carência para não cortar um cliente por um atraso de dias.

**Como ficou (13/11/2026):**
- **Empresa:** `PagoAte`, `LicencasFuncionarios` (padrão 1), `BloqueioAutomatico` e `BloqueioAutomaticoReferencia`. Tabela `PagamentosAssinatura` com o histórico, com RLS.
- **Empresas que já existiam:** ficam **sem cobrança** (`PagoAte` vazio), sem aviso e sem bloqueio automático, até a equipe registrar o primeiro pagamento ou ajustar o "pago até". A migration põe nas licenças os acessos ativos de hoje, para ninguém ficar travado.
- **Situação, pelo dia de Brasília:** em dia; vence em breve (até 5 dias); em carência (venceu há até 10 dias, com aviso ao Dono e a contagem até o bloqueio); atrasada (mais de 10 dias).
- **Pagamento:** o período começa no dia seguinte ao último pago (sem histórico, hoje) e cobre de 1 a 12 meses.
- **Bloqueio automático:** uma rotina na API roda de hora em hora e bloqueia as atrasadas, com registro na auditoria como "Sistema". O pagamento tira esse bloqueio sozinho; o bloqueio manual só sai pela equipe. Se a equipe desbloquear na mão uma empresa atrasada, a rotina não bloqueia de novo até o "pago até" mudar.
- **Licenças:** contam os acessos ativos, inclusive convites pendentes. O Dono e a equipe não criam nem reativam acesso além do contratado (409, com a mensagem pedindo para falar com a equipe); desativar sempre pode.
- **Telas:**
  - no superadmin, o bloco **Assinatura** (situação, valor, licenças, acessos em uso, histórico, "Registrar pagamento" e "Ajustar"), a coluna e o filtro de assinatura na lista de empresas;
  - para o Dono, o aviso no topo do painel (vence em breve ou carência, com o link do WhatsApp do Agesto) e o bloco **Assinatura** na Parametrização (`GET /api/assinatura`).
- **Desfazer pagamento (13/11/2026, branch `feature/pagamentos`):** a equipe desfaz um pagamento registrado por engano no histórico do superadmin. Só o último pagamento ativo, e só enquanto o "pago até" ainda é o que ele gerou; depois de um "Ajustar", corrige-se pelo "Ajustar". O "pago até" volta ao de antes do pagamento, o registro fica no histórico como desfeito (quem e quando), a rotina de bloqueio automático volta a valer e a ação entra na auditoria.
