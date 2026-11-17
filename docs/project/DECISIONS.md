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

## DEC-41 — `main` is production; `develop` is integration and local testing

**Status:** 🟢 Implemented on 21/10/2026, requested by Diego and authorized by Davi: PR #60 promoted `develop` to `main` (merge commit) and Render and Cloudflare started deploying `main`; Cloudflare previews turned off.

**Decision:** Render (API) and Cloudflare Pages (web) deploy `main`. `develop` receives the new features and is tested on the machine, with a local API and local Postgres (`docker-compose.yml`, part of KAN-14), with no staging environment in the cloud.
- Cloudflare preview deployments turned off, so nothing outside `main` talks to the production API.
- Promotion always through a `develop → main` PR with a merge commit, never squash, so both branches keep the same history.
- A new migration is applied on Supabase before the merge into `main` and must be compatible with the previous API version.

**Why:** Render's Free plan allows one service on 24 h, not two, and Supabase Free has two projects; a staging environment in the cloud would cost money or wake the API halfway. Local testing covers the current team size.

**Impact:** no migration and no code change. Step by step in `deploy/README.md` (sections 8 and 9).

---

> **DEC-42 to DEC-45** are reserved for Davi Gomes's October batch (optional pagination, account lockout, user deletion with anonymization and service duration). PRs #98 to #102 were closed without merge on 25/10/2026, at his request, to be resumed later; the branches remain on GitHub. DEC-42 was resumed on 28/10/2026; DEC-43 to DEC-45 were resumed on 11/11/2026 (PRs #133 and #134).

---

## DEC-42 — Optional pagination in the lists

