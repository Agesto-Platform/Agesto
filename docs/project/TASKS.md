# Agesto — Tasks e Roadmap

> Espelho simplificado do Jira (projeto KAN). Para status detalhado, acessar o board em `gomesdavi731.atlassian.net`.
> Atualizar este arquivo sempre que uma task mudar de status ou uma nova decisão impactar o roadmap.
> **Nota:** este arquivo está em reconciliação com código e Git. O Jira deve ser sincronizado somente depois dessa auditoria.

## Transição para trabalho em equipe — 18/08/2026

| Item | Estado |
|---|---|
| Centralizar documentação em `docs/project/` | 🟢 Concluído |
| Definir integrantes, papéis e focos iniciais | 🟢 Concluído — revisto em 22/10/2026: Davi Gomes (mobile e geral), Davi Oliveira/`ghzpro034` (web e geral), Diego/`Depowo` (infra e redesign) |
| Criar organização GitHub e transferir para `Agesto-Platform/Agesto` | 🟢 Concluído |
| Configurar time `Core`, acessos mínimos e segundo Owner | 🟢 Concluído — Davi e Depowo são Owners |
| Proteger `develop` e `main` com PR, revisão e status checks | 🟢 Concluído — ruleset exige PR e os checks Backend, Web e Mobile; sem aprovação obrigatória (decisão de 10/10/2026) |
| Adicionar CI para backend, web e mobile | 🟢 Concluído — validado na promoção de governança |
| Auditar `REQUIREMENTS.md` reconstruído | 🟡 Em andamento — Davi Gomes, depois do lançamento |
| Publicar a linha local consolidada em `main` | 🟢 Concluído — merge `72b021b` |

---

## Lançamento do MVP (até 15/12/2026) — DEC-46

> Prioridade da equipe. Ensaio geral em 03/11, piloto de 04/11 a 28/11, revisão em 01/12 e lançamento em 15/12. Cada tarefa tem um responsável; quando outra pessoa participa, ela aparece entre parênteses. Ao terminar uma tarefa, troque o status aqui e no documento "Agesto: plano de lançamento do MVP" (aba "Tarefas por pessoa"). Origem: B = bloqueador do piloto, I = melhoria do piloto, L = lançamento, D = decisão do plano.

### Davi Gomes — mobile e geral

