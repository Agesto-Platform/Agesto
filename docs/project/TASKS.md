# Agesto — Tasks and Roadmap

> Simplified mirror of Jira (KAN project). For detailed status, open the board at `gomesdavi731.atlassian.net`.
> Update this file whenever a task changes status or a new decision affects the roadmap.
> **Note:** this file is being reconciled with code and Git. Jira should only be synced after this audit.

## Transition to team work — 18/08/2026

| Item | State |
|---|---|
| Centralize documentation in `docs/project/` | 🟢 Done |
| Define members, roles and initial focus | 🟢 Done — revised on 22/10/2026: Davi Gomes (mobile and general), Davi Oliveira/`ghzpro034` (web and general), Diego/`Depowo` (infra and redesign) |
| Create the GitHub organization and transfer to `Agesto-Platform/Agesto` | 🟢 Done |
| Set up the `Core` team, minimal access and a second Owner | 🟢 Done — Davi and Depowo are Owners |
| Protect `develop` and `main` with PR, review and status checks | 🟢 Done — ruleset requires a PR and the Backend, Web and Mobile checks; no required approval (decision of 10/10/2026) |
| Add CI for backend, web and mobile | 🟢 Done — validated in the governance promotion |
| Audit the rebuilt `REQUIREMENTS.md` | 🟡 In progress — Davi Gomes, after the launch |
| Publish the consolidated local line to `main` | 🟢 Done — merge `72b021b` |

---

## MVP launch (Lançamento do MVP, by 15/12/2026) — DEC-46

> Team priority. Dress rehearsal on 03/11, pilot from 04/11 to 28/11, review on 01/12 and launch on 15/12. Each task has one owner; when someone else takes part, they appear in parentheses. When you finish a task, change the status here and in the document "Agesto: plano de lançamento do MVP" (tab "Tarefas por pessoa"). Origin: B = pilot blocker, I = pilot improvement, L = launch, D = plan decision.

### Davi Gomes — mobile and general