**Status:** 🟢 Implemented in `develop` and `main` (PR #98, reopened and merged on 28/10/2026), requested by Davi.

**Decision:** `GET` for clients, atendimentos, quotes, products and services accept `?pagina=&tamanho=` (default 20, maximum 100) and then return `{ itens, pagina, tamanho, total }`. Without the parameters, the response is still the whole list.

**Why:** the web uses the full lists in searches and pickers, and mobile does not use these endpoints (only sync); optional pagination breaks no consumer and is ready for when a screen needs it.

**Impact:** no migration. Pagination is done in the database and the ordering gained a tiebreak by `Id`.

**Update (PAG-01, 12/11/2026):** pagination became mandatory. Without `?pagina=&tamanho=`, the five lists return page 1 with 20; the ceiling is still 100. The web stopped downloading whole lists: screens load 50 at a time, the client, product and service picker fields search on the server, and client names and items come in the responses. New: search in products, services and quotes, `ids` in products, `revisado` in services, `ordem=registro` in atendimentos and `GET /api/orcamento/resumo`. Users still have no pagination.

---

## DEC-43 — Account lockout after wrong passwords

**Status:** 🟢 In `main` (PR #133, release #134, 11/11/2026). Code from Davi Gomes's October batch, integrated by Davi Oliveira; migration `AddBloqueioLoginExclusaoLgpdDuracaoServico` applied on Supabase on 11/11/2026.

**Decision:** 5 wrong passwords in a row on the same account lock the login for 15 minutes, even with the right password; the API answers 423 with the remaining minutes. A correct login resets the counter. The temporary password generated by the Dono or by the Agesto team (DEC-52) unlocks it immediately. Applies to Dono and Agente; the superadmin area login does not have this lockout.

**Why:** complements the per-IP limit, which does not stop attempts coming from several IPs.

**Impact:** columns `Usuarios.TentativasLoginFalhas` and `Usuarios.BloqueadoAte`. Anyone who knows someone's email can lock that account for 15 minutes; the per-IP limit reduces abuse.

---

## DEC-44 — Deleting one's own account with anonymization

**Status:** 🟢 In `main` (PR #133, release #134, 11/11/2026). Code from Davi Gomes's October batch, integrated by Davi Oliveira.

**Decision:** deleting one's own account (`DELETE /api/usuario`, LGPD) no longer deletes the row: the user is anonymized ("Usuário removido", email `removido-{id}@anonimo.invalid`), gets a random password and `DeletedAt`. The history (atendimentos, quotes) keeps pointing to the row, the person can no longer log in and the real email becomes free. The company cannot be left without an active Dono.

**Why:** the physical DELETE failed with a 500 error for anyone who had atendimentos or quotes (*Restrict* foreign keys) and went against the soft delete of the operational entities.

**Impact:** column `Usuarios.DeletedAt`. User lists, including those in the superadmin area, ignore removed users, and their token drops immediately.

---

## DEC-45 — Service duration and revenue per hour

**Status:** 🟢 In `main` (PR #133, release #134, 11/11/2026). Code from Davi Gomes's October batch (KAN-79), integrated by Davi Oliveira.

**Decision:** `Servico.DuracaoMinutos` (optional, from 1 to 1440) enters the web's service form. The service metrics now return hours and revenue per hour: an hourly service uses the hours recorded; an empreitada service uses executions times the estimated duration, and has no R$/h when it has no duration. Relatórios show R$/h per service.

**Why:** the remaining part of KAN-79. Margin per hour is still pending, because cost is not yet assigned to the service.

**Impact:** column `Servicos.DuracaoMinutos`. The AI Agente (DEC-21) receives the hours and R$/h together with the metrics.

---

## DEC-46 — MVP launch plan: scope and schedule

**Status:** 🟢 Decided by Diego on 22/10/2026 in the launch plan, with Davi Gomes's approval in the merge of PR #106 (27/10/2026). The full plan, with tasks, deadlines and status per person, is in the document "Agesto: plano de lançamento do MVP".

**Decision:**
1. **Launch audience:** the service provider with a small team (Dono on the web, agents on the Android app). The Venda/Híbrido mode, the retailer and AI (DEC-21) are out of the launch.
2. **Schedule:** dress rehearsal on 03/11, discounted paid pilot from 04/11 to 28/11 with a real customer, pilot review on 01/12 and official launch on 15/12/2026.
3. **Pilot gate (blockers):** installable APK, API that does not sleep, daily database backup, 30-day session (DEC-50), CPF validated by check digit in the app and on the web, terms of use and privacy policy accepted on first access, `/health` monitor and OpenRouteService key on Render.
4. **Billing:** no billing module in the pilot. For the launch, the Dono marks on the web whether the atendimento was paid or is open, with payment method and date (minimal billing). The Agesto subscription is monthly per company, with tiers by number of agents, paid through a recurring payment link.
5. **Other plan decisions:** the agent can change the price in the app (DEC-39 kept); `agesto` organization on expo.dev; Android package `br.com.agesto.app`; written pilot agreement; terms written by Davi Gomes with legal review; own domain (e.g. `agesto.com.br`); support by WhatsApp Business and email; redesign on the web before the launch and on the app afterwards (DEC-51).

**Owners:** Davi Gomes (mobile and general), Davi Oliveira (web and general) and Diego (infra and redesign). The task split is in `TASKS.md`, section "Lançamento do MVP".

**Impact:** the "Lançamento do MVP" section of `TASKS.md` becomes the priority; the rest of the backlog only gets in if it does not delay the pilot gate.

---

## DEC-47 — Android only via APK, outside the stores

**Status:** 🟡 Decided by Diego on 22/10/2026, with Davi Gomes's approval (PR #106, 27/10/2026). App project ready in `develop` (PR #108, 28/10/2026: `eas.json`, `br.com.agesto.app`, `expo-updates` and version warning) and download page at `/baixar` (PR #111). The first `eas build` is still missing, due by 31/10.

**Decision:** the agent app does not go to Google Play or the App Store. On Android it is always distributed as an APK, generated by EAS Build and downloaded from an Agesto page with step-by-step installation instructions. JavaScript fixes arrive through `eas update` (OTA); a native change requires a new APK.
- Every APK is signed with the same key, so it installs over the previous one without losing offline data. A copy of the key is kept outside the repository and Expo.
- The app warns when there is a new version that needs a new APK.
- iPhone is out for now: the pilot and the launch are Android only.

**Why:** avoids the stores' fee and review and gives full control of the release pace for a product sold directly to a few companies.

**Impact:** `mobile/eas.json`, `android.package` = `br.com.agesto.app` and `expo-updates` in the app; Agesto icon, adaptive icon and splash.

---

## DEC-48 — Open sign-up with email verification and a trial period

**Status:** ⛔ Replaced by DEC-57 (12/11/2026): there will be no open sign-up; the subscription starts through contact. Decided earlier by Diego on 22/10/2026, with Davi Gomes's approval (PR #106, 27/10/2026).

**Decision:** at the launch, any provider creates the account on the web, confirms the email and gets a trial period before subscribing. From the launch on, this replaces the sign-up closed by `Auth__RegistrationKey` from DEC-34. The per-IP rate limit stays.

**Why:** direct sales do not scale if each new account depends on someone from the team. DEC-34 already made reopening sign-up conditional on email verification.

**Impact:** depends on an own domain and on an email provider with an API (e.g. Resend), which also serves "forgot password". The sign-up key stays only for accounts created by the team during the pilot.

---

## DEC-49 — Paid hosting for the pilot and the launch

**Status:** 🟡 Decided by Diego on 22/10/2026, with Davi Gomes's approval (PR #106, 27/10/2026). To do: Render Starter before the rehearsal, Supabase Pro at the launch.

**Decision:**
1. **API:** Render Starter before the pilot, so the API does not sleep (on Free the first call takes about 1 minute and the agent app suffers from it in the field).
2. **Backup:** daily `pg_dump` through GitHub Actions, stored outside Supabase, with a restore test before the pilot.
3. **Database:** Supabase Pro from the launch on, to have managed backup and no pause for inactivity. In the pilot, Free with the backup from item 2 is enough.

**Why:** revisits the "free plan" of DEC-30 and DEC-32 for paying customers, who cannot wait for the API to wake up or lose data.

**Impact:** fixed monthly hosting cost, to be included in the subscription price (DEC-46). No code change; the backup gets a new workflow in `.github/workflows/`.

---

## DEC-50 — 30-day session

**Status:** 🟢 Decided by Diego on 22/10/2026, with Davi Gomes's approval (PR #106, 27/10/2026). Implemented in `develop` and `main` (PR #109, 28/10/2026): `Jwt:ExpiresMinutes` = 43200. Deactivating the user already drops the session; changing the password does not yet drop open sessions (`TokenRevalidator` only checks active user, company and profile), an open point.

**Decision:** the login lasts 30 days in the API and in the app (today the JWT expires in 120 minutes, `Jwt:ExpiresMinutes`). The revocation from DEC-34 stays: deactivating the user or changing the password drops the session on the next request.

**Why:** the agent works offline and cannot be logged out in the middle of the day, without internet, with atendimentos waiting to be sent.

**Impact:** no migration. Configuration on Render and an adjustment in the app to handle an expired session without losing local data.

---

## DEC-51 — Web redesign

**Status:** 🟢 In `develop` and `main` (PRs #80 to #95, from 22 to 25/10/2026): Diego did the redesign and Davi Oliveira the adjustment of the Agente panel (#95).

**Decision:** the Dono panel now follows the templates approved in `agesto/design/templates`, with the same data and flows as before:
- Marinho + Vermelho (default) and Oceano palettes, each with a light and dark theme, chosen in "Aparência"; Geist font served by the app itself, no CDN;
- collapsible sidebar, breadcrumb, search (Ctrl K) and drawer menu on the phone;
- new login without social sign-in, the Bloco symbol as logo and favicon;
- drawers and dialogs over the whole screen, visual review of the screens and Agente panel collapsed between screens.

**Why:** DEC-46 asks for the redesign on the web before the launch; the app gets the same look afterwards.

**Impact:** front end only, no change to the API. The Agente panel shows as "Prévia" (Preview) and is not part of the launch (AI was left out of scope in DEC-46); since 10/11/2026 its chat works with the AI from DEC-21, still with the "Prévia" badge. The design system is still to be closed by 17/11.

---

## DEC-52 — Superadmin area for the Agesto team

**Status:** 🟢 In `main` (PR #131, release #132, 10/11/2026), decided by Davi Oliveira on 10/11/2026. Migration `AddSuperadmin` applied on Supabase on 10/11/2026; the first admin was created the same day.

**Decision:** the Agesto team manages customer companies at `/admin`, in the current web:
- admin accounts separate from the companies' users (`AdminsPlataforma` table); the admin token has its own audience and the claim `escopo=plataforma`, so a customer's token does not open `/admin` and an admin's does not open the customer panel;
- list and view companies, create a company with a Dono (temporary password), block and unblock a company with a reason, and deactivate, reactivate or generate a temporary password for users of any company (*since DEC-55, the temporary password became an invitation and "enviar link de senha" (send password link) by email, and the team also creates accesses in a company*);
- admin team (add, deactivate and reactivate; nobody deactivates themselves; *since DEC-55, adding means inviting by email*);
- auditing of every admin action, including logins and refused attempts (`AuditoriasAdmin` table).

**Why:** replace sign-up through `curl` with `X-Registration-Key` and give the team a way to serve customers (access, password, late payment) without touching the database. Integrations come later.

**Impact:** a blocked company loses login and already issued tokens (`TokenRevalidator`, including in the app's sync). The first admin is created through `POST /api/admin/auth/setup` with `Admin__SetupKey`, only once (`deploy/README.md`, section 10). The admin login lasts 30 days (`Admin__ExpiresMinutes`), by Davi Oliveira's choice; since 13/11/2026 it lasts 24 hours (DEC-53). Pending: the temporary password dropping the user's already open sessions (also open in DEC-50).

**Stronger admin login (13/11/2026, branch `feature/superadmin-2fa-e-expo-web`):**
- **Per-account lockout:** 5 wrong passwords in a row lock the admin login for 15 minutes, the same as for users (DEC-43). It goes into the audit log ("conta-bloqueada").
- **Two-step verification by email** (Davi's choice, instead of an authenticator app): after the password, Agesto sends a 6-digit code through Brevo, valid for 10 minutes and only once, tied to that login attempt by a challenge. Five wrong codes invalidate the challenge, and a new login invalidates the previous code. The database stores only the hashes. The screen asks for the code, shows the masked email and allows resending. `Admin__DoisFatores=false` turns off the second step only in an emergency (e.g. Brevo down).

---

## DEC-53 — Web token in `localStorage`: risk accepted in the MVP

**Status:** 🟡 Risk accepted by Davi Oliveira on 11/11/2026, with review triggers. No code change.

**Decision:** the web keeps storing the JWT in `localStorage`: the companies' token in `web/src/lib/token.ts` and the admin one (`agesto_admin_token`) in `web/src/admin/sessao.ts`. The httpOnly cookie recommended in `docs/SECURITY_NOTES.md` (section 1) is left for later. The app keeps using `expo-secure-store`.

**Why:**
- API (`agesto-api.onrender.com`) and web (Cloudflare Pages) are on different sites. A login cookie between them requires `SameSite=None`, CSRF protection and credentials in CORS, and browsers that block third-party cookies can break the login. Doing it well needs an own domain with API and web on the same site.
- The app uses a Bearer token; the API would have to accept both modes.
- The risk today is contained: the CSP in `web/public/_headers` only runs scripts from the site itself (`script-src 'self'`) and only connects to the site itself and the API; React escapes displayed text; the only `dangerouslySetInnerHTML` (`Icon.tsx`) uses fixed drawings from the code; `TokenRevalidator` immediately drops the token of a deactivated user or a blocked company; and there are only test accounts.

**Accepted risk:** an XSS that gets past the CSP takes a token valid for up to 30 days (DEC-50 and DEC-52), and changing the password does not yet drop open sessions.

**Review when the first of these happens:** Agesto's own domain, the first paying customer or the end of the test accounts phase. At that point, migrate the web to an httpOnly cookie.

**Until then:**
- do not remove or loosen the CSP in `web/public/_headers`;
- do not use `dangerouslySetInnerHTML` with user or API data;
- open items that reduce the risk without migrating: shorten the admin token's validity (done on 13/11/2026: 24 hours by default in `Admin__ExpiresMinutes`, decided by Davi Oliveira) and make a password change drop open sessions (token version, also open in DEC-50 and DEC-52).

**Impact:** none now. The future migration touches token issuing, API authentication, CORS and the web's HTTP client.

---

## DEC-54 — Dono's "Esqueci a senha" (forgot password) by email, with Brevo

**Status:** 🟢 In `main` (PR #161, release #163, 12/11/2026), chosen by Davi Oliveira. Migration `AddTokenRedefinicaoSenha` applied on Supabase; Brevo configured on Render and sending tested in production on 12/11/2026.

**Decision:** the Dono asks, on the login screen, for a link to create a new password:
- `POST /api/auth/esqueci-senha` always answers the same message, whether the email exists or not. It only generates a link for an active Dono of an active company; the agent keeps getting a temporary password from the Dono (DEC-35).
- The token has 32 random bytes and lasts 15 minutes, only once. The database keeps only the SHA-256 hash (`TokensRedefinicaoSenha` table). A new request invalidates the previous one, and each account gets at most one email every 2 minutes.
- The link is `{Email:UrlWeb}/redefinir-senha#token=...`: after the `#`, the token does not go to the web server nor show up in logs.
- `POST /api/auth/redefinir-senha` changes the password, removes the wrong-password lockout (DEC-43) and invalidates all of the account's open links.
- Sending is through Brevo (HTTP API; Render Free blocks SMTP), in an in-memory queue outside the request: the response takes the same time whether the email exists or not, and a slow Brevo does not hold up the screen.
- Without `Email__BrevoApiKey` and `Email__RemetenteEmail`, sending is off and the route keeps answering the same.

**Why:** a Dono without access depended on the Agesto team for a temporary password (DEC-52). Brevo was chosen by Davi Oliveira; the free plan sends up to 300 emails per day.

**Impact:** migration `AddTokenRedefinicaoSenha` (new table with RLS and the `agesto_api` policy). New variables on Render (`deploy/README.md`, section 3). Until SEG-01 lands (PR #155), resetting the password does not drop already open sessions.

**Update (DEC-55, 12/11/2026):** "Esqueci a senha" now also applies to the Agente (in the app and on the web), and the same table stores the invitation links.

---

## DEC-55 — New accesses by email invitation; end of the temporary password

**Status:** 🟢 In `main` (PR #162, release #163, 12/11/2026), decided by Davi Oliveira. Migration `AddConvitesPorEmail` applied on Supabase; sending tested in production on 12/11/2026.

**Decision:** nobody receives a password from another person anymore. Every new access is born with a **pending invitation** and the person creates their own password through the link in the email:
- **Who creates access:** the Dono, on the Usuários screen (Agente employee or another Dono of the company), and the Agesto team, in the superadmin (Dono of the new company and any access of a company). A new team administrator is also invited this way; only the first admin still goes through the setup with `Admin__SetupKey`.
- **Invitation:** link `{Email:UrlWeb}/criar-senha#token=...` (admin: `/admin/criar-senha`), valid for **72 hours** and only once; a new invitation invalidates the previous one. When used, the password is created and the email is confirmed (`Usuario.EmailConfirmadoEm`, `AdminPlataforma.EmailConfirmadoEm`). The agent's email points to the app and to `/baixar`.
- **Temporary password:** removed from the Dono and the superadmin. The Dono only **resends the invitation** to whoever has not created a password yet. In the superadmin, "senha provisória" (temporary password) became **"Enviar link de senha"** (resends the invitation, or sends a 72-hour link to whoever already has access; the current password works until the link is used).
- **Forgot password:** Dono and Agente (15-minute link, DEC-54).
- **Existing accesses:** do not change. The migration marks their email as confirmed by the creation date; nobody loses their password or gets an email.

**Why:** requested by Davi Oliveira on 12/11/2026. The temporary password passed through third parties (Dono, team, WhatsApp); with the invitation, only the person knows the password and the email is confirmed.

**Impact:** migration `AddConvitesPorEmail` (columns `EmailConfirmadoEm`, and `AdminId` and `Tipo` in the links table). New routes: `POST /api/usuario/{id}/reenviar-convite`, `POST /api/admin/empresas/{id}/usuarios`, `POST /api/admin/empresas/{id}/usuarios/{usuarioId}/enviar-link-senha`, `POST /api/admin/equipe/{id}/reenviar-convite` and `POST /api/admin/auth/criar-senha`. Removed: `POST /api/usuario/{id}/redefinir-senha` and `.../senha-provisoria`. New web screens: `/criar-senha` and `/admin/criar-senha`; the app gets "Esqueci a senha". Revisits item 2 of DEC-35 and the temporary password of DEC-52.

## DEC-56 — WhatsApp by link (wa.me), with no integration with the Dono's account

**Status:** 🟢 Links in `main` (PR #168, release #169, 12/11/2026), chosen by Davi Oliveira. Quote PDF on the `feature/orcamento-pdf` branch (12/11/2026).

**Decision:** Agesto talks to WhatsApp only through **`wa.me` links**. The button opens the WhatsApp of whoever is using Agesto (web or app), in the conversation with the client and, when it makes sense, with the message already written. The person reviews and sends it from their own WhatsApp. Agesto stores no session, credential or conversation:
- **Quote (web):** goes as a **PDF** (Davi's request on 12/11/2026, instead of the message with the items). The PDF is generated in the browser and carries company, client, items and total, **never cost or margin**. Since `wa.me` does not accept attachments: on the phone, "Enviar PDF por WhatsApp" (send PDF by WhatsApp) opens the system share sheet with the file, and the person picks WhatsApp and the contact; on the computer, the PDF is downloaded and the client's conversation opens in WhatsApp, to attach the file. "Baixar PDF" (download PDF) is for email or printing.
- **Clientes and Agenda (web), app schedule:** a button or link that opens the conversation with the client.
- **Phone:** accepts area code + number (10 or 11 digits) or already with the 55; without a valid phone, the button does not show (on the quote, it is disabled and explains why).
- **Out of this phase:** talking to clients inside Agesto. If needed, the way is the official WhatsApp API (Cloud API, from Meta), in its own DEC with cost and scope. **Not Baileys**, nor other libraries that imitate WhatsApp Web.

**Why:** requested by Davi Oliveira on 12/11/2026, for the Dono to talk to clients through WhatsApp from Agesto. Baileys was evaluated and refused: it is not official and can lead to the Dono's number being banned; the stored session would give access to their whole WhatsApp; it would require an always-on Node.js service, outside the current architecture; it breaks when WhatsApp changes; and it would greatly increase the personal data under Agesto's responsibility (LGPD). The link delivers the main thing, fits before the launch and has none of these risks.

**Impact:** `OrcamentoResponse` gains `ClienteTelefone`, and `ConfiguracaoResponse` gains `EmpresaNome` and `EmpresaDocumento` (no migration; the name also shows up in the web account, instead of "Minha empresa"). Utilities `web/src/lib/whatsapp.ts` and `mobile/src/lib/whatsapp.ts`; PDF in `web/src/features/orcamentos/pdf.ts`, with the `jspdf` dependency loaded only when the quote opens. The app only gets the button in a next build or update.

## DEC-57 — Sales by contact, no open sign-up; sales page at the web root

**Status:** 🟢 In `main` (sales page: PR #172, release #173, 12/11/2026; `/conheca`: PR #174, release #175, 13/11/2026), decided by Davi Oliveira and tested by him in production. Replaces DEC-48.

**Decision:** Agesto **will not have open sign-up**. Whoever wants to subscribe gets in touch, and the team creates the company in the superadmin; the Dono receives the invitation by email and creates the password (DEC-52, DEC-55).
- **Sales page:** someone not logged in who opens the web root (`/`) sees the Agesto presentation. Someone logged in keeps going straight to the Visão geral. The page is always in light mode (Marinho palette), and the login gets the link "Conheça e fale com a gente" (learn more and talk to us). The **`/conheca`** address shows the page to anyone, logged in or not; it is the link to share (social media, WhatsApp, proposals) and to show Agesto without leaving the account. For someone logged in, the "Entrar" (sign in) button becomes "Ir para o painel" (go to the panel).
- **Content:** the promise "sua empresa inteira em um lugar só" (your whole company in one place), the features, the flow from quote to result, how to start, the prices, the FAQ and the contact.
- **Prices** (set by Davi on 12/11/2026): **subscription of R$ 49,90/month** per company, with the Dono's access and all features, **plus 1 employee license included**. Each additional employee costs **R$ 19,90/month**. The page has a calculator that carries the number of employees into the WhatsApp message.
- **Payment:** credit card, boleto or Pix. The method, and other arrangements, are agreed in the contact; the page does not talk about lock-in or cancellation.
- **Contact:** commercial WhatsApp (34) 99632-6130, through the `wa.me` link (DEC-56), and the email agesto.contact@gmail.com. There is no form, so as not to open a public endpoint in the API.
- **Hosting:** in the same web project (Cloudflare Pages), with the page's code in a separate chunk, loaded only by whoever opens it. When there is an own domain, or if marketing grows, the page can move to its own project (e.g. `agesto.com.br` and the panel at `app.agesto.com.br`).

**Why:** requested by Davi Oliveira on 12/11/2026. Sales are done by the team, with subscription and licenses agreed in the contact. DEC-48 planned open sign-up with email verification and a trial period; that is no longer needed. In the same project there is no new infra nor dependency on the own domain, which does not exist yet.

**Impact:** no API change or migration. `ProtectedRoute` gains `raizPublica`; the page lives in `web/src/pages/venda/`. The open sign-up tasks leave TASKS, and the presentation page is done now. Subscription control (who paid and who is late) remains open.

## DEC-58 — Subscription and license control in the superadmin

**Status:** 🟡 Defined by Davi Oliveira on 13/11/2026; implemented on the `feature/controle-assinatura` branch (13/11/2026). The `AddAssinatura` migration is still to be applied.

**Decision:** each company's subscription is controlled in the superadmin, with no payment gateway in the MVP (card, boleto or Pix are agreed in the contact, DEC-57):
- **Manual payment record:** the team records each payment (date, amount, method and which month it refers to), with a history per company. Each payment moves "pago até" (paid until) to the end of the paid period.
- **Status:** up to date, due soon or late (with the days late), and the superadmin's company list can filter by it.
- **Late payment:** **manual** blocking (the button that already exists, DEC-52) and **automatic**: after a **10-day grace period** without payment, the company is blocked on its own until the team records the payment and unblocks it. Unblocking can also be manual.
- **Notice to the Dono:** a notice at the top of the panel when the subscription is close to due, overdue or in the grace period (with how many days are left before blocking), and an "Assinatura" (subscription) block in Parametrização with plan, licenses and due date.
- **Licenses:** the subscription (R$ 49,90/month) includes the Dono and **1 employee**; each additional employee is a R$ 19,90/month license (DEC-57). The number of licenses is stored on the company and only the team changes it. The Dono **cannot go beyond what was contracted**: when trying to invite an employee beyond the licenses, Agesto asks them to talk to the team.

**Why:** sales are by contact and payment is agreed outside the system; the control needs to show who paid, who is late and lock usage without payment, with a grace period so as not to cut off a customer for being a few days late.

**How it turned out (13/11/2026):**
- **Empresa:** `PagoAte`, `LicencasFuncionarios` (default 1), `BloqueioAutomatico` and `BloqueioAutomaticoReferencia`. `PagamentosAssinatura` table with the history, with RLS.
- **Existing companies:** stay **without billing** (empty `PagoAte`), with no notice and no automatic blocking, until the team records the first payment or adjusts "pago até". The migration sets the licenses to today's active accesses, so nobody is locked.
- **Status, by the Brasília day:** up to date; due soon (up to 5 days); in grace period (overdue for up to 10 days, with a notice to the Dono and the countdown to blocking); late (more than 10 days).
- **Payment:** the period starts the day after the last paid day (with no history, today) and covers 1 to 12 months.
- **Automatic blocking:** a routine in the API runs every hour and blocks the late ones, recorded in the audit log as "Sistema". A payment removes this block on its own; a manual block is only removed by the team. If the team manually unblocks a late company, the routine does not block it again until "pago até" changes.
- **Licenses:** count active accesses, including pending invitations. The Dono and the team cannot create or reactivate access beyond what was contracted (409, with the message asking to talk to the team); deactivating is always allowed.
- **Screens:**
  - in the superadmin, the **Assinatura** block (status, amount, licenses, accesses in use, history, "Registrar pagamento" (record payment) and "Ajustar" (adjust)), the subscription column and filter in the company list;
  - for the Dono, the notice at the top of the panel (due soon or grace period, with the link to Agesto's WhatsApp) and the **Assinatura** block in Parametrização (`GET /api/assinatura`).
- **Undo payment (13/11/2026, branch `feature/pagamentos`):** the team undoes a payment recorded by mistake from the superadmin history. Only the last active payment, and only while "pago até" is still the one it generated; after an "Ajustar", it is corrected through "Ajustar". "Pago até" goes back to what it was before the payment, the record stays in the history as undone (who and when), the automatic blocking routine applies again and the action goes into the audit log.
