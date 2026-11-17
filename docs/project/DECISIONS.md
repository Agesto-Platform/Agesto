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

## DEC-24 — Renomeação do produto para "Agesto" e repositório próprio público

**Status:** ✅ Resolvido — 04/08/2026 (decisão do dono, dev solo)

**Decisão:** O produto passa a se chamar **Agesto** (antes "Micro-ERP Auto"). O código passa a viver em um **repositório novo, próprio e público**, separado do repositório acadêmico original (`Auto-academic-erp/micro-erp-auto`), que foi criado por outro integrante do grupo e é abandonado como legado.

**Atualização de governança — 19/08/2026:** o repositório foi transferido para a organização e renomeado para [`Agesto-Platform/Agesto`](https://github.com/Agesto-Platform/Agesto), preservando histórico, branches, pull requests e CI.

**Origem do nome:** marca coined a partir de raízes latinas — *agere* (agir, operar) + *gestio* (gerir, gestão) → **Agesto**. Escolhido por soar sério/internacional (evitando nomes em português, percebidos como informais) e por ser "ownable" (sem significado prévio, facilitando registro de marca). "Auto" foi descartado por ser genérico e provavelmente não registrável.

**Estratégia comercial + portfólio (mesmo repo):**
- **Repositório público** — serve de portfólio; o README é a peça-chave (problema, arquitetura, decisões, prints, testes verdes).
- **Licença restritiva, não permissiva** — proprietária ("All Rights Reserved") ou source-available (BSL/PolyForm Noncommercial), para que o código possa ser lido mas não usado comercialmente por terceiros. **Nunca MIT/Apache** neste produto.
- **Higiene de segredos (inegociável):** `.gitignore` de `appsettings.*.json`/`.env`; commitar apenas exemplos (`appsettings.Example.json`); nunca connection string do Postgres, chave do Supabase ou a `SymmetricSecurityKey` do JWT. Varredura do histórico antes de publicar.
- Quando o produto amadurecer comercialmente (cliente pagante/sócio/investidor), o repositório pode virar **privado** com um clique, sem retrabalho.

**Pendências de validação:** checar disponibilidade de domínio (`.com`/`.com.br`) e registro de marca no INPI antes de investir na identidade visual final.

**Nota de escopo:** os identificadores de código (`MicroERP.Api`, `MicroERP.Tests`, namespaces `MicroERP.*`) **não** são renomeados neste momento — é refactor mecânico de baixo valor/alto risco de ruído no histórico; fica para uma limpeza futura, se e quando fizer sentido. A renomeação aqui é de **produto/marca e repositório**, não de namespace.

---

## DEC-25 — Stack e arquitetura do Frontend Web (Módulo Dono)

**Status:** ✅ Resolvido — implementado (web-01 a web-12, integrado na `main` em 04/08/2026)

**Decisão:** O frontend web do Dono (`web/` no monorepo `Agesto-Platform/Agesto`) usa **Vite + React 19 + TypeScript**, **Tailwind CSS v4** (config CSS-first via `@theme`, tokens portados do protótipo aprovado `web-dono.html`), **React Router**, **TanStack Query** para dados de servidor, **MSW** (Mock Service Worker) como camada de mock stateful enquanto não há banco/API real no ar, e **Recharts** para gráficos. Lint via oxlint.

**Contexto:** O front precisava ser construído antes do banco Supabase novo estar pronto (ver `project_banco_supabase`). Para não travar no schema real, o time optou por consumir o contrato real da API (DTOs espelhados em `types/api.ts`) contra um mock stateful (MSW), permitindo alternar para a API real trocando só uma env var.

**Decisões de arquitetura de pastas:** cada recurso de negócio vive em `features/<nome>/` (Clientes, Produtos, Serviços, Agenda, Orçamentos, Atendimentos, Configuração); kit de UI reutilizável em `components/ui/` (Drawer slide-over, DataTable, ConfirmDialog, TextField/NumberField/SelectField, Toast, Card, Kpi, Money, Pill, RankBar, Alert); `lib/api.ts` desembrulha o envelope `ApiResponse` e injeta o Bearer token, tratando 401; `lib/resource.ts` fornece a fábrica `createResource` (list/create/update/delete com invalidação automática do TanStack Query); mock stateful em `mocks/lib/http.ts` (`makeStore` + `crudHandlers`).

**Formulários em drawer lateral (slide-over)**, não em modal central nem em página cheia — decisão de UX para manter contexto da lista visível durante a edição.

**Costura de troca de dados:** a env var `VITE_USE_MOCKS=true|false` liga/desliga o MSW. Desligar aponta direto para a API real via `VITE_API_BASE_URL`, sem qualquer mudança de código nas features.

**Delta de backend resolvido no front (não no backend):** `GET /api/atendimento` (o `AtendimentoResponse` real) substituiu o antigo formato fictício "AtendimentoResumo" que existia só na apresentação. Como a API devolve apenas `clienteId` (não o nome do cliente), o nome é resolvido no front, juntando com a lista de clientes já carregada. Se isso virar gargalo de performance, a alternativa é expor `clienteNome` diretamente no backend (não decidido ainda).

**Alternativas descartadas:**
- Esperar o banco/API real estar pronto para começar o front → descartado, atrasaria o cronograma sem necessidade; o contrato de API já estava estável o suficiente para mockar.
- Modal central para formulários → descartado em favor do drawer lateral, que preserva o contexto da lista.

**Segurança de dependência:** `react-router-dom` fixado em `7.18.2` — há um advisory conhecido de modo RSC, aceito como risco porque o projeto não usa RSC.

**Login demo (mock):** `dono@agesto.app` / `agesto123`.

**Resolução aplicada:** 12 tasks incrementais (web-01 a web-12), todas com build+lint verdes, entregando scaffold, app shell, cliente de API + mock, autenticação JWT, dashboard "Visão geral", fundação de CRUD + Clientes, Produtos, Serviços, Agenda, Orçamentos, Atendimentos e Parametrização.

**Atualização posterior:** Relatórios deixou de ser placeholder na web-13 e a suíte foi ampliada na web-14 e evoluções seguintes. O Módulo Dono possui MVP funcional e roda em produção contra a API real desde a DEC-32; o MSW fica para desenvolvimento local.

---

## DEC-26 — Stack e arquitetura do Mobile (App do Agente)

**Status:** ✅ Resolvido — implementado (mob-01 a mob-07, integrado na `main` em 11/08/2026). Os dois deltas de backend abaixo: o mapeamento uuid→id foi resolvido pela DEC-33; a agenda na Carga segue pendente

**Decisão:** O app mobile do agente de campo (`mobile/` no monorepo `Agesto-Platform/Agesto`) usa **React Native + TypeScript via Expo (prebuild)**, com **Expo Router** para navegação, tokens de design portados do protótipo aprovado (azul `#243FA6` + verde `#12B886`, tema claro), e uma tab bar (Início/Agenda/Atendimentos/Clientes/Mais). Estilização via **theme + StyleSheet** — não NativeWind. Persistência offline via **`expo-sqlite`** no device, atrás de uma interface própria (`LocalDb`), com adapter em memória para Web/testes. Cliente de API com envelope padrão + tratamento de 401, e uma **camada de mock em código** (`config.useMocks`), análoga ao `VITE_USE_MOCKS` do web (DEC-25). Login JWT com token guardado via `expo-secure-store` (device) ou `localStorage` (web), split por plataforma.

**Contexto:** Assim como o front web (DEC-25), o mobile precisou ser construído antes do banco Supabase novo estar pronto e antes de o backend do domínio Prestador de Serviço (KAN-69) estar mergeado/aplicado. A camada de mock em código replica a mesma filosofia do MSW do web — consumir o contrato real da API, mockado, com troca por uma flag.

**React Native em vez de Flutter:** decisão de stack — coesão em TypeScript com o web (reúso de tipos e lógica), e menor superfície de manutenção para dev solo (ver `project_solo_dev`).

**Expo (prebuild) em vez de bare React Native puro:** tooling mais rápido para dev solo, mantendo acesso a módulos nativos (`expo-sqlite`, `expo-secure-store`) via prebuild quando necessário.

**`expo-sqlite` atrás de interface (`LocalDb`), com dois adapters — decisão de arquitetura:**
- `index.native.ts` — `expo-sqlite`, usado no device (Android/iOS)
- `index.ts` — adapter em memória, usado no Expo Web e em testes (Jest não roda `expo-sqlite` nativo)

Motivo: permite verificar o app ponta a ponta no Expo Web e rodar testes Jest sem um device físico/emulador Android, mantendo o mesmo contrato de dados nos dois ambientes.

**`theme + StyleSheet` em vez de NativeWind:** decisão de robustez sobre conveniência — evita uma camada de build adicional (Tailwind-in-RN) e mantém estilos tipados e previsíveis, alinhados aos tokens do protótipo.

**Ciclo offline-first (Carga/Descarga), reaproveitando os endpoints do backend (KAN-60):**
- **Carga:** login → popula o banco local com clientes/produtos/serviços/configuração. A agenda **não** vem na Carga — um passo adicional `syncAgenda` busca e cacheia `GET /api/atendimento/agenda` separadamente (ver DEC-17, delta de backend).
- **Registro offline:** cliente + itens de catálogo por quantidade (contrato enxuto) + status → salvo localmente como pendente (`SyncedAt = null`).
- **Descarga:** empurra clientes pendentes e atendimentos pendentes para o servidor, marca como sincronizado ao confirmar.

**Deltas de backend identificados durante a construção (não resolvidos nesta decisão, registrados como pendência — ver TASKS.md):**
1. A Carga (`GET /api/sync/carga`) deveria idealmente incluir a agenda, evitando o passo `syncAgenda` à parte no mobile.
2. Um atendimento criado offline não pode referenciar um cliente também criado offline (`PendingCliente`), porque o atendimento local não tem o id de servidor do cliente antes da sincronização. Resolver exigiria mapear uuid→id do cliente durante a Descarga.

**Verificação sem device Android:** todo o ciclo foi validado no **Expo Web** (login demo `agente@agesto.app` / `agesto123`) mais build/lint (`tsc`, `expo lint`) e 15 testes Jest (jest-expo) verdes. Teste de componente React Native (`@testing-library/react-native`) foi adiado — incompatibilidade de versão entre a lib v14, jest-expo e React 19 nesta janela de tempo.

**Alternativas descartadas:**
- Flutter → descartado por fragmentar a stack (Dart vs TypeScript), sem reúso de tipos/lógica com o web, pior para manutenção solo.
- NativeWind → descartado em favor de `theme + StyleSheet` (ver acima).
- Testar exclusivamente em device/emulador Android → descartado como único caminho de verificação; Expo Web serve como ambiente de verificação rápido e reprodutível neste momento do projeto.

**Resolução aplicada:** 7 tasks incrementais (mob-01 a mob-07) — scaffold, camada de dados offline, cliente de API + mock + auth, Home action-first, registrar atendimento, Clientes (lista + cadastro rápido offline), Descarga + aba "Mais" com status de sync. Build/lint/testes verdes. Revisão própria (agente `revisor-frontend`) corrigiu invalidação de auth em 401 da API real e uma guarda de desmontagem. Ver TASKS.md para a tabela de commits/detalhes e as pendências residuais.

---

## DEC-27 — Parametrização: modo de agenda do agente e controle de estoque

**Status:** ✅ Resolvido — implementado (Plano 1, tasks param-01 a param-08, na `main`).

**Contexto:** o produto atende tanto **prestadores solo** quanto **equipes**, e tanto quem **mantém estoque** de material (ex: instalador de AC) quanto quem **compra por serviço** (pass-through, sem inventário). Em vez de impor um comportamento único, dois eixos viram **parâmetros por Empresa**, editáveis pelo Dono em **Parametrização** (web).

**Decisão — dois campos novos em `Configuracao`:**
1. `ModoAgendaAgente` (enum `{ Flexivel, Fixa }`, default `Flexivel`):
   - **Flexível (solo):** o agente registra atendimento *agora* **ou** agenda para o futuro (data + hora), direto do app.
   - **Fixa (equipe):** o agente segue a agenda montada pelo Dono; **não cria agendamento futuro**. **Walk-in liberado** (registrar atendimento avulso *agora* continua permitido — decisão do dono).
2. `ControlaEstoque` (bool, default `true`):
   - **true:** itens de produto de catálogo baixam/devolvem estoque e validam saldo (comportamento atual, DEC-11/DEC-18).
   - **false:** o catálogo de produtos vira uma **lista de materiais com preço/custo**, sem baixa nem validação. Atende o prestador pass-through, mantendo os materiais como `Produto` de catálogo (id estável, reutilizável, com custo — pré-requisito do futuro "kit de materiais", ver DEC-28/Plano 2).

**Enforcement:**
- O **default é sempre seguro** (`ControlaEstoque = true`, `ModoAgendaAgente = Flexivel`) em todos os caminhos onde a config pode faltar; a migration seta `ControlaEstoque = true` para empresas existentes.
- `ControlaEstoque` é gateado no backend nos **5 pontos de mutação de estoque** (criar/editar/remover item de produto, cancelar atendimento, importar na Descarga).
- `Fixa` tem **enforcement de servidor** (param-08): a Descarga **ignora `DataAgendada`** vinda do agente quando a empresa é `Fixa` — defesa contra payload forjado, além do gating no app. O caminho **online** de atendimento (`AtendimentoController`) permanece livre por ser a ferramenta do **Dono** (montar a agenda é papel dele).

**Fluxo até o mobile:** a `Configuracao` passou a viajar na **Carga** (`SyncCargaResponse.Configuracao`) — antes ela não ia. O mobile persiste em `meta` (`appConfig`) com default seguro e usa para: mostrar/ocultar o modo "Agendar" no registrar e o CTA "+ Agendar" na aba Agenda; ocultar o hint de estoque. O contrato offline (`AtendimentoSyncRequest`) ganhou `DataAgendada` (antes era descartada entre device e servidor).

**Escopo:** parâmetro por **Empresa** (não por Usuário/agente — granularidade por agente fica como evolução futura). Custo/insumo no mobile continua **web-only** por ora (opção 2a): o Dono ajusta margem/custo no web; o agente só lança catálogo.

**Revisão:** `@revisor` (backend) e `@revisor-frontend` — ambos **aprovados**, sem achados críticos/importantes; sugestões aplicadas (mock de estoque explícito em teste, `appConfig.test.ts`, fim do flicker do toggle). Backend 83 testes, mobile 25, web 17 — verdes.

**Pendência residual:** granularidade do parâmetro por agente (hoje por empresa); custo/insumo no mobile (opção 2b, se um dia fizer sentido).

---

## DEC-28 — Kit de materiais sugeridos por serviço

**Status:** ✅ Resolvido — implementado (Plano 2, tasks kit-01 a kit-06, na `main`).

**Contexto:** certos serviços sempre consomem os mesmos materiais (ex: instalar lava-roupas usa Ts, cotovelos, veda-rosca). Reintroduzi-los à mão em cada orçamento/atendimento é repetitivo e propenso a esquecimento (que sangra estoque e margem).

**Decisão — "kit" de materiais por Serviço:**
- Nova entidade `ServicoItemSugerido` (`EmpresaId`, `ServicoId`, `ProdutoId`, `QuantidadePadrao`), com índice único `(ServicoId, ProdutoId)`. Sem soft delete: o `PUT` **substitui o conjunto** inteiro (delete-all + insert), escopado por `EmpresaId + ServicoId`.
- Os materiais são sempre **Produto de catálogo** (id estável, reutilizável, com preço/custo). Se baixam estoque ou não depende de `ControlaEstoque` (DEC-27) — resolvendo o caso pass-through vs quem estoca.
- Endpoints `GET`/`PUT /api/servico/{id}/sugeridos`. Service valida tenant (serviço e cada produto pertencem à empresa) e faz dedupe por `ProdutoId` (última quantidade vence).

**Como se popula (decisão de UX):** **curado** pelo Dono na tela de Serviço (funciona desde o dia 1) **+ atalho "salvar materiais como sugeridos"** a partir de um atendimento real (constrói o kit pelo uso concreto — o "usados anteriormente" que o dono pediu — sem motor de frequência). Histórico automático foi **descartado** por ora.

**Onde aparece:**
- **Web (Dono):** editor "Materiais que costuma usar" no Serviço; bloco "Materiais sugeridos (n)" com 1 clique ao lançar o serviço num **Orçamento** e **Atendimento**; atalho "salvar como sugeridos".
- **Mobile (Agente):** os sugeridos viajam na **Carga** (`SyncCargaResponse.Sugeridos`, achatados) e ficam offline (`meta`); no registrar, um chip **"+ Materiais sugeridos (n)"** soma os materiais dos serviços selecionados ao produtoQty em 1 toque (`Math.max` na quantidade).

**Revisão:** auto-revisão (revisores bloqueados por limite de sessão nesta janela; "revisão própria" como na DEC-26). Achado e corrigido 1 bug: o editor de kit no web reescrevia edições não salvas num refetch de foco — corrigido com guarda de dirty + `refetchOnWindowFocus: false`. Backend 90 testes, mobile 29, web 17 — verdes.

**Pendência residual:** no Atendimento web, o "Adicionar" dispara as mutations em paralelo (falha parcial não tratada — baixo risco); custo/insumo no mobile segue web-only (DEC-27, opção 2a).

---

## DEC-29 — Retomada do desenvolvimento em equipe e propriedade organizacional

**Status:** 🟡 Em implementação — organização, transferência e equipe concluídas em 19/08/2026; ruleset `Protected branches` ativo (revisto em 10/10/2026); formalização jurídica ainda pendente

**Decisão:** O Agesto deixa de operar como projeto mantido por uma única pessoa e volta ao desenvolvimento em equipe. Davi continua responsável pelas decisões de produto. O repositório foi transferido para a organização `Agesto-Platform`, preservando histórico, branches e contribuições.

**Motivo:** embora o MVP tenha avançado sob desenvolvimento individual, a continuidade comercial exige revisão humana, divisão de responsabilidades, continuidade de acesso e capacidade de evolução paralela.

**Regras iniciais:**
- monorepo mantido enquanto backend, web e mobile evoluírem de forma acoplada;
- fluxo `feature/* → develop → main` por pull request;
- `develop` e `main` protegidas por PR obrigatório e pelos checks Backend, Web e Mobile, sem aprovação obrigatória (revisto em 10/10/2026);
- permissões concedidas por função e com privilégio mínimo;
- documentação oficial versionada em `docs/project/`;
- equipe fundadora registrada como Davi Gomes Rocha (Founder e Product Owner), Depowo (Cofounder, foco inicial em infraestrutura) e ghzpro034 (Cofounder, atuação generalista);
- Davi e Depowo como Owners da organização; ghzpro034 como Member com acesso Write pelo time visível `Core`;
- propriedade intelectual e responsabilidades definitivas por módulo ainda precisam ser formalizadas.

**Impacto em decisões anteriores:** menções a “dev solo” permanecem como contexto histórico da decisão original e não representam a composição atual. A escolha de React Native, C# e monorepo não muda automaticamente com a retomada da equipe; qualquer revisão será uma nova decisão explícita.

---

## DEC-30 — Hospedagem do MVP em tiers gratuitos: Cloudflare Pages + Oracle Cloud + Supabase

**Status:** ⚠️ Parcialmente substituída pela DEC-32 em 08/10/2026 — a web segue na Cloudflare Pages; a API saiu da Oracle para o Render e o banco foi recriado no Supabase em N. Virginia

**Decisão:** O MVP será hospedado apenas em tiers gratuitos:
- **Web (Módulo Dono):** Cloudflare Pages, servindo o build estático do Vite.
- **API (.NET 8):** VM Ampere A1 (ARM) do Oracle Cloud Always Free, com a API em container Docker atrás de um proxy reverso com HTTPS.
- **Banco:** Supabase (PostgreSQL), plano Free, usado apenas como Postgres gerenciado; a autenticação continua sendo o JWT próprio da API.
- **Região:** São Paulo para a API (`sa-saopaulo-1`, como home region da conta Oracle) e para o banco (Supabase South America), mantendo a API ao lado do banco.

**Motivo:** custo zero na fase de MVP. A VM Oracle fica ligada 24h, sem cold start, e permite colocar a API no Brasil junto do banco. A Cloudflare Pages permite uso comercial no plano gratuito.

**Alternativas descartadas:**
- **Vercel Hobby** para a web → proíbe uso comercial.
- **Render** para a API → sem região no Brasil e cold start de cerca de 1 minuto no plano gratuito.
- **Google Cloud Run** para a API → exige cartão e cobrança fora da cota; preterido pela equipe.
- **Azure App Service F1** → limite de 60 min de CPU por dia, sem suporte para produção.
- **Neon** para o banco → equipe optou por manter Supabase, já usado no setup inicial (KAN-14).

**Riscos e mitigações:**
- **Pausa do Supabase Free** após 7 dias sem atividade → endpoint `/health` da API consulta o banco e é chamado periodicamente por um monitor externo.
- **Sem backup automático no Supabase Free** → `pg_dump` periódico agendado, guardado fora do Supabase.
- **Data API do Supabase expõe o schema `public`** pela API REST com a chave `anon` (pública) → Data API desativada no projeto; o banco é acessado só pela API .NET.
- **Oracle recupera VMs ociosas de contas Always Free** (7 dias com CPU, rede e memória abaixo de 20%), e a API do MVP fica ociosa a maior parte do tempo → **conta convertida para Pay As You Go** com alerta de orçamento; a VM sai da regra de recuperação e segue sem custo dentro dos limites Always Free. A Oracle também alterou os limites sem aviso em 2026 (A1 reduzido para 2 OCPUs / 12 GB) → dimensionar dentro do limite atual e manter o deploy reproduzível (Dockerfile + compose em `deploy/oracle/`) para recriar a VM.
- **Home region da Oracle é definitiva** e a capacidade A1 não é garantida → confirmar São Paulo na criação da conta.
- **Domínio provisório:** enquanto não houver domínio próprio, a API usa `api.<IP>.sslip.io` para o HTTPS automático → IP público reservado na Oracle para o endereço não mudar; ao adotar domínio próprio, trocar a URL na web e no mobile.
- **Operação da VM** (SO, Docker, HTTPS, firewall, atualizações) fica com a equipe de infraestrutura (Depowo).
- **Segredos** (connection string, chave JWT) apenas em variáveis de ambiente na VM, nunca no Git.

**Impacto em documentos anteriores:** substitui a menção a Azure em `docs/PROJETO_CONTEXTO.md` (contexto histórico) e define a hospedagem que `DESIGN.md` seção 8 deixava em aberto. O `SETUP_LOG.md`, registro histórico do Supabase de desenvolvimento original, foi removido em 21/10/2026 por conter dados pessoais de ex-integrantes; continua acessível no histórico do Git.

**Revisão:** os tiers gratuitos não são recomendados pelos provedores para produção. Ao surgir receita, reavaliar Supabase Pro (sem pausa, com backup) e a hospedagem da API.

---

## DEC-31 — Migrations consolidadas numa `InitialCreate` única para o banco novo

**Status:** ✅ Aplicada em 08/10/2026 no Supabase de São Paulo pelo SQL Editor; `__EFMigrationsHistory` contém só `20261008213822_InitialCreate` e as 12 tabelas foram conferidas. Com a DEC-32, o banco é recriado em N. Virginia com o mesmo script

**Contexto:** ao gerar o script idempotente para o banco novo (DEC-30), constatou-se que a migration `20260618193156_ConvertEnumsToString` tem o `Up()` vazio: o schema correspondente tinha sido aplicado manualmente no Supabase antigo e a migration foi esvaziada só para alinhar o histórico. Num banco novo, o script rodaria sem erro, mas criaria o schema **sem a tabela `Empresas` e sem as colunas `EmpresaId`**. O snapshot do EF estava correto, por isso `has-pending-model-changes` não acusava nada.

**Decisão:** substituir as 10 migrations anteriores por uma `InitialCreate` única (`20261008213822_InitialCreate`), gerada a partir do modelo atual. Possível porque nenhum banco em uso depende do histórico antigo: o Supabase antigo será substituído.

**Verificação:** o `AppDbContextModelSnapshot.cs` gerado difere do anterior só pela correção de `ModoAgendaAgente` abaixo; o script tem as 12 tabelas, incluindo `Empresas`, e nenhuma operação destrutiva; build e 90 testes verdes.

**Alternativa descartada:** reescrever à mão o `Up()` da `ConvertEnumsToString` espelhando o `Down()` (28 operações) → preservaria o histórico, mas com risco de erro manual sem como provar a equivalência com o modelo.

**Divergências do modelo encontradas na revisão:**
- `Configuracao.ModoAgendaAgente` era persistido como `integer`, sem `HasConversion<string>()`, contrariando o invariante de enums como string → **corrigido** na mesma migration (`varchar(10)`), aproveitando o banco ainda vazio.
- `Orcamentos` e `ServicoItemSugeridos` têm `EmpresaId` indexado, mas sem chave estrangeira para `Empresas` → não alterado; aguarda decisão.

**Regra a partir daqui:** nenhuma migration pode ter o `Up()` esvaziado para "sincronizar histórico". Mudança aplicada manualmente em algum banco deve ser revertida ou reproduzida pela migration.

---

## DEC-32 — API no Render e banco no Supabase em N. Virginia

**Status:** 🟢 Provisionado — API no Render (`agesto-api.onrender.com`) e banco no Supabase de N. Virginia em produção; ping do `/health` pelo Worker `agesto-keepalive` da Cloudflare a cada 5 min desde 11/11/2026 (antes, cron-job.org)

**Decisão:** substitui a parte de API e banco da DEC-30:
- **API (.NET 8; .NET 10 desde a DEC-40):** Render, plano Free, Web Service com o `Dockerfile` existente, configurado pelo `render.yaml` na raiz. Região **Virginia**. Publica a `main` (desde a DEC-41) só depois que o CI passa (`autoDeployTrigger: checksPass`).
- **Banco:** projeto Supabase novo em **East US (N. Virginia)**, ao lado da API, com a mesma `InitialCreate` da DEC-31. O projeto de São Paulo deixa de ser usado.
- **Web:** sem mudança, segue na Cloudflare Pages.

**Motivo:** a VM da Oracle exige operação (SO, Docker, HTTPS, firewall) e, sem Pay As You Go, pode ser parada por ociosidade; com Pay As You Go, exige cartão. O Render não pede cartão nem servidor para manter.

**Por que mudar o banco de região:** o Render não tem região no Brasil. Com a API em Virginia e o banco em São Paulo, cada consulta atravessaria EUA↔Brasil (~120 ms cada, várias por requisição). Com os dois em Virginia, o usuário no Brasil paga essa distância uma vez por requisição. A troca foi feita enquanto o banco ainda estava vazio.

**Alternativas descartadas:**
- **Manter Oracle** → operação da VM e risco de recuperação por ociosidade (ver DEC-30).
- **Google Cloud Run** em São Paulo → exige cartão.
- **Trocar a arquitetura da API** (TypeScript no Cloudflare Workers ou Supabase direto com RLS) → reescrever ~5.500 linhas e 51 endpoints já testados para resolver só a hospedagem; contraria o princípio de mudanças pequenas no MVP.

**Riscos e mitigações:**
- **API dorme após 15 min sem tráfego** e leva ~1 min para acordar → monitor externo chama `/health` (consome ~744 das 750 h mensais; não cabe um segundo serviço Free ligado 24h). Era o cron-job.org a cada 10 min; desde 11/11/2026 é o Worker `agesto-keepalive` da Cloudflare a cada 5 min, versionado em `deploy/keepalive/` (`deploy/README.md`, seção 6).
- **Pausa do Supabase Free** após 7 dias sem atividade → o mesmo ping, porque o `/health` executa `SELECT 1`.
- **512 MB de RAM e 0,1 CPU** → suficiente para o MVP; reavaliar no primeiro sinal de lentidão.
- **Sem disco persistente** → a API não grava arquivos hoje; uploads futuros precisam de storage externo.
- **SMTP bloqueado** no plano Free → envio de e-mail futuro por API HTTP.
- **Latência Brasil↔EUA** (~120 ms por requisição) → aceita no MVP; o mobile é offline-first.

**Impacto no código:** nenhum na lógica. `deploy/oracle/` foi removido (fica no histórico do Git); o passo a passo está em `deploy/README.md`.

**Revisão:** ao surgir receita, reavaliar Render Starter (sem dormir) e Supabase Pro (sem pausa, com backup).

---

## DEC-33 — Sincronização confiável: Carga completa, Descarga por atendimento e cliente offline por UUID

**Status:** 🟢 Implementado em `develop` e `main` (PR #43, 10/10/2026)

**Contexto:** revisão do ciclo Carga/Descarga encontrou perda de dados no mobile:
- a Carga era incremental (`ultimaSincronizacao`), mas o app substitui a tabela local inteira a cada Carga — a partir da segunda sincronização, clientes/produtos/serviços sem alteração sumiam do device; exclusões (soft delete) nunca chegavam ao device;
- o app marcava **todos** os pendentes como sincronizados, mesmo os que o servidor rejeitou (só reportados em `Erros`), perdendo-os;
- a Descarga gravava o atendimento sem os itens inválidos (produto inexistente, estoque insuficiente), com `ValorTotal` menor; não validava `ClienteId` contra a empresa; quantidade negativa aumentava o estoque.

**Decisão:**
1. **Carga sempre completa** no mobile (sem `ultimaSincronizacao`). O parâmetro continua aceito pelo backend, mas o app não o usa. Volume de catálogo do público-alvo torna o custo irrelevante; ganha-se propagação de exclusões sem tombstones.
2. **Descarga tudo-ou-nada por atendimento:** cliente, itens, quantidades (> 0) e estoque (somado por produto) são validados antes de gravar; qualquer falha rejeita o atendimento inteiro, que segue pendente no device. Falha de um atendimento não bloqueia os demais da leva.
3. **Confirmação explícita:** `SyncDescargaResponse` devolve `ClientesSincronizados` e `AtendimentosSincronizados` (importados agora ou já existentes). O device só marca como sincronizado o que estiver nessas listas.
4. **UUID do cliente nasce no device:** `ClienteCreateRequest.Uuid` (opcional; ausente = gerado no servidor). Reenvio do mesmo cliente é idempotente.
5. **Atendimento referencia cliente criado offline** por `AtendimentoSyncRequest.ClienteUuid` (`ClienteId` passa a ser opcional). Clientes são processados antes dos atendimentos na mesma leva; a resposta traz `ClientesMapeados` (uuid → id) e o device religa os atendimentos locais ao id do servidor. Cliente offline com CPF já existente é mapeado para o cliente existente (coerente com a DEC-06).
6. O botão Sincronizar do mobile passa a fazer Descarga seguida de Carga + agenda, e informa quantos itens não foram enviados.

**Impacto:** contrato da Descarga mudou — API e mobile precisam ser publicados juntos. Resolve as pendências "Mapear uuid→id do cliente na Descarga" (DEC-26) e a perda de dados acima. Testes: backend 127, mobile 32 — verdes.


---

## DEC-34 — Endurecimento de segurança pós-auditoria

**Status:** 🟢 Implementado e validado em produção em 10/10/2026 (PRs #44 e #45)

**Contexto:** auditoria de API, front, banco e infraestrutura com o sistema já em produção. Não havia vazamento ativo (Data API do Supabase desligada), mas havia brechas exploráveis: sem limite de tentativas, sem checagem de perfil, cadastro aberto, token irrevogável, dados pessoais completos no celular do agente.

**Decisão:**
1. **Cadastro fechado.** `POST /api/auth/register` só funciona com `Auth:RegistrationKey` configurada e enviada em `X-Registration-Key`; sem a chave, responde 404. Reabrir exige verificação de email (pendente).
2. **Perfis no back.** Policy `Dono` em toda rota de gestão; o Agente usa só sync e a própria agenda. Um teste falha se uma action nova não declarar a policy.
3. **Rate limiting** por IP no login e cadastro e por usuário no sync.
4. **Token revalidado a cada requisição:** usuário excluído, de outra empresa ou com perfil alterado perde o acesso na hora, sem esperar o JWT expirar.
5. **LGPD:** o Agente recebe CPF mascarado e orçamentos sem custo na Carga; cliente excluído é anonimizado (nome, CPF, telefone e endereço), mantendo a linha para o histórico.
6. **Banco:** RLS em todas as tabelas sem acesso para `anon`/`authenticated`; a API conecta com o role `agesto_api` (só DML, `deploy/api-role.sql`) e TLS `VerifyFull` com a CA do Supabase.

**Validação em produção (10/10/2026):**
- Supabase: Data API desligada e `pg_graphql` não instalado (sem acesso público às tabelas); RLS ativo em todas as tabelas.
- API: headers de segurança e HSTS presentes; cadastro responde 404; login e cadastro bloqueiam com 429 após o limite; payload acima do limite recusado com 413 (testado localmente).
- Web (Cloudflare): CSP, `X-Frame-Options` e HSTS presentes; a CSP libera só a API usada pelo bundle de produção.
- Banco: API conectando como `agesto_api` com `SSL Mode=VerifyFull`; CA do Supabase conferida com `openssl` nos poolers `aws-0` e `aws-1` de us-east-1. O `ssl = false` em `pg_stat_ssl` refere-se ao trecho interno pooler → Postgres.
- Login, configuração, clientes, produtos, serviços, orçamentos, atendimentos, agenda, sync e dashboard respondendo 200 com a conta de teste depois de todas as mudanças.

**Pendências:**
- **Verificação de email** antes de reabrir o cadastro. Depende de provedor de envio com API HTTP (o Render bloqueia SMTP; sugestão: Resend) e de domínio próprio verificado.
- **Backup automático** do banco (o plano Free do Supabase não faz).
- ~~**Migração para .NET 10** (o .NET 8 perde suporte em 10/11/2026).~~ Feita na DEC-40.


---

## DEC-35 — Gestão de usuários pelo Dono e responsável do atendimento

**Status:** 🟢 Implementado em `develop` e `main` (PR #47, 19/10/2026); migration aplicada no Supabase

**Contexto:** não havia como criar um usuário Agente (o cadastro só cria Dono) e todo atendimento ficava com quem o criou (`UsuarioId` = criador). O app do agente só funcionava com usuário inserido direto no banco.

**Decisão:**
1. **Aba Usuários no web (só Dono).** `GET/POST/PUT /api/usuario`, `POST /api/usuario/{id}/desativar`, `/reativar` e `/redefinir-senha`, todos com a policy `Dono`.
2. **Sem convite por email.** O servidor gera uma senha provisória (10 caracteres, alfabeto sem ambíguos), mostrada uma única vez ao Dono, que repassa ao agente. O usuário nasce com `DeveTrocarSenha = true` e web e app levam para a tela de troca no primeiro acesso (`POST /api/auth/trocar-senha`). Email continua pendente da DEC-34. *Substituído pela DEC-55 (12/11/2026): o acesso novo recebe convite por email e a pessoa cria a própria senha; a senha provisória saiu.*
3. **Desativar em vez de excluir.** `Usuario.Ativo` (default `true` para quem já existe). Inativo não loga (403) e o `TokenRevalidator` derruba o token na hora. Histórico de atendimentos fica preservado.
4. **Regras:** o Dono não desativa nem rebaixa a si mesmo; a empresa precisa de ao menos um Dono ativo.
5. **Responsável do atendimento.** `ResponsavelId` opcional no create/update do atendimento; ausente = o próprio Dono (create) ou mantém (update). Validado contra a empresa e só usuário ativo. A agenda do agente passa a mostrar o que o Dono atribuiu; no web, filtro "Toda a equipe" e "Com {nome}".
6. `UltimoAcessoEm` registrado no login, exibido na lista.

**Impacto:** migration `AddUsuarioAtivoESenhaProvisoria` (3 colunas em `Usuarios`). API, web e app precisam subir juntos por causa do `deveTrocarSenha` no login.


---

## DEC-36 — Agente cadastra serviço no app, com revisão do Dono

**Status:** 🟢 Implementado em `develop` e `main` (PR #47, 19/10/2026); migration aplicada no Supabase

**Contexto:** no web, serviço fora do catálogo já vira cadastro rápido (DEC-22), mas o app não conseguia: toda a API de serviço exige perfil Dono e a Descarga só aceitava itens com id do servidor. Em campo o agente ficava sem como registrar um serviço novo.

**Decisão:**
1. **Mesmo caminho dos clientes offline (DEC-33).** O app cria o serviço com UUID do device e já pode usá-lo no atendimento. A Descarga aceita `Servicos` (até 100 por leva), cria antes dos atendimentos e devolve `ServicosSincronizados` e `ServicosMapeados`; o item de serviço aceita `ServicoUuid` no lugar de `ServicoId`. O app religa os itens ao id real.
2. **Sem duplicar.** Reenvio com o mesmo UUID não cria de novo; descrição igual a um serviço ativo (sem diferenciar caixa e espaços) reaproveita o existente, e o atendimento usa o preço do catálogo.
3. **Revisão do Dono.** `Servico.Revisado` e `Servico.CriadoPorUsuarioId`. Criado pelo agente nasce `Revisado = false`; no web aparece "A revisar · criado no app por Fulano", com filtro e botão para marcar como revisado (`POST /api/servico/{id}/revisar`). Editar pelo web também conta como revisão. Serviços existentes ficam revisados.
4. **Chave em Parametrização.** `Configuracao.AgenteCadastraServico`, ligada por padrão. Desligada, a Descarga rejeita serviço novo do agente (o atendimento que o usa fica pendente no app com o motivo); o Dono continua podendo.

**Impacto:** migration `AddServicoCriadoPeloAgente` (2 colunas em `Servicos` com FK para `Usuarios` `SET NULL`, 1 em `Configuracoes`). O contrato da Descarga só ganhou campos opcionais: app antigo continua funcionando.


---

## DEC-37 — Rota do dia pelo endereço, sem geocodificação (fase 1)

**Status:** 🟢 Implementado em `develop` e `main` (PR #47, 19/10/2026)

**Contexto:** o plano da rota pronta tem três fases e todas dependem de latitude e longitude do cliente, que exigem um serviço de geocodificação (custo, cota e envio do endereço a terceiro, ponto de LGPD ainda não decidido). Abrir o Google Maps com as paradas não precisa disso: a URL aceita endereços em texto.

**Decisão:**
1. A agenda (`AgendaItemResponse`) passa a trazer `EnderecoCompleto` (rua, número, bairro, cidade e CEP); null quando o cliente não tem rua.
2. No app, a tela Início mostra "Iniciar rota · N paradas": abre o Google Maps com as visitas **pendentes de hoje**, na ordem dos horários, saindo da localização atual do celular. Limite de 10 paradas (destino + 9 da URL); o app avisa quem ficou de fora (sem endereço ou além do limite).
3. Cada visita com endereço ganha um botão que abre a navegação só até aquele cliente.
4. O endereço vai ao Google pelo próprio celular do agente, por ação dele, como já aconteceria copiando o endereço. Nada é enviado pelo servidor.

**Pendente (fases seguintes):** escolher o serviço de geocodificação (sugestão: OpenRouteService), registrar a decisão de LGPD, `Cliente.Latitude/Longitude`, `Servico.DuracaoMinutos`, mapa com pinos no web e "Otimizar dia". Atualização em 11/11/2026: só falta o "Otimizar dia"; o resto foi entregue (DEC-38 e DEC-45).

**Impacto:** sem migration. Campo novo e opcional na agenda; app antigo ignora.


---

## DEC-38 — Geocodificação com OpenRouteService e mapa da agenda com Leaflet

**Status:** 🟢 Implementado em `develop` e `main` (PR #47, 19/10/2026); migration aplicada no Supabase. Provedor aprovado por Diego em 17/10/2026.

**Contexto:** o mapa da agenda e a otimização da rota (fase 2) precisam de latitude e longitude dos clientes, e o sistema só guarda o endereço em texto.

**Decisão:**
1. **Geocodificação:** OpenRouteService (plano gratuito, mesma plataforma que fará a otimização da fase 2), atrás da interface `IGeocodificador` para trocar de provedor sem mexer no resto. Chave em `Geocoding__OpenRouteServiceApiKey`; sem ela, a geocodificação fica desligada.
2. **Em segundo plano:** um `BackgroundService` geocodifica clientes com rua e `GeocodificadoEm` nulo, em lotes de 25 com 1,5 s entre chamadas (dentro da cota de ~100 por minuto). Cadastro e sync não esperam pelo provedor. Endereço não encontrado fica marcado e não é repetido; falha de rede ou cota deixa pendente e o worker espera 10 minutos. Mudar o endereço apaga as coordenadas para geocodificar de novo. Os clientes que já existem são convertidos na primeira execução.
3. **LGPD:** só o endereço (rua, número, bairro, cidade, CEP e "Brasil") vai ao provedor, nunca nome, CPF ou telefone; a chave vai no cabeçalho, fora da URL. Cliente excluído tem as coordenadas apagadas junto com o endereço.
4. **Mapa no web:** aba "Mapa" na Agenda, um dia por vez, pinos numerados pela ordem dos horários e coloridos por responsável, com popup do atendimento e lista de quem está sem localização. Leaflet com blocos do OpenStreetMap, carregado só ao abrir a aba. O CSP do painel libera `https://tile.openstreetmap.org` em `img-src`.

**Impacto:** migration `AddClienteCoordenadas` (3 colunas em `Clientes` + índice). Nova variável no Render. Dependência nova no web: `leaflet` (+ `@types/leaflet`). A política de uso dos blocos do OpenStreetMap vale para volume baixo; se o uso crescer, trocar por um provedor de blocos (ex.: MapTiler) é só mudar a URL e o CSP.

---

## DEC-39 — Atendimento no app no mesmo nível do web

**Status:** 🟢 Implementado em `develop` e `main` (PR #48, 20/10/2026). Pedido por Diego em 20/10/2026, depois do levantamento web × app (documento fora do repositório).

**Contexto:** no app o agente só usava o preço do catálogo, não conseguia concluir uma visita agendada (só criar outro atendimento), não corrigia nada depois de salvar e via um "Estimado" diferente do que o servidor cobrava na empreitada com quantidade 2.

**Decisão:**
1. **Valor ajustado (DEC-23 no app):** a Descarga aceita `PrecoUnitario` opcional no item de produto de catálogo e no item de serviço; nulo cobra o catálogo. No app, o valor de cada item é editável e aparece marcado como "ajustado".
2. **Concluir atendimento existente:** nova lista `Conclusoes` na Descarga, com o uuid do atendimento do servidor, o novo status e itens acrescentados (os já gravados não mudam). O Agente só conclui atendimentos dos quais é responsável; o Dono conclui qualquer um. Cada item leva um `Uuid` do device, e o reenvio é reconhecido por ele, sem duplicar. Atendimento já finalizado rejeita itens novos. A agenda passa a trazer os itens já lançados (`Itens`) para o agente ver o que foi combinado.
3. **Corrigir antes de enviar:** atendimento e conclusão ainda não enviados podem ser reabertos, alterados ou excluídos no aparelho.
4. **Empreitada:** mantém a DEC-04. App e web lançam uma linha por unidade (quantidade 2 = duas linhas), e o estimado do app bate com o que o servidor cobra.

**Impacto:** sem migration. Contrato da Descarga e da agenda só ganha campos opcionais, então um app antigo continua funcionando.

---

## DEC-40 — Backend migrado para .NET 10

**Status:** 🟢 Implementado em `develop` e `main` (PR #53, 21/10/2026) e validado em produção por Davi (deploy Live no Render, login e sync testados). Pedido por Davi em 20/10/2026.

**Decisão:** API e testes passam de `net8.0` para `net10.0` (LTS), antes do fim do suporte do .NET 8 em 10/11/2026.
- Pacotes ASP.NET Core e EF Core em `10.0.13`, provider `Npgsql.EntityFrameworkCore.PostgreSQL` em `10.0.3`; Api e Tests seguem na mesma versão de EF Core (DEC-13).
- `Swashbuckle.AspNetCore` de 6.6.2 para 10.3.1: o `Microsoft.AspNetCore.OpenApi` 10 usa `Microsoft.OpenApi` 2.x, incompatível com o Swashbuckle 6. Major feito à mão, com validação (regra do `dependabot.yml`).
- Imagens Docker `sdk:10.0` e `aspnet:10.0`; CI com `dotnet-version: 10.0.x`.
- `ForwardedHeadersOptions.KnownNetworks` (obsoleto no .NET 10) trocado por `KnownIPNetworks`, sem mudar o comportamento.

**Impacto:** sem migration (`has-pending-model-changes` não acusa mudanças com o EF Core 10). Contratos da API iguais. A imagem Docker nova foi validada no deploy do Render.

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