| Deadline | Task | Origin | Status |
|-------|--------|--------|--------|
| 24/10 | Choose the pilot customer and confirm the agents use Android. While there is no customer, validation goes on with a test user (Diego, 28/10) | D1 | To do |
| 24/10 | CPF with check digit in the app and a client not yet sent still editable | B5 | Done (PR #107, 28/10) |
| 27/10 | APK: `mobile/eas.json`, `android.package` = `br.com.agesto.app`, `expo-updates` and new version warning (DEC-47; the icon comes from Diego) | B1 | Done (PR #108, 28/10); the first `eas build` is Diego's |
| 31/10 | 30-day session in the API and the app, with revocation on deactivation (DEC-50) | B4, D7 | Done (PR #109, 28/10) |
| 31/10 | Text of the terms of use and privacy policy, with legal review | B6, D8 | In progress: draft ready, legal review missing. The public pages `/termos` and `/privacidade` already exist on the web (PR #115) and get the text from `web/src/pages/legal/textos.ts` |
| 31/10 | Terms acceptance screen in the app | B6 | Done (PR #110, 28/10); migration `AddUsuarioAceiteTermos` applied on Supabase on 28/10 |
| 31/10 | Written pilot agreement: free or discounted period, data usage | D9 | In progress: draft ready, still to close with the pilot customer |
| 04/11 | Pilot Dono account, catalog, clients, agents and in-person training | Pilot | To do |
| 10/11 | APK download page with step-by-step installation (`/baixar` on the web) | L3 | Done (PR #111, 28/10) |
| 14/11 | Search in the app, refusal reason and cancel atendimento in the app | I1 to I3 | Done (PR #112, 28/10) |
| 28/11 | Sync when the app opens and when the internet comes back | I5 | Done (PR #113, 28/10) |
| 28/11 | Resume or discard the October batch (PRs #98 to #102: pagination, account lockout, user deletion with anonymization and service duration) | DEC-42 to 45 | Done: pagination (PR #98, DEC-42, 28/10); account lockout, user deletion and service duration integrated by Davi Oliveira on 11/11 (PR #133, release #134, DEC-43 to 45), migration applied on Supabase |
| 01/12 | Pilot review and subscription price (everyone takes part) | D10 | To do |
| 12/12 | CNPJ and subscription invoice; formalize the ownership of contributions (DEC-29) and decide whether the repository stays public (DEC-24) | Legal | To do |

### Davi Oliveira — web and general

| Deadline | Task | Origin | Status |
|-------|--------|--------|--------|
| 24/10 | CPF with check digit on the web | B5 | Done (PR #117, 28/10) |
| 31/10 | Terms acceptance screen on the web (the API exists since PR #110) | B6 | Done (PR #119, 28/10) |
| 03/11 | Integrated tests with real web, app, API and PostgreSQL, as the dress rehearsal script (KAN-41) | Gate | To do |
| 14/11 | Dono's "Esqueci a senha" (forgot password) by email (API and web) | I4 | Done in code (12/11, DEC-54): `/esqueci-senha` and `/redefinir-senha` screens, sending through Brevo. In `main` since 12/11 (release #163); Brevo configured on Render and sending tested in production. Since DEC-55 it also applies to the Agente, in the app and on the web |
| ~~17/11~~ | ~~Design the open sign-up flow: screen, verification email and trial period (DEC-48)~~ | D11 | Cancelled (12/11): no open sign-up, sales are by contact (DEC-57) |
| ~~28/11~~ | ~~Open sign-up live with email verification and trial period~~ | L1 | Cancelled (12/11, DEC-57). The new account is created by the team in the superadmin, with an email invitation (DEC-55) |
| 01/12 | Support channel: WhatsApp Business and email | D14 | To do |
| 08/12 | Minimal billing on the web: atendimento paid or open, payment method and date | L5 | Done (PR #188, release #189, 13/11): "A receber" (receivable) tab with total, Pago/A receber badge in the list and date and method recorded in the detail (`PUT /api/atendimento/{id}/recebimento`, Dono only). Migration `AddRecebimentoEDesfazerPagamento` applied on Supabase on 13/11 |
| 08/12 | Short user manual for the Dono and the agent (KAN-42) | L4 | To do |
| 12/12 | Subscription control: who paid and who is late | L5 | Done (PR #184, release #185, 13/11; DEC-58): payment recorded in the superadmin, manual and automatic blocking after a 10-day grace period, notice to the Dono and license lock. Undo the last payment recorded by mistake: PR #188, release #189 (13/11). Migrations `AddAssinatura` and `AddRecebimentoEDesfazerPagamento` applied on Supabase |
| 12/11 | Presentation page with price, terms, download and contact | L4 | Done (PR #172, release #173, 12/11; `/conheca` in PR #174, release #175, 13/11; tested by Davi): sales page at the web root, with a R$ 49,90 subscription (Dono and 1 employee) and R$ 19,90 per additional employee; payment by card, boleto or Pix, agreed in the contact (DEC-57) |
| 10/11 | AI: insights report and Agente panel chat (DEC-21), out of the launch scope | Extra | Done (PRs #126 to #130, 10/11); `Insights__AnthropicApiKey` key on Render |
| 10/11 | Superadmin area at `/admin`: companies, users, team and auditing (DEC-52) | Extra | Done (PR #131, release #132, 10/11); first admin created |
| — | Superadmin: per-account lockout on the admin login and two-step verification (DEC-52) | Extra | Done (PR #182, release #183, 13/11): 5 wrong passwords lock for 15 min; 6-digit code by email at login. Migration `AddAdminLoginSeguro` applied on Supabase |
| — | Temporary password dropping the user's already open sessions (DEC-50, DEC-52, DEC-53) | Extra | Ready in PR #155 (SEG-01), on hold: kept out of `develop` by Davi's decision (12/11). See SEG-01 below |
| — | Shorten the admin token validity (`Admin__ExpiresMinutes`) while the web uses `localStorage` (DEC-53) | Extra | Done (PR #188, release #189, 13/11): default of 24 hours (1440 min), decided by Davi Oliveira; `Admin__ExpiresMinutes=1440` also on Render (13/11) |
| — | Migrate the web token to an httpOnly cookie at the first DEC-53 trigger (own domain, paying customer or end of the test accounts) | Extra | Waiting for trigger |
| 12/11 | Email invitations: new access (by the Dono or by the Agesto team) and admin invitation, with the person creating their own password; end of the temporary password (DEC-55) | Extra | Done (PR #162, release #163, 12/11); migrations applied on Supabase and sending tested in production |
| — | AI: record consumption per company (`TenantUsage`) and per-plan limit (DEC-21) | Extra | Done (PR #176, release #177, 13/11; tested by Davi): `UsosIa` table (migration applied on Supabase) and 20 questions per company per day. Per-plan limit: does not apply while there is only one plan (Davi's decision, 13/11) |
| 12/11 | RLS on the superadmin tables (`AdminsPlataforma`, `AuditoriasAdmin`), which were left out of `EnableRlsLockdown` (DEC-34, DEC-52) | Extra | Done (PR #166, release #167, 12/11): migration `EnableRlsSuperadmin` applied on Supabase, with the `agesto_api` policy. There was no exposure (`anon` and `authenticated` without privilege, Data API off). Checked on 13/11: all 18 tables with RLS |
| 12/11 | WhatsApp by `wa.me` link: send the quote through WhatsApp and open the conversation with the client on the web and in the app (DEC-56) | Extra | Links done (PR #168, release #169, 12/11). Quote as PDF instead of the message: done (PR #170, release #171, 12/11). Conversation inside Agesto comes later, through the official API (DEC-56) |

### Diego — infra and redesign

| Deadline | Task | Origin | Status |
|-------|--------|--------|--------|
| 24/10 | Render Starter for the pilot and the launch (DEC-49) | B2, D2 | To do. No longer to keep the API from sleeping: since 11/11 the `agesto-keepalive` Worker keeps the API and the database awake (DEC-32). The paid plan is still planned in DEC-49 |
| 24/10 | `agesto` organization on expo.dev, with both Davis | D3 | To do |
| 24/10 | `/health` monitor with alert and `Geocoding__OpenRouteServiceApiKey` key on Render | B7, B9 | To do |
| 24/10 | Push and merge access for the Davis, or the Claude app on the organization's GitHub | Operations | To do |
| 27/10 | Agesto icon, adaptive icon and splash for the APK | B1 | To do |
| 31/10 | Daily backup with `pg_dump` (GitHub Actions) and a restore test (DEC-49) | B3 | To do |
| 31/10 | First `eas build` before the rehearsal | B1, B8 | To do. The `develop → main` promotion that was part of this task already happens at every release (the latest was #189, on 13/11), and the `AddUsuarioAceiteTermos` migration is on Supabase since 28/10 |
| 03/11 | Dress rehearsal with both Davis | Gate | To do |
| 10/11 | Own domain for the web and the API, with CORS and CSP adjusted | L2, D12 | To do |
| 10/11 | Account with an email provider with an API and key on Render | I4, L1 | Done (12/11): Brevo account (DEC-54) and `Email__*` variables on Render; the step by step is in `deploy/README.md`, section 11 |
| 17/11 | Close the design system | D13 | To do |
| 05/12 | Copy of the APK signing key stored outside the repository and Expo | B1 | To do |
| 12/12 | Web redesign (DEC-51): in `main` since 25/10; final polish missing | L6 | In progress |
| 12/12 | Supabase Pro before the launch (DEC-49) | L2 | To do. Checked on 13/11: organization on the Free plan, which has no daily backup; database at 12 MB |
| 12/12 | Production APK on the download link and last promotion to `main` | L3 | To do |

---

## High findings from the 10/11/2026 audit — open

> Quick-mode audit of `develop` `4da57dc`, with a local API and a disposable PostgreSQL (Davi's local report, outside the repository). The four stock and conversion findings and SEG-01 were reproduced by an independent verifier, over HTTP against a real Postgres; PAG-01, PAG-02 and PERF-01 were confirmed by reading the code. Checked again on `develop` `c58b44e` (11/11): still open. COD-01 (physical user deletion) was resolved by PR #133. COD-03 (medium: simultaneous sales of the same product in different atendimentos overwrote each other) was resolved together with E2E-01 by PR #143, release #144 (11/11): `Produto.QuantidadeEstoque` became a concurrency token, and the write that loses the race gets 409 on the web or stays pending in the app. Owner and priority depend on Davi.

| ID | Problem | Where | Davi's decision | Status |
|----|----------|------|-----------------|--------|
| E2E-01 | Converting the same quote in parallel creates two or more atendimentos and loses stock updates (5 simultaneous calls: 15 units recorded, stock dropped only 3) | `OrcamentoService.cs:159-171` ("already converted" check outside a lock), `ItemProdutoService.cs:63-73` (stock written as an absolute value) | — | Done (PR #143, release #144, 11/11): quote reserved with a conditional `UPDATE` in the transaction; the second conversion gets "Orçamento já foi convertido." |
| E2E-02 | Empreitada service with quantity 2: the quote charges 2 × value, the converted atendimento charges 1 × value | `OrcamentoService.cs` (subtotal always quantity × price) × `ItemServicoService.cs:59-60` (empreitada ignores quantity, DEC-04) | Lock the quantity at 1 (11/11) | Done (PR #149, 11/11): the quote refuses an empreitada with quantity other than 1, and the web form locks the field at 1; to charge again, another line. No quote in production had an empreitada with quantity above 1 |
| E2E-03 | Turning "Controla estoque" off and on again creates phantom stock: the item recorded with the switch off returns units when deleted | `ItemProdutoService.cs:66,161` and `AtendimentoService.cs:143` (the return checks the current switch, not the one at recording time) | — | Done (PR #146, release #147, 11/11): each item stores whether it deducted stock (`ItemProduto.EstoqueBaixado`), and only those return stock when deleted; the migration applied on Supabase marked the old items by the previous rule |
| E2E-04 | Cancelling the atendimento does not return the stock, and the metrics treat the cancelled one as if it had not consumed anything: the units disappear | `AtendimentoService.cs` (the PUT only changes the status) × `MetricasRepository.cs` (filters `Status != Cancelado`) | Cancelling returns the stock: yes (11/11) | Done (PR #146, release #147, 11/11): cancelling returns the stock, including through the app's completion; leaving Cancelado deducts again and is refused without balance. The metrics, which already exclude cancelled ones, become consistent |
| SEG-01 | Changing or resetting the password does not drop the 30-day token, and reactivating the user makes the old token valid again: there is no way to end the session of a compromised account | `TokenRevalidator.cs` (checks only active, removed, company, profile) | Session version on the user (migration) and behavior on reactivation | On hold (12/11): implemented and tested in PR #155 (branch `feature/fix-SEG-01`), open and **not merged**; by Davi's decision, it does not go into `develop` now. Checked on 13/11: the PR now conflicts with `develop` in the code too (`Usuario.cs`, `UsuarioService.cs`, `AdminEmpresaService.cs`, user and admin tests) and in DECISIONS.md and TASKS.md; when resuming, update the branch and regenerate the `AddUsuarioVersaoSessao` migration after the 13/11 migrations (not yet applied on Supabase) |
| PAG-01 | Web and app do not use the DEC-42 pagination: with 10 thousand clients, the list comes with 3 MB; with 30 thousand atendimentos, 9.5 MB, and everything is drawn at once | `web/src` and `mobile/src` (no call with `?pagina=`) | Mandatory pagination with a ceiling after migrating the screens; "Carregar mais" (load more) 50 at a time, with search and filters on the server (11/11). In three phases: (1) Clientes and Atendimentos screens; (2) client and product picker fields with search, and Dashboard; (3) mandatory pagination with a ceiling of 100 | Phase 1 done (PR #153, 11/11). Phases 2 and 3 done (12/11): client, product and service fields with server search; Dashboard with only the last 6; Orçamentos, Produtos and Serviços 50 at a time, with search; client names and items in the responses; `GET /api/orcamento/resumo`; the five lists always paginated (without parameters, page 1 with 20). See DEC-42 |
| PAG-02 | The schedule accepts any period: the Atendimentos screen asks for the whole year (6.3 MB, p95 of 5.8 s with 10 simultaneous users, measured locally) | `AtendimentoRepository.cs:36-44`, `web/src/lib/queries.ts:26` | 62-day ceiling; remove "Ano" (year) from the Agenda; the API sends the summary in the list (11/11) | Done (PR #150, 11/11): a schedule above 62 days returns 400; the web Agenda has only 7 days and Month; the atendimentos list brings the summary, and Atendimentos and Clientes no longer ask for the year's schedule |
| PERF-01 | The app always asks for the full Carga (3.8 MB with the test volume) and rewrites each whole table in SQLite; the API already accepts `ultimaSincronizacao` | `mobile/src/sync/sync.ts:28-33`, `mobile/src/db/sqliteDb.ts:17-24` | Incremental Carga with deletions (tombstones) | Done (PR #151, 11/11): with a Carga less than 7 days old, the app asks only for what changed and deletes the removed ids; the full one comes back the first time, every 7 days and with an API without `removidos`. Locally: 3.7 MB for the full one, 473 B for the incremental one without changes |

---

## Epic status

| Epic | Description | Status |
|-------|-----------|--------|
| KAN-11 | Infrastructure & DevOps | 🟡 In progress |
| KAN-19 | Backend Core (C# / ASP.NET) | 🟢 Essentially complete |
| KAN-30 | AI/Insights Module (Python) | ⚫ Obsolete — discarded (DEC-21 resolved: AI runs in C# in the backend) |
| KAN-37 | Documentation & QA | 🟡 In progress |
| KAN-44 | Web Frontend (React) — Dono Module | 🟢 Complete (web-01 to web-14, sidebar 100% functional + base tests, see DEC-25) — in production against the real API (DEC-32) |
| KAN-69 | Service Provider domain (Orçamento, Agenda, generic item, editable value) | 🟢 Backend essentially complete — migrations applied and route phase 1 delivered (DEC-37/38); quote Descarga in sync and "Otimizar dia" (phase 2) still missing |
| KAN-77 | Metrics & Dashboards layer | 🟡 In progress |
| — | Mobile (React Native) — Agent App | 🟢 Complete (mob-01 to mob-07, offline-first, see DEC-26) — in production against the real API (DEC-32), atendimento on par with the web (DEC-39) |

---

## Current sprint — Backend Core

### ✅ Done

| KAN | Description | Owner |
|-----|-----------|-------------|
| KAN-20 | Usuario entity + AuthService (JWT) | Luan |
| KAN-21 | Configuracao entity | Davi Gomes |
| KAN-22 | Cliente CRUD | Davi Gomes |
| KAN-23 | Produto CRUD + stock control* | Davi Gomes |
| KAN-24 | Servico CRUD | Luan |
| KAN-25 | Atendimento + calcularTotal() | Davi Gomes |
| KAN-26 | ItemProduto + ItemServico | Luan |
| KAN-27 | Hybrid Atendimento filters | Davi Gomes |
| KAN-28 | Unit tests (xUnit + Moq) | Luan |
| KAN-29 | InitialCreate migration + Supabase | Diego |
| KAN-56 | Empresa entity + multi-tenant refactor | Davi Gomes |
| KAN-57 | Perfil field on Usuario + JWT claims | Davi Gomes |
| KAN-58 | Remove BYOK fields from Configuracao | Davi Gomes |
| KAN-59 | Configuracao Controller/Service/Repository | Davi Gomes |
| KAN-62 | Empreitada billing on Servico | Davi Gomes |
| KAN-63 | Fix empresaId extraction in the controllers (multi-tenant bug) | Davi Gomes |
| KAN-55 | DELETE /api/usuario (LGPD) | Luan |
| KAN-60 | Mobile sync endpoints (Carga and Descarga) | Davi Gomes |
| KAN-64 | `ConvertEnumsToString` migration (DEC-08) | Diego |
| KAN-65 | Convert Uuid from string to native Guid (DEC-09) | Davi Gomes |
| KAN-66 | Align EF Core versions between Api and Tests at 8.0.11 (DEC-13) | Diego |
| KAN-67 | Standardize exceptions in the Services (NotFoundException + typed 404) | Davi Gomes |
| KAN-68 | Automatic UpdatedAt via SaveChangesAsync override (ChangeTracker) | Davi Gomes |
| KAN-61 | Validate Cliente CRUD for Mobile | Davi Gomes |

> *KAN-23: stock control now **integrated into the sales flow** through DEC-11 — fix committed on 17/06/2026. Cascading soft delete of items and stock return when deleting an atendimento were also implemented (commit `1b8b433`), as well as wrapping the sync Descarga in a DB transaction (commit `35c0587`).

### 🔴 Pending — Backend Core

| KAN | Description | Priority | Owner | Depends on |
|-----|-----------|------------|-------------|------------|
| — | ~~Pagination in GetAllAsync~~ ✅ PR #98 (optional pagination, DEC-42), resumed and merged on 28/10/2026 | Low | Davi Gomes | — |

> Backend Core is essentially complete: on 11/11/2026, green build and 346 xUnit tests passing on .NET 10 (DEC-40). `TryGetEmpresaId` and `TryGetUsuarioId` are in `ApiControllerBase`; CPF, multi-tenant and sync have automated coverage. The API runs against Supabase's PostgreSQL in production (DEC-32); the automated tests do not yet run against a real PostgreSQL (KAN-14/KAN-41).

---

## Service Provider domain (KAN-69)

> Epic that gathers the refinements of the product pivot (DEC-15 to DEC-19, DEC-22, DEC-23): Orçamento, Agenda/Rota and the generic atendimento item. The batch is published on the `develop` and `main` lines of `Agesto-Platform/Agesto`.

### ✅ Done

| KAN | Description | Owner | Commit |
|-----|-----------|-------------|--------|
| KAN-72 | Generic atendimento item: nullable `ItemProduto.ProdutoId` + `Descricao` + `Custo` (DEC-18/DEC-19); `ItemServico.ServicoId` remains mandatory — a service outside the catalog is a quick registration, not an ephemeral line (DEC-22); item value (`PrecoUnitario`) typed/editable on both, with the catalog as suggestion/default (DEC-23); stock deduction only when there is a `ProdutoId` | Davi Gomes | `61a9c29` |
| KAN-73 | Margin per atendimento: `ItemProduto.Custo` feeds `Atendimento.CustoTotal`, exposed as `Margem = ValorTotal − CustoTotal` in `AtendimentoResponse` (DEC-19) | Davi Gomes | `61a9c29`, `2b0d253` |
| — | Orçamento as an entity separate from Atendimento (DEC-16): `Orcamento` + `ItemOrcamento` entity, CRUD and transactional conversion `POST /api/orcamento/{id}/converter` (only converts if `Aprovado`; stock deduction only at conversion) | Davi Gomes | `fffaba0` |
| — | `Cliente.Endereco` (DEC-17, part 1): fields `Logradouro`, `Numero`, `Bairro`, `Cidade`, `Cep` | Davi Gomes | `da828bc` |
| — | Scheduling (DEC-17, part 2): `Atendimento.DataAgendada` + `GET /api/atendimento/agenda` filtered by profile (Agente only their own; Dono all/filters) through the new `TryGetPerfil` helper in `ApiControllerBase` | Davi Gomes | `7007361` |

### 🟡 "Prototype insights" batch — done

> Batch of improvements inspired by the approved mobile prototype, delivered after the main KAN-69 batch, commit `5e82411`.

| Item | Description | Commit |
|------|-----------|--------|
| Enriched schedule | `GET /api/atendimento/agenda` now returns `AgendaItemResponse` (client name/phone/address + service summary), removing the N+1 on mobile | `5e82411` |
| Aggregated profitability | New `GET /api/metrics/rentabilidade` + `Rentabilidade` block in `DashboardResponse` (revenue, cost, margin, margin %, average ticket, number of atendimentos — only `Concluido` in the period). Feeds the KPIs of the owner's Web panel | `5e82411` |
| Quotes in the sync Carga | `SyncCargaResponse.Orcamentos` — the agent sees proposals offline | `5e82411` |

### 🔴 Remaining provider items

| Item | Description | Priority | Owner | Depends on |
|------|-----------|------------|-------------|------------|
| Margin/hour per service | The remaining part of KAN-79 — service duration and revenue per hour already exist (DEC-45, 11/11); assigning cost to the service is missing. Owner's decision: in the prototype, "most profitable service" becomes "top-earning services" (revenue per service, already existing) while this is not prioritized | Low | Davi Gomes | Assigning cost to the service (DEC-19/KAN-72) |
| Quote Descarga in sync | Create a quote from offline mobile — flow decision open (whether the agent creates proposals offline). Today the API sends the quotes in the Carga, but the app neither loads them nor has a quote screen (checked on 21/10/2026) | Medium | Davi Gomes | Product decision |
| ~~User management (DEC-35)~~ | 🟢 Usuários tab on the web, email invitation to create the password (DEC-55; before, temporary password), deactivate/reactivate, atendimento's responsible person. In `develop` (PR #47); migration applied on Supabase | High | — | — |
| ~~Service in the app (DEC-36)~~ | 🟢 Agent creates a service offline when recording; the Descarga creates it, reuses by description and returns `ServicosMapeados`; the web shows "a revisar" (to review) and the Dono reviews; switch in Parametrização. In `develop` (PR #47); migration applied on Supabase | High | — | — |
| Routing/geolocation | Phase 1 (DEC-37 and DEC-38) in `develop` (PR #47), migration applied on Supabase: "Iniciar rota" in the app opens Google Maps by address; clients geocoded in the background by OpenRouteService; Mapa tab in the web Agenda (Leaflet + OpenStreetMap). Missing: `Geocoding__OpenRouteServiceApiKey` key on Render and "Otimizar dia" (phase 2); `Servico.DuracaoMinutos` already exists (DEC-45, 11/11) | Medium | Diego (key, before the rehearsal); Davi Gomes (phase 2, after the launch) | OpenRouteService key on Render |
| ~~Apply migrations to the new database~~ | ✅ Single `InitialCreate` (DEC-31) applied to the new Supabase on 08/10/2026 | High | — | — |
| ~~**Schedule in the sync Carga**~~ | Done in code (13/11), branch `feature/app-agenda-e-historico`: the Carga brings the schedule from today up to 14 days ahead (for the Agente, only theirs) and the history of the last 30 days. `syncAgenda` only runs with an old API | Medium | Davi Gomes | — |
| ~~Map the client's uuid→id in the Descarga~~ | 🟢 Resolved in `develop` (DEC-33, PR #43): the atendimento references an offline client by `ClienteUuid`; clients processed first in the same batch; the response returns `ClientesMapeados` | — | — | — |

---

## Infrastructure & DevOps

### ✅ Done

| KAN | Description | Owner |
|-----|-----------|-------------|
| KAN-12 | Git repository + Gitflow | Diego |
| KAN-13 | ASP.NET Core .NET 8 project | Davi Gomes |
| KAN-35 | Endpoint tests | Diego |
| KAN-16 | CI for backend, web and mobile | Agesto team |
| KAN-15 | Providers: API on Render, database on Supabase, web on Cloudflare Pages (DEC-32) | Agesto team |
| KAN-17 | API deploy to production (`agesto-api.onrender.com`) | Agesto team |
| KAN-18 | Deploy process documented in `deploy/README.md` | Agesto team |
| — | Real database and API online; mocks turned off on Web and Mobile | Agesto team |

### 🔴 Pending

| KAN | Description | Priority | Owner |
|-----|-----------|------------|-------------|
| KAN-14 | Development PostgreSQL + migrations — partial: local Postgres via `docker-compose.yml` (DEC-41); running the automated tests against it is missing | High | Diego |
| KAN-54 | Automated QA agents | Low | Diego |
| — | ~~Install dotnet ef globally on the machine~~ ✅ 21/10/2026 — `dotnet-ef` 10.0.13 | Medium | — |
| — | ~~Apply pending migrations to the new PostgreSQL~~ ✅ 08/10/2026 (DEC-31) | High | — |
| — | Automatic database backup (Supabase Free does not do it) — DEC-34; daily `pg_dump` by 31/10 (DEC-49, see MVP launch) | High | Diego |
| — | ~~Migrate to .NET 10 (.NET 8 loses support on 10/11/2026)~~ ✅ DEC-40 | High | — |

---

## Security (DEC-34)

### ✅ Done and validated in production — 10/10/2026

| Item | Detail |
|------|---------|
| Audit of API, front end, database and infra | Findings and fixes recorded in DEC-34 |
| Rate limiting | Login, sign-up (per IP) and sync (per user) |
| Closed sign-up | `Auth__RegistrationKey` + `X-Registration-Key` header; see `deploy/README.md` |
| Dono/Agente profiles on the back end | `Dono` policy on the management routes, with a coverage test |
| Token revocation | JWT revalidated against the database on every request |
| Hardened JWT | Fixed HS256; issuer, audience and secret ≥ 32 bytes mandatory |
| Security headers | API (HSTS, nosniff, frame-ancestors) and Web (CSP via `_headers`) |
| Client LGPD | Masked CPF for the Agente; anonymization on deletion |
| Database | RLS on all tables (blocks `anon`/`authenticated`; the `agesto_api` policy is `USING (true)`, so isolation between companies stays in the API by `EmpresaId`); `agesto_api` role with DML only; TLS `VerifyFull` |
| Mobile | Mocks only in dev; local data deleted on logout and on user switch; no Android backup |
| Web | Panel only for the Dono; cache cleared on logout |

### 🔴 Pending

| Item | Description | Priority | Owner |
|------|-----------|------------|-------------|
| Email verification | Done through the invitation: the email is confirmed when the person creates the password through the link (DEC-55). Open sign-up cancelled (DEC-57) | High | Davi Oliveira |
| ~~Per-account lockout~~ | 🟢 5 wrong passwords in a row lock the account for 15 minutes; creating the password through the email link unlocks it (DEC-55). In `main` since 11/11/2026 (PR #133, release #134, DEC-43) | — | — |
| ~~Usuario deletion with LGPD~~ | 🟢 `DELETE /api/usuario` anonymizes the user with `DeletedAt` instead of deleting the row (fixes the 500 error for users with history). In `main` since 11/11/2026 (PR #133, release #134, DEC-44) | — | — |

---

## AI/Insights Module (Python) — ⚫ OBSOLETE

> **DISCARDED on 20/07/2026 (DEC-21 resolved).** Owner's decision (solo dev, Davi): the AI layer runs inside the C# backend, using the official Anthropic SDK, and NOT in a separate Python/FastAPI service. Reason: removes an extra codebase for a solo dev. The rows below stay only as history; no item of this epic will be done in this form.

### ✅ Done (history)

| KAN | Description | Owner |
|-----|-----------|-------------|
| KAN-31 | Base FastAPI project | Davi Bueno |

### 🔴 Pending (history — will no longer be done in Python)

| KAN | Description | Priority | Owner | Note |
|-----|-----------|------------|-------------|------------|
| KAN-32 | Sales analysis endpoint | Medium | Davi Bueno | Obsolete — redo in C#, if needed |
| KAN-33 | Stock suggestions endpoint | Medium | Davi Bueno | Obsolete — redo in C#, if needed |
| KAN-34 | Integration with the AI model | High | Davi Bueno | Obsolete — integration is now through the Anthropic SDK directly in the C# backend |
| KAN-36 | Deploy on Azure | Low | Davi Bueno | Obsolete — no separate Python service to deploy |
| — | Integrate the C# backend's JWT in the Python module | High | Davi Bueno | Obsolete — there is no longer a separate Python module |
| — | Move the Python module into the repository | High | Davi Bueno | Obsolete — there is no longer a separate Python module |

---

## Metrics & Dashboards (KAN-77)

> Phase 1 of the deterministic metrics layer (DEC-20), which feeds both the dashboards and the future AI interpretation. Implemented in the C# backend, commit `87f54e6`, green build and 51 xUnit tests passing. Later complemented by the profitability block (commit `5e82411`, see KAN-69).

### ✅ Done

| KAN | Description | Owner |
|-----|-----------|-------------|
| KAN-78 | Sales Metrics (`GET /api/metrics/vendas`) — best-selling product (quantity/revenue), average ticket, revenue per period | Davi Gomes |
| KAN-80 | Stock Metrics (`GET /api/metrics/estoque`) — turnover, products idle >30 days, imminent stockout ≤7 days | Davi Gomes |
| KAN-81 | Dashboard aggregator endpoint (`GET /api/metrics/dashboard`) | Davi Gomes |
| — | Aggregated profitability (`GET /api/metrics/rentabilidade` + `Rentabilidade` block in `DashboardResponse`) — revenue, cost, margin, margin %, average ticket, number of atendimentos completed in the period | Davi Gomes (commit `5e82411`) |

### 🟡 Partial

| KAN | Description | Owner | Note |
|-----|-----------|-------------|------------|
| KAN-79 | Service Metrics (`GET /api/metrics/servicos`) | Davi Gomes | Revenue per service type, margin per atendimento (through profitability) and, since 11/11, hours and revenue per hour per service (DEC-45) already delivered. Margin/hour and average time per service are still pending — they depend on assigning cost to the service. |

> Multi-tenant applied through `EmpresaId` + `DeletedAt == null` in every query (joining through `Atendimento`, since `ItemProduto`/`ItemServico` have no `EmpresaId` of their own). Revenue counts only `Concluido` atendimentos; stock movement counts items of non-`Cancelado` atendimentos. The Sales block sums `ItemProduto.Subtotal`; the Services block sums `ItemServico.Subtotal` — never the atendimento's `ValorTotal`, so revenue is not duplicated between the blocks (makes the DEC-15 sales/service split concrete). The @revisor review fixed, before the commit, a bug where the joins with `Produtos`/`Servicos` did not filter `DeletedAt == null` (soft-deleted products/services would enter the sums) — covered by the `GetVendas_IgnoraProdutoSoftDeletado` test.

---

## Documentation & QA

### ✅ Done

| KAN | Description | Owner |
|-----|-----------|-------------|
| KAN-38 | Class Diagram | Richard |

### 🔴 Pending

| KAN | Description | Priority | Owner |
|-----|-----------|------------|-------------|
| KAN-39 | API documentation (Swagger/OpenAPI) — partial: Swashbuckle configured, UI only in Development; no published documentation | Low | Davi Oliveira (after the launch) |
| KAN-40 | ~~Deploy documentation~~ ✅ `deploy/README.md` (see KAN-18) | Low | — |
| KAN-41 | End-to-end integration tests — dress rehearsal script by 03/11 | High | Davi Oliveira |
| KAN-42 | User manual — short version by 08/12 | Medium | Davi Oliveira |
| KAN-43 | ~~Update README~~ ✅ 21/10/2026 (PR #56) | Medium | — |
| — | Architecture Diagram (components) | Low | Davi Gomes (after the launch) |
| — | Sequence Diagram (Hybrid Atendimento) | Low | Davi Gomes (after the launch) |

---

## Web Frontend (React) — Dono Module

**Stack:** Vite + React 19 + TypeScript · Tailwind v4 (prototype tokens) · React Router · TanStack Query · MSW (mocks only for local development) · Recharts · Leaflet (schedule map). Lives in `web/` in the monorepo (`Agesto-Platform/Agesto`). Run: `cd web && npm install && npm run dev` (mocks on through `.env`: `VITE_USE_MOCKS=true`). Demo login (mock): `dono@agesto.app` / `agesto123`. Stack and architecture decisions recorded in DEC-25 (`DECISIONS.md`) and in section 10 of `DESIGN.md`.

### ✅ Done — initial navigable slice (integrated into `main`)

Local tracking (Jira offline); `web-0x` numbering mapped to the existing KANs.

| Task | KAN | Description | Commit |
|------|-----|-----------|--------|
| web-01 | KAN-45 | Scaffold (Vite+React+TS, Tailwind v4 + prototype tokens) | `ba21b1c` |
| web-02 | KAN-46 | App shell (sidebar, topbar, routing, base design system) | `65255bc` |
| web-03 | KAN-52 | Typed API client + React Query + MSW mock layer | `3d1ae35` |
| web-04 | KAN-47 | JWT authentication (login, protected route, logout) | `68abfd1` |
| web-05 | KAN-48 | "Visão geral" (overview) dashboard (KPIs, chart, rankings, alerts, table) | `46a3820` |
| web-06 | — | CRUD foundation (Drawer, DataTable, ConfirmDialog, fields, Toast, resource, stateful MSW) + **Clientes** | `00af71d` |
| web-07 | KAN-50 | **Produtos** CRUD | `923a24f` |
| web-08 | KAN-51 | **Serviços** CRUD (TipoCobranca toggle) | `a52ab55` |
| web-09 | — | **Agenda** — timeline grouped by day (enriched endpoint) | `bdf4c79` |
| web-10 | KAN-16* | **Orçamentos** — item editor, status, conversion into atendimento | `ae2f969` |
| web-11 | — | **Atendimentos** — items/stock/margin + honest dashboard | `6c0e700` |
| web-12 | KAN-49 | **Parametrização** — operation mode (TipoOperacao) | `d922b61` |
| web-13 | — | **Relatórios** — Rentabilidade/Serviços/Produtos/Estoque tabs | `4576e25` |
| web-14 | KAN-53 | **Tests** — Vitest + Testing Library; suite expanded later; 80 tests on 11/11/2026 | `cee7fb9` + later changes |

> \*Operação epic: KAN numbering to be assigned in Jira when it reconnects.

**Sidebar 100% functional — no route is a placeholder anymore.** Git flow: `feature/*` → `develop` → `main` (milestones).

### 🔴 Pending

| KAN | Description | Priority | Owner |
|-----|-----------|------------|-------------|
| — | Expand test coverage (only the base was covered) | Low | Davi Oliveira |
| — | Lazy-load Recharts (bundle ~640kB) | Low | Davi Oliveira |
| — | ~~Swap mocks for the real API (`VITE_USE_MOCKS=false`)~~ ✅ in production against the real API (DEC-32) | High | — |
| — | ~~Redesign of the Dono panel~~ ✅ PRs #80 to #95 (DEC-51) | High | Diego |

### ✅ Backend deltas resolved / pending

- **Latest atendimentos** (dashboard): resolved — the Dashboard asks only for the last 6 (`GET /api/atendimento?pagina=1&tamanho=6&ordem=registro`), already with the client name (PAG-01).
- **Client name** in Orçamento/Atendimento: resolved in the backend (PAG-01) — the responses bring `clienteNome`; the web no longer joins with the client list.

> The improvised front end from the presentation was **discarded**. This is the new front end, with the approved original design (prototype `web-dono.html`), consuming the real API in production (MSW stays for local development). **Dono Module (web) essentially complete:** dashboard, auth, Cadastros (Clientes/Produtos/Serviços), Operação (Agenda/Orçamentos/Atendimentos) and Análise (Relatórios/Parametrização).

---

## Mobile (React Native) — Agent App

**Status:** 🟢 Complete (mob-01 to mob-07, with the changes from DEC-33, DEC-36, DEC-37 and DEC-39) — against the real API, in the `Agesto-Platform/Agesto` monorepo, in `mobile/`. Offline-first, action-first. Stack and architecture decisions recorded in DEC-26 (`DECISIONS.md`) and in section 11 of `DESIGN.md`.

**Stack:** React Native + TypeScript via Expo (prebuild) · Expo Router · prototype tokens (blue `#243FA6` + green `#12B886`, light theme) · theme + StyleSheet (not NativeWind) · `expo-sqlite` (device) / in-memory adapter (Web/tests) behind the `LocalDb` interface · API client with an in-code mock layer (`config.useMocks`) · JWT via `expo-secure-store`/`localStorage`. Demo login (mock): `agente@agesto.app` / `agesto123`.

### ✅ Done — integrated into `main`

Local tracking (Jira offline); `mob-0x` numbering.

| Task | Description | Note |
|------|-----------|------------|
| mob-01 | Expo (prebuild) + RN + TypeScript + Expo Router scaffold; prototype tokens; tab bar (Início/Agenda/Atend./Clientes/Mais); styling via theme + StyleSheet | — |
| mob-02 | Offline data layer: `LocalDb` interface (`src/db/types.ts`) with two adapters — `expo-sqlite` (`index.native.ts`, device) and memory (`index.ts`, web/tests); stores reference data + offline entities with `SyncedAt` | — |
| mob-03 | API client (envelope + 401) with an in-code mock layer (`config.useMocks`); JWT login with the token via `expo-secure-store`/`localStorage`; route guard; the Carga fills the database | — |
| mob-04 | Action-first Home (Registrar CTA + the day's schedule Próximo/Ainda hoje) | Backend delta: the Carga does not include the schedule — worked around with a `syncAgenda` step (cached `GET /api/atendimento/agenda`). See open items below |
| mob-05 | Record atendimento (core): client + catalog items by quantity (lean contract) + status → saved offline (pending) | — |
| mob-06 | Clientes: reference list + pending; quick offline registration (`PendingCliente`) | Delta/limitation: an offline atendimento does not reference a client created offline (no server id). See open items below |
| mob-07 | Descarga: pushes pending clients/atendimentos → marks as synced; "Mais" tab with sync status (pending, last sync, Sincronizar button) + logout | — |
| — | Self-review (`revisor-frontend` agent, created in `micro-erp-auto/.claude/agents/` for future sessions): fixed auth invalidation on a 401 from the real API (`src/lib/session.ts`) and an unmount guard | — |

**Offline cycle verified at the last milestone:** login → Carga + syncAgenda → record atendimento offline → Descarga → synced. The suite grew to 119 Jest tests (11/11/2026); typecheck and lint green. Validation on a physical Android/iOS device is still pending.

### 🔴 Backend items raised by Mobile

| Item | Description | Priority | Owner |
|------|-----------|------------|-------------|
| ~~Schedule in the sync Carga~~ | Done in code (13/11), branch `feature/app-agenda-e-historico`. The Início screen now shows only today (before, it showed the whole stored schedule) | Medium | — |
| ~~Map the client's uuid→id in the Descarga~~ | 🟢 Resolved in `develop` (DEC-33, PR #43) | — | — |

### 🔴 Mobile's own open items

| Item | Description | Priority | Owner |
|------|-----------|------------|-------------|
| ~~APK and OTA update~~ | ✅ `eas.json`, package `br.com.agesto.app`, `expo-updates` and version warning in `develop` (DEC-47, PR #108). The first `eas build` is missing (Diego, see MVP launch) | High | — |
| ~~History of one's own atendimentos~~ | Done (PR #180, 13/11): the Atend. tab joins what is on the device with the server's atendimentos of the last 30 days, without repeating | Low | — |
| Routing/geolocation | Phase 1 delivered (DEC-37): "Iniciar rota" opens Google Maps by address. "Otimizar dia" is missing (phase 2, after the launch) | Low | Davi Gomes |
| RN component test | The base works: `@testing-library/react-native` v14 already runs on `develop` (`esqueciSenha.test.tsx` renders the screen; `AuthProvider.test.tsx` uses `renderHook`). Expanding it to the other screens is missing; the `feature/tasks-davi-gomes` branch has more component tests, without a PR | Low | Davi Gomes |
| ~~Swap mocks for the real API~~ | ✅ in production against the real API (DEC-32); mocks only in dev | High | — |
| ~~Automatic sync~~ | ✅ in `develop` (I5, PR #113): syncs when the app opens, when the user returns to it and when the internet comes back, never with a registration screen open | Medium | — |
| App redesign | Same look as the web, after the launch (DEC-46) | Low | Diego |

---

## Future plans — ideas from 13/11/2026

> Davi Oliveira's ideas, evaluated against the code on 13/11/2026. They are **future plans, with no deadline and out of the launch scope**: none becomes a requirement before Davi decides when and how. Effort: S = small, M = medium, L = large.

| Idea | What it involves | Effort | Depends on / watch out |
|---|---|---|---|
| Pix at the end of the atendimento | Static Pix QR Code with the Dono's key (key, name and city in Parametrização); "copia e cola" (copy and paste) code generated in the browser; QR in the atendimento detail and in the PDF. Completes the atendimento billing (PR #188) | S | Static Pix does not confirm the payment: the Dono still marks "Pago". In the app, the QR needs a native module (new `eas build`) |
| Service warranty | Default period on the service; "na garantia até…" (under warranty until…) recorded when completing the atendimento and shown in the client's history | S | New field in the app's sync too |
| Recurring maintenance reminder | "Repetir a cada X meses" (repeat every X months) on the service; "Manutenções a vencer" (maintenance due) list in the Dono panel, with the WhatsApp message ready through `wa.me` (DEC-56) | S to M | Does not need the WhatsApp API: the Dono clicks to send |
| Quote acceptance by link | Public page, no login, with a random code in the link; "Aprovar" (approve) changes the quote to `Aprovado`, generates the atendimento (`ConverterAsync`) and notifies the Dono. Reuses the quote PDF (DEC-56) | M | First public route that changes data: expiring code, attempt limit and minimal client data on the page. Without an own domain, the link comes out as `agesto.pages.dev` |
| Daily summary for the Dono | Morning routine with the day's numbers (atendimentos, amount, stalled quotes), built by query, without spending AI | S by email (Brevo, DEC-54); M to L through WhatsApp | Through WhatsApp it cannot be done with `wa.me`: it needs Meta's official API (company verification, approved message template and per-message cost), already postponed in DEC-56 |
| Productivity and commission per technician | Group revenue, margin and hours per technician (`UsuarioId`) and a month-closing screen. Today revenue per hour is per service, in `MetricasRepository` | M | Hours are estimated from the service duration, not timed. The commission rule (% of the amount, the margin or the labor) depends on Davi |
| Rating after the service | Short link with a 1 to 5 score, stored in Agesto, and a link to the Google review | S to M | Google's policy forbids asking for reviews only from those who gave a high score: offer the Google link to everyone and use the internal score only for the Dono to follow |
| Proof of service | Before and after photos and the client's signature in the app, even offline; photo upload queue separate from the current sync; Supabase Storage with a private bucket and upload authorized by the API; PDF in the app sent through WhatsApp | L | Depends on the first `eas build` (camera, files, signature and PDF are native modules), on Supabase Pro (Free has little space and traffic for photos) and on the revised privacy policy (photos and signature are personal data) |

Suggested order, if Davi approves: Pix and warranty; maintenance reminder; quote acceptance by link; daily summary by email; productivity per technician; rating; proof with photos and signature last.

---

## Recommended execution order (next sprints)

> The MVP has backend, Web and Mobile published in `Agesto-Platform/Agesto` and running against the real API (Render + Supabase, DEC-32), with mocks turned off. Organization, `Core` team, CI, main line and ruleset are already configured.

### By 15/12/2026
1. **MVP launch** section above, in deadline order: first the pilot gate (by 03/11), then the pilot improvements and what the launch requires.

### After the launch
2. `REQUIREMENTS.md` audit and removal of the legacy documentation (Davi Gomes)
3. Remaining debt: KAN-79 margin/hour, "Otimizar dia" (route phase 2, DEC-37/38), quote Descarga in sync (Davi Gomes); Recharts lazy-load, web tests and API documentation (Davi Oliveira); app redesign and tests against a real PostgreSQL in CI (Diego)
4. Future plans from 13/11/2026 (section above), when Davi decides which ones go in and in what order

---

## Commit conventions

```
feat(scope): short description (KAN-XX)
fix(scope): short description (KAN-XX)
docs(scope): short description
chore(scope): short description
test(scope): short description
refactor(scope): short description
```

Real examples from the project:
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