| Prazo | Tarefa | Origem | Status |
|-------|--------|--------|--------|
| 24/10 | Escolher o cliente piloto e confirmar que os agentes usam Android | D1 | A fazer |
| 24/10 | CPF com dígito verificador no app e cliente ainda não enviado editável (hoje o app só confere o formato) | B5 | A fazer |
| 27/10 | APK: `mobile/eas.json`, `android.package` = `br.com.agesto.app`, `expo-updates` e aviso de versão nova (DEC-47; ícone vem do Diego) | B1 | A fazer |
| 31/10 | Sessão de 30 dias na API e no app, com revogação ao desativar (DEC-50) | B4, D7 | A fazer |
| 31/10 | Texto dos termos de uso e da política de privacidade, com revisão jurídica | B6, D8 | A fazer |
| 31/10 | Tela de aceite dos termos no app | B6 | A fazer |
| 31/10 | Acordo do piloto por escrito: período grátis ou com desconto, uso dos dados | D9 | A fazer |
| 04/11 | Conta do Dono piloto, catálogo, clientes, agentes e treino presencial | Piloto | A fazer |
| 10/11 | Página de download do APK com passo a passo de instalação | L3 | A fazer |
| 14/11 | Busca no app, motivo da recusa e cancelar atendimento no app | I1 a I3 | A fazer |
| 28/11 | Sincronizar ao abrir o app e quando a internet volta | I5 | A fazer |
| 28/11 | Retomar ou descartar o lote de outubro (PRs #98 a #102: paginação, bloqueio da conta, exclusão de usuário com anonimização e duração do serviço) | DEC-42 a 45 | Parado |
| 01/12 | Revisão do piloto e preço da assinatura (todos participam) | D10 | A fazer |
| 12/12 | CNPJ e nota da assinatura; formalizar a propriedade das contribuições (DEC-29) e decidir se o repositório segue público (DEC-24) | Legal | A fazer |

### Davi Oliveira — web e geral

| Prazo | Tarefa | Origem | Status |
|-------|--------|--------|--------|
| 24/10 | CPF com dígito verificador no web | B5 | A fazer |
| 31/10 | Tela de aceite dos termos no web | B6 | A fazer |
| 03/11 | Testes integrados com web, app, API e PostgreSQL reais, como roteiro do ensaio geral (KAN-41) | Portão | A fazer |
| 14/11 | "Esqueci a senha" do Dono por email (API e web) | I4 | A fazer |
| 17/11 | Desenhar o fluxo do cadastro aberto: tela, email de verificação e período de teste (DEC-48) | D11 | A fazer |
| 28/11 | Cadastro aberto no ar com verificação de email e período de teste | L1 | A fazer |
| 01/12 | Canal de suporte: WhatsApp Business e email | D14 | A fazer |
| 08/12 | Cobrança mínima no web: atendimento pago ou em aberto, forma e data do pagamento | L5 | A fazer |
| 08/12 | Manual do usuário curto para o Dono e o agente (KAN-42) | L4 | A fazer |
| 12/12 | Controle de assinatura: quem pagou e quem está em atraso | L5 | A fazer |
| 12/12 | Página de apresentação com preço, termos, download e contato | L4 | A fazer |

### Diego — infra e redesign

| Prazo | Tarefa | Origem | Status |
|-------|--------|--------|--------|
| 24/10 | Render Starter, para a API não dormir (DEC-49) | B2, D2 | A fazer |
| 24/10 | Organização `agesto` no expo.dev, com os dois Davis | D3 | A fazer |
| 24/10 | Monitor do `/health` com alerta e chave `Geocoding__OpenRouteServiceApiKey` no Render | B7, B9 | A fazer |
| 24/10 | Acesso de push e merge para os Davis, ou o app do Claude no GitHub da organização | Operação | A fazer |
| 27/10 | Ícone, ícone adaptativo e splash do Agesto para o APK | B1 | A fazer |
| 31/10 | Backup diário com `pg_dump` (GitHub Actions) e um teste de restauração (DEC-49) | B3 | A fazer |
| 31/10 | Primeiro `eas build` e promoção `develop → main` antes do ensaio | B1, B8 | A fazer |
| 03/11 | Ensaio geral com os dois Davis | Portão | A fazer |
| 10/11 | Domínio próprio na web e na API, com CORS e CSP ajustados | L2, D12 | A fazer |
| 10/11 | Conta no provedor de email por API e chave no Render | I4, L1 | A fazer |
| 17/11 | Fechar o design system | D13 | A fazer |
| 05/12 | Cópia da chave de assinatura do APK guardada fora do repositório e do Expo | B1 | A fazer |
| 12/12 | Redesign do web (DEC-51): em `main` desde 25/10; falta o acabamento final | L6 | Em andamento |
| 12/12 | Supabase Pro antes do lançamento (DEC-49) | L2 | A fazer |
| 12/12 | APK de produção no link de download e última promoção para a `main` | L3 | A fazer |

---

## Status dos Épicos

| Épico | Descrição | Status |
|-------|-----------|--------|
| KAN-11 | Infraestrutura & DevOps | 🟡 Em andamento |
| KAN-19 | Backend Core (C# / ASP.NET) | 🟢 Essencialmente completo |
| KAN-30 | Módulo IA/Insights (Python) | ⚫ Obsoleto — descartado (DEC-21 resolvida: IA roda em C# no backend) |
| KAN-37 | Documentação & QA | 🟡 Em andamento |
| KAN-44 | Frontend Web (React) — Módulo Dono | 🟢 Completo (web-01 a web-14, sidebar 100% funcional + testes base, ver DEC-25) — em produção contra a API real (DEC-32) |
| KAN-69 | Domínio Prestador de Serviço (Orçamento, Agenda, Item genérico, valor editável) | 🟢 Backend essencialmente completo — migrations aplicadas e rota fase 1 entregue (DEC-37/38); falta descarga de orçamento no sync e "Otimizar dia" (fase 2) |
| KAN-77 | Camada de Métricas & Dashboards | 🟡 Em andamento |
| — | Mobile (React Native) — App do Agente | 🟢 Completo (mob-01 a mob-07, offline-first, ver DEC-26) — em produção contra a API real (DEC-32), atendimento no nível do web (DEC-39) |

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
| — | Paginação no GetAllAsync — PR #98 (paginação opcional, DEC-42) fechado sem merge em 25/10/2026 para retomar depois | Baixa | Davi Gomes | — |

> Backend Core está essencialmente completo: em 21/10/2026, build verde e 261 testes xUnit aprovados no .NET 10 (DEC-40). `TryGetEmpresaId` e `TryGetUsuarioId` estão em `ApiControllerBase`; CPF, multi-tenant e sincronização possuem cobertura automatizada. A API roda contra o PostgreSQL do Supabase em produção (DEC-32); os testes automatizados ainda não rodam contra um PostgreSQL real (KAN-14/KAN-41).

---

## Domínio Prestador de Serviço (KAN-69)

> Épico que reúne os refinamentos do pivô de produto (DEC-15 a DEC-19, DEC-22, DEC-23): Orçamento, Agenda/Rota e item de atendimento genérico. O batch está publicado nas linhas `develop` e `main` de `Agesto-Platform/Agesto`.

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

| Item | Descrição | Prioridade | Responsável | Depende de |
|------|-----------|------------|-------------|------------|
| Margem/hora por serviço | Parte restante do KAN-79 — depende de campo de duração (inexistente) + atribuição de custo a serviço. Decisão do dono: no protótipo, "serviço mais rentável" vira "serviços que mais faturam" (receita por serviço, já existente) enquanto isso não é priorizado | Baixa | Davi Gomes | Campo de duração (PR #101, DEC-45, parado) |
| Descarga de Orçamento no sync | Criar orçamento a partir do mobile offline — decisão de fluxo em aberto (se o agente cria proposta offline). Hoje a API envia os orçamentos na Carga, mas o app não os carrega nem tem tela de orçamento (conferido em 21/10/2026) | Média | Davi Gomes | Decisão de produto |
| ~~Gestão de usuários (DEC-35)~~ | 🟢 Aba Usuários no web, senha provisória com troca no 1º acesso (web e app), desativar/reativar, responsável do atendimento. Em `develop` (PR #47); migration aplicada no Supabase | Alta | — | — |
| ~~Serviço no app (DEC-36)~~ | 🟢 Agente cria serviço offline no registrar; Descarga cria, reaproveita pela descrição e devolve `ServicosMapeados`; web mostra "a revisar" e o Dono revisa; chave em Parametrização. Em `develop` (PR #47); migration aplicada no Supabase | Alta | — | — |
| Roteirização/geolocalização | Fase 1 (DEC-37 e DEC-38) em `develop` (PR #47), migration aplicada no Supabase: "Iniciar rota" no app abre o Google Maps pelo endereço; clientes geocodificados em segundo plano pelo OpenRouteService; aba Mapa na Agenda do web (Leaflet + OpenStreetMap). Falta: chave `Geocoding__OpenRouteServiceApiKey` no Render, `Servico.DuracaoMinutos` e "Otimizar dia" (fase 2) | Média | Diego (chave, antes do ensaio); Davi Gomes (fase 2, depois do lançamento) | Chave do OpenRouteService no Render |
| ~~Aplicar migrations no banco novo~~ | ✅ `InitialCreate` única (DEC-31) aplicada no Supabase novo em 08/10/2026 | Alta | — | — |
| **Agenda na Carga do sync** | A Carga (`GET /api/sync/carga`) não inclui a agenda; o app mobile precisou de um passo `syncAgenda` separado como contorno (delta identificado em mob-04, ver DEC-26). Idealmente a agenda entraria na Carga | Média | Davi Gomes | — |
| ~~Mapear uuid→id do cliente na Descarga~~ | 🟢 Resolvido em `develop` (DEC-33, PR #43): atendimento referencia cliente offline por `ClienteUuid`; clientes processados antes na mesma leva; resposta devolve `ClientesMapeados` | — | — | — |

---

## Infraestrutura & DevOps

### ✅ Concluídas

| KAN | Descrição | Responsável |
|-----|-----------|-------------|
| KAN-12 | Repositório Git + Gitflow | Diego |
| KAN-13 | Projeto ASP.NET Core .NET 8 | Davi Gomes |
| KAN-35 | Testes de endpoints | Diego |
| KAN-16 | CI para backend, web e mobile | Equipe Agesto |
| KAN-15 | Provedores: API no Render, banco no Supabase, web na Cloudflare Pages (DEC-32) | Equipe Agesto |
| KAN-17 | Deploy da API em produção (`agesto-api.onrender.com`) | Equipe Agesto |
| KAN-18 | Processo de deploy documentado em `deploy/README.md` | Equipe Agesto |
| — | Banco e API reais no ar; mocks desligados no Web e no Mobile | Equipe Agesto |

### 🔴 Pendentes

| KAN | Descrição | Prioridade | Responsável |
|-----|-----------|------------|-------------|
| KAN-14 | PostgreSQL de desenvolvimento + migrations — parcial: Postgres local via `docker-compose.yml` (DEC-41); falta rodar os testes automatizados contra ele | Alta | Diego |
| KAN-54 | Agents de QA automatizados | Baixa | Diego |
| — | ~~Instalar dotnet ef global na máquina~~ ✅ 21/10/2026 — `dotnet-ef` 10.0.13 | Média | — |
| — | ~~Aplicar migrations pendentes no novo PostgreSQL~~ ✅ 08/10/2026 (DEC-31) | Alta | — |
| — | Backup automático do banco (Supabase Free não faz) — DEC-34; `pg_dump` diário até 31/10 (DEC-49, ver Lançamento do MVP) | Alta | Diego |
| — | ~~Migrar para .NET 10 (o .NET 8 perde suporte em 10/11/2026)~~ ✅ DEC-40 | Alta | — |

---

## Segurança (DEC-34)

### ✅ Concluídas e validadas em produção — 10/10/2026

| Item | Detalhe |
|------|---------|
| Auditoria de API, front, banco e infra | Achados e correções registrados na DEC-34 |
| Rate limiting | Login, cadastro (por IP) e sync (por usuário) |
| Cadastro fechado | `Auth__RegistrationKey` + header `X-Registration-Key`; ver `deploy/README.md` |
| Perfis Dono/Agente no back | Policy `Dono` nas rotas de gestão, com teste de cobertura |
| Revogação de token | JWT revalidado no banco a cada requisição |
| JWT endurecido | HS256 fixo; issuer, audience e segredo ≥ 32 bytes obrigatórios |
| Headers de segurança | API (HSTS, nosniff, frame-ancestors) e Web (CSP via `_headers`) |
| LGPD de clientes | CPF mascarado para o Agente; anonimização na exclusão |
| Banco | RLS em todas as tabelas (bloqueia `anon`/`authenticated`; a policy do `agesto_api` é `USING (true)`, então o isolamento entre empresas continua na API por `EmpresaId`); role `agesto_api` só com DML; TLS `VerifyFull` |
| Mobile | Mock só em dev; dados locais apagados no logout e na troca de usuário; sem backup Android |
| Web | Painel só para o Dono; cache limpo no logout |

### 🔴 Pendentes

| Item | Descrição | Prioridade | Responsável |
|------|-----------|------------|-------------|
| Verificação de email | Necessária antes de reabrir o cadastro; depende de provedor HTTP (ex.: Resend) e domínio próprio. Entra com o cadastro aberto até 28/11 (DEC-48) | Alta | Davi Oliveira |
| Lockout por conta | Bloqueio após N falhas no mesmo email (complementa o rate limit por IP). PR #99 (DEC-43) fechado sem merge em 25/10/2026 para retomar depois | Média | Davi Gomes |
| Exclusão de Usuario com LGPD | Desenho em `docs/SECURITY_NOTES.md` §7. Hoje `DELETE /api/usuario` apaga a própria conta com DELETE físico e sem anonimização (`UsuarioRepository`), divergindo do invariante de soft delete do `AGENTS.md`. PR #100 (DEC-44: soft delete com anonimização) fechado sem merge em 25/10/2026 para retomar depois; a política de privacidade do lançamento depende disso | Média | Davi Gomes |

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
| KAN-39 | Documentação de API (Swagger/OpenAPI) — parcial: Swashbuckle configurado, UI só em Development; sem documentação publicada | Baixa | Davi Oliveira (depois do lançamento) |
| KAN-40 | ~~Documentação de deploy~~ ✅ `deploy/README.md` (ver KAN-18) | Baixa | — |
| KAN-41 | Testes de integração ponta-a-ponta — roteiro do ensaio geral até 03/11 | Alta | Davi Oliveira |
| KAN-42 | Manual do usuário — versão curta até 08/12 | Média | Davi Oliveira |
| KAN-43 | ~~Atualizar README~~ ✅ 21/10/2026 (PR #56) | Média | — |
| — | Diagrama de Arquitetura (componentes) | Baixa | Davi Gomes (depois do lançamento) |
| — | Diagrama de Sequência (Atendimento Híbrido) | Baixa | Davi Gomes (depois do lançamento) |

---

## Frontend Web (React) — Módulo Dono

**Stack:** Vite + React 19 + TypeScript · Tailwind v4 (tokens do protótipo) · React Router · TanStack Query · MSW (mock só para desenvolvimento local) · Recharts · Leaflet (mapa da agenda). Vive em `web/` no monorepo (`Agesto-Platform/Agesto`). Rodar: `cd web && npm install && npm run dev` (mock ligado via `.env`: `VITE_USE_MOCKS=true`). Login demo (mock): `dono@agesto.app` / `agesto123`. Decisões de stack e arquitetura registradas em DEC-25 (`DECISIONS.md`) e na seção 10 do `DESIGN.md`.

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
| web-14 | KAN-53 | **Testes** — Vitest + Testing Library; suíte ampliada posteriormente; 33 testes em 21/10/2026 | `cee7fb9` + evoluções posteriores |

> \*Épico Operação: numeração KAN a atribuir no Jira quando reconectar.

**Sidebar 100% funcional — nenhuma rota é mais placeholder.** Fluxo git: `feature/*` → `develop` → `main` (marcos).

### 🔴 Pendentes

| KAN | Descrição | Prioridade | Responsável |
|-----|-----------|------------|-------------|
| — | Ampliar cobertura de testes (só a base foi coberta) | Baixa | Davi Oliveira |
| — | Lazy-load do Recharts (bundle ~640kB) | Baixa | Davi Oliveira |
| — | ~~Trocar mocks pela API real (`VITE_USE_MOCKS=false`)~~ ✅ em produção contra a API real (DEC-32) | Alta | — |
| — | ~~Redesign do painel do Dono~~ ✅ PRs #80 a #95 (DEC-51) | Alta | Diego |

### ✅ Deltas de backend resolvidos / pendentes

- **Últimos atendimentos** (dashboard): resolvido no front — `GET /api/atendimento` (real `AtendimentoResponse`) + join do nome do cliente no cliente. Não precisa mais do formato fictício.
- **Nome do cliente** em Orçamento/Atendimento: a API devolve só `clienteId`; o front junta com a lista de clientes. Se virar gargalo, expor `clienteNome` no backend.

> O frontend improvisado da apresentação foi **descartado**. Este é o front novo, com design original aprovado (protótipo `web-dono.html`), consumindo a API real em produção (o MSW fica para desenvolvimento local). **Módulo Dono (web) essencialmente completo:** dashboard, auth, Cadastros (Clientes/Produtos/Serviços), Operação (Agenda/Orçamentos/Atendimentos) e Análise (Relatórios/Parametrização).

---

## Mobile (React Native) — App do Agente

**Status:** 🟢 Completo (mob-01 a mob-07, com evoluções das DEC-33, DEC-36, DEC-37 e DEC-39) — contra a API real, no monorepo `Agesto-Platform/Agesto`, em `mobile/`. Offline-first, action-first. Decisões de stack e arquitetura registradas em DEC-26 (`DECISIONS.md`) e na seção 11 do `DESIGN.md`.

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

**Ciclo offline verificado no último marco:** login → Carga + syncAgenda → registrar atendimento offline → Descarga → sincronizado. A suíte cresceu para 77 testes Jest (21/10/2026); typecheck e lint verdes. A validação em dispositivo Android/iOS físico continua pendente.

### 🔴 Pendências de backend geradas pelo Mobile

| Item | Descrição | Prioridade | Responsável |
|------|-----------|------------|-------------|
| Agenda na Carga do sync | Ver seção "Domínio Prestador de Serviço" acima — a Carga deveria idealmente incluir a agenda, eliminando o contorno `syncAgenda` | Média | Davi Gomes |
| ~~Mapear uuid→id do cliente na Descarga~~ | 🟢 Resolvido em `develop` (DEC-33, PR #43) | — | — |

### 🔴 Pendências do próprio Mobile

| Item | Descrição | Prioridade | Responsável |
|------|-----------|------------|-------------|
| APK e atualização OTA | `eas.json`, pacote `br.com.agesto.app`, `expo-updates` e aviso de versão (DEC-47). Ver Lançamento do MVP | Alta | Davi Gomes |
| Histórico de atendimentos próprios | Não implementado nesta fase (fora do escopo mob-01 a mob-07) | Baixa | Davi Gomes |
| Roteirização/geolocalização | Fase 1 entregue (DEC-37): "Iniciar rota" abre o Google Maps pelo endereço. Falta "Otimizar dia" (fase 2, depois do lançamento) | Baixa | Davi Gomes |
| Teste de componente RN | Adiado por incompatibilidade de versão (`@testing-library/react-native` v14 + jest-expo + React 19) | Baixa | Davi Gomes |
| ~~Trocar mock pela API real~~ | ✅ em produção contra a API real (DEC-32); mock só em dev | Alta | — |
| Sincronização automática | Hoje só manual (aba "Mais") e puxar para atualizar. Sincronizar ao abrir e quando a internet volta entra no piloto até 28/11 (I5) | Média | Davi Gomes |
| Redesign do app | Mesmo visual do web, depois do lançamento (DEC-46) | Baixa | Diego |

---

## Ordem de execução recomendada (próximas sprints)

> O MVP possui backend, Web e Mobile publicados em `Agesto-Platform/Agesto` e rodando contra a API real (Render + Supabase, DEC-32), com mocks desligados. Organização, time `Core`, CI, linha principal e ruleset já estão configurados.

### Até 15/12/2026
1. Seção **Lançamento do MVP** acima, na ordem dos prazos: primeiro o portão do piloto (até 03/11), depois as melhorias do piloto e o que o lançamento exige.

### Depois do lançamento
2. Auditoria de `REQUIREMENTS.md` e remoção da documentação legada (Davi Gomes)
3. Débitos residuais: margem/hora do KAN-79, "Otimizar dia" (fase 2 da rota, DEC-37/38), descarga de Orçamento no sync, agenda na Carga do sync mobile e histórico no app (Davi Gomes); lazy-load do Recharts, testes do web e documentação da API (Davi Oliveira); redesign do app e testes contra PostgreSQL real no CI (Diego)

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
