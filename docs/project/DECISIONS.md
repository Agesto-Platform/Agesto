# Agesto — Decisões Arquiteturais

> Antes chamado "Micro-ERP Auto" (renomeado em 04/08/2026, ver DEC-24).

> Este documento registra decisões importantes tomadas durante o desenvolvimento, o raciocínio por trás de cada uma, e o que foi descartado. O objetivo é evitar que decisões já tomadas sejam reabertas sem contexto.

---

## DEC-01 — Entidade `Empresa` como tenant do sistema

**Status:** Decidido — implementado (commit `c48dbca`)

**Decisão:** O isolamento multi-tenant usa `EmpresaId`, não `UsuarioId`.

**Contexto:** O modelo inicial usava `UsuarioId` como isolamento — cada usuário era um silo independente. Isso conflitava com o requisito de múltiplos agentes por microempreendedor: dois agentes da mesma empresa não conseguiam compartilhar clientes, estoque ou ver o dashboard consolidado.

**Alternativas descartadas:**
- Manter `UsuarioId` como tenant → inviabiliza o modelo de agentes em campo
- Usar `Tenant` como nome → termo técnico em inglês, menos claro para o time brasileiro

**Impacto:** Todas as entidades operacionais (`Cliente`, `Produto`, `Servico`, `Atendimento`, `Configuracao`) filtram por `EmpresaId`. `Atendimento` mantém `UsuarioId` adicionalmente para saber qual agente registrou.

---

## DEC-02 — Registro cria Empresa + Usuario + Configuracao automaticamente (Opção A)

**Status:** Decidido — implementado

**Decisão:** O endpoint `POST /api/auth/register` cria os três recursos automaticamente. O primeiro usuário é sempre `Perfil = Dono`.

**Contexto:** Existiam duas opções:
- **Opção A:** Registro cria tudo automaticamente (simples, sem tela extra)
- **Opção B:** Fluxo separado — primeiro cria Empresa, depois cria Usuários

**Alternativa descartada:**
- Opção B → mais robusto mas complexo demais para o MVP

**Consequência:** O nome da empresa é informado no momento do registro via campo `NomeEmpresa` no `AuthRegisterRequest`. O dono pode editar depois nas configurações.

---

## DEC-03 — Módulo de IA nativo ao produto (não BYOK)

**Status:** Decidido após reunião pós-CP III

**Decisão:** A IA é uma feature nativa do produto. O sistema mantém a chave da API de IA (Anthropic Claude). O cliente não configura nem paga separadamente pela IA.

**Contexto:** Houve conflito de visão entre dois membros do time:
- **BYOK (Bring Your Own Key):** cliente traz o próprio token — adotado inicialmente pelo Tech Lead
- **IA nativa:** sistema controla a chave, IA é parte do produto — proposto pelo Diego

**Alternativa descartada:**
- BYOK → descartado na reunião pós-CP III. Os campos `AiProvider`, `AiApiKey` e `AiEnabled` que foram commitados em `Configuracao` foram removidos no commit `3b5c540`.

**Implicações:**
- O time (como empresa) é o operador LGPD perante o provedor de IA
- Requer controle de custo por empresa (futuro: `TenantUsage`)
- Dados sensíveis devem ser mascarados antes de enviar ao modelo
- Isolamento via `empresaId` obrigatório em todas as queries da IA

---

## DEC-04 — Empreitada ignora Quantidade no cálculo do Subtotal

**Status:** Decidido — implementado (commit `KAN-62`)

**Decisão:** Serviços do tipo `Empreitada` têm `Subtotal = ValorEmpreitada` fixo. `Quantidade` é ignorada no cálculo.

**Contexto:** Discutido se quantidade faria sentido em empreitada (ex: 2 instalações de AC). Conclusão: se o cliente quer múltiplas unidades, o agente adiciona múltiplos `ItemServico` separados — um por serviço. Usar quantidade em empreitada seria gambiarra.

**Exemplo prático:**
```
Técnico instala 2 aparelhos de AC (R$600/máquina):
→ Adiciona ItemServico "Instalação AC" × 1 → Subtotal: R$600
→ Adiciona ItemServico "Instalação AC" × 1 → Subtotal: R$600
→ ValorTotal do Atendimento: R$1.200
```

> **Atualizado pela DEC-23:** o catálogo (`ValorEmpreitada`) passa a ser apenas o valor sugerido/pré-preenchido; o prestador pode ajustar no momento do atendimento. A regra de não multiplicar por `Quantidade` continua sendo o comportamento default.

---

## DEC-05 — PrecoUnitario capturado no momento da venda (snapshot)

**Status:** Decidido — implementado

**Decisão:** `ItemProduto.PrecoUnitario` e `ItemServico.PrecoUnitario` armazenam o preço no momento da venda, não uma referência ao preço atual.

**Motivo:** Protege o histórico financeiro contra reajustes futuros. Se um produto custava R$10 e foi reajustado para R$15, vendas passadas continuam corretas.

**Atenção:** O `UpdateAsync` dos ItemServices **não deve** sobrescrever `PrecoUnitario` com o valor atual do produto/serviço. Apenas `Quantidade` e `Subtotal` são recalculados.

> **Atualizado pela DEC-23:** o snapshot continua valendo — o valor fica congelado no histórico — mas agora ele é **digitado/editável no momento do atendimento**, não apenas herdado do catálogo. O catálogo vira sugestão/default.

---

## DEC-06 — Conflito de Cliente na sincronização: última escrita vence

**Status:** Decidido

**Decisão:** Quando o mesmo cliente é editado no Web e no Mobile offline simultaneamente, o registro com `UpdatedAt` mais recente prevalece.

**Motivo:** Solução mais simples e suficiente para o MVP. Evita lógica complexa de merge de conflitos.

**Limitação conhecida:** Em casos raros, uma edição válida pode ser sobrescrita. Aceitável para o público-alvo (microempreendedores com poucos agentes).

---

## DEC-07 — Configuracao é 1-para-1 com Empresa (não com Usuario)

**Status:** Decidido — implementado

**Decisão:** A `Configuracao` pertence à `Empresa`, não ao `Usuario`. Todos os agentes da mesma empresa operam sob a mesma configuração.

**Motivo:** `TipoOperacao` define como a empresa opera — não faz sentido cada agente ter uma configuração diferente.

**Futuro planejado:** Sistema de perfis por agente (ex: vendedor vs técnico), onde cada perfil pode ter permissões específicas. Não previsto para o MVP.

---

## DEC-08 — TipoOperacao e StatusAtendimento ainda são strings livres

**Status:** ✅ Resolvido — commit `2a7ad7f` (KAN-64)

**Situação:** Enums `TipoOperacao` e `StatusAtendimento` foram criados e aplicados nas entidades, DTOs e AppDbContext (commit `refactor(enums)` em 17/06/2026). A migration `ConvertEnumsToString` ficou pendente por falta do `dotnet ef` instalado na máquina.

**Resolução aplicada:** `dotnet ef` foi instalado e a migration `ConvertEnumsToString` foi gerada e aplicada (commit `2a7ad7f`), sincronizando o histórico do EF Core com o schema real.

**Enums criados:**
```csharp
// Enums/TipoOperacao.cs
public enum TipoOperacao { Venda, Servico, Hibrido }

// Enums/StatusAtendimento.cs
public enum StatusAtendimento { Pendente, Concluido, Cancelado }
```

---

## DEC-09 — Uuid como string (não Guid nativo)

**Status:** ✅ Resolvido — commit `3972f8d` (KAN-65)

**Decisão temporária (histórico):** Campos `Uuid` nas entidades offline-first eram `string` (36 chars).

**Motivo original:** Implementado antes da decisão ser revisada. PostgreSQL tem tipo `uuid` nativo mais eficiente.

**Resolução aplicada:** Campos `Uuid` convertidos de `string` para `Guid` nativo (`Guid.NewGuid()` como valor padrão), removido `HasMaxLength(36)` do AppDbContext, migration correspondente gerada e aplicada.

---

## DEC-10 — AuthService acessa DbContext diretamente (sem Repository)

**Status:** Débito técnico — baixa prioridade

**Decisão temporária:** `AuthService` é o único Service que acessa `AppDbContext` diretamente, sem passar por um Repository.

**Motivo:** Auth tem particularidades (criação encadeada de Empresa + Usuario + Configuracao) que tornam o Repository menos natural aqui.

**Ação planejada:** Criar `IUsuarioRepository` para padronizar com os demais Services. Baixa urgência.

---

## DEC-11 — Estoque integrado ao fluxo de vendas

**Status:** ✅ Resolvido — commit `fix(stock)` em 17/06/2026

**Situação anterior:** `ItemProdutoService.CreateAsync` não verificava nem decrementava `QuantidadeEstoque`. Soft delete não devolvia estoque.

**Correção aplicada:**
- `CreateAsync`: valida estoque suficiente (lança `EstoqueInsuficienteException`) e decrementa.
- `UpdateAsync`: calcula diferença entre quantidade nova e antiga, ajusta estoque.
- `DeleteAsync`: devolve quantidade ao estoque antes do soft delete.
- `ItemProdutoController`: captura `EstoqueInsuficienteException` e retorna HTTP 400.

**Complemento posterior:** cascade soft delete de itens e devolução de estoque ao deletar um `Atendimento` inteiro (commit `1b8b433`).

---

## DEC-12 — GitHub Education para branch protection

**Status:** Pendente — ação do Tech Lead

**Situação:** Branch protection rules requerem plano pago para repositórios privados. Atualmente commits diretos em `develop` são possíveis sem PR.

**Mitigação:** Acordo de processo — ninguém faz push direto em `develop` ou `main` sem aprovação de Davi Gomes ou Diego Mendes.

**Ação planejada:** Tech Lead solicitar GitHub Education Pack com email acadêmico da Uniube.

---

## DEC-13 — Versões do EF Core inconsistentes entre Api e Tests

**Status:** ✅ Resolvido — commit `29616ba` (KAN-66)

**Situação:** `MicroERP.Api` usava EF Core `8.0.4`, `MicroERP.Tests` usava `8.0.26`. Gerava warning MSB3277 no build.

**Risco:** Testes podiam esperar comportamento de `8.0.26` mas rodar com assembly `8.0.4`.

**Resolução aplicada:** Versões dos três pacotes (`EntityFrameworkCore`, `Relational`, `InMemory`) alinhadas em `8.0.11` em ambos os projetos. Build atual: 0 warnings, 0 erros.

---

## DEC-14 — Bug multi-tenant nos controllers legados (KAN-63)

**Status:** ✅ Resolvido — commits `abbcfa9` e `8305606` (KAN-63)

**Situação:** Após o refactor multi-tenant (KAN-56), Services e Repositories passaram a filtrar por `EmpresaId`, mas os controllers legados continuavam extraindo `usuarioId` (claim `sub`) e passando esse valor como se fosse `empresaId`.

**Impacto:** Quebra de isolamento multi-tenant. Antes da correção, "funcionava" apenas por coincidência quando `usuarioId == empresaId` (cenário de empresa única em dev). Em produção com múltiplos usuários por empresa, os dados de uma empresa poderiam vazar para outra.

**Controllers afetados:** `ClienteController`, `ProdutoController`, `ServicoController`, `AtendimentoController`, `ItemProdutoController`, `ItemServicoController`.

**Resolução aplicada:** Criado o helper `TryGetEmpresaId` (lendo a claim `empresaId`, emitida pelo `AuthService` no JWT) em `ApiControllerBase`, e todos os controllers afetados foram migrados para usá-lo no lugar de `TryGetUsuarioId`. O helper `TryGetUsuarioId` também foi extraído para `ApiControllerBase` (commit `0a9a74b`) e segue em uso onde o identificador do agente é necessário (ex: `Atendimento.UsuarioId`). `ConfiguracaoController` já nasceu correto e serviu de referência.

---

## DEC-15 — Novo foco: Prestador de Serviço em primeiro lugar

**Status:** Decidido — aprovado por Davi (pivô de produto)

**Decisão:** O produto muda de foco. Deixa de ser um ERP híbrido com peso igual entre venda e serviço, e passa a ser focado no Prestador de Serviço. A venda de produto vira secundária ("plus"), habilitada apenas conforme a `TipoOperacao` configurada pela empresa. O default de `TipoOperacao` passa de `Hibrido` para `Servico`. `Hibrido` e `Venda` continuam existindo para quem precisar deles.

**Contexto:** O produto nasceu com foco em nicho (instalador de AC), evoluindo depois para um modelo híbrido genérico. A decisão do pivô é tornar a espinha do produto o ciclo de vida do serviço — Orçamento → Agendamento → Execução (Atendimento) → Cobrança — em vez de tratar venda e serviço como iguais. O app precisa ser flexível para qualquer tipo de prestador, não só instalador de AC.

**Implicações:**
- O Kanban do protótipo mobile (Agendado → Hoje → Andamento → Concluído) deixa de ser apenas prototipagem visual e vira modelo de domínio real.
- Novas prioridades de MVP: Orçamento, Agenda e Rota (ver DEC-16 e DEC-17).
- `TipoOperacao = Venda` e `Hibrido` continuam suportados, mas não são mais o caminho principal do produto.

---

## DEC-16 — Orçamento como entidade separada do Atendimento

**Status:** ✅ Resolvido — implementado (commit `fffaba0`)

**Decisão:** `Orcamento` é um documento próprio, distinto de `Atendimento`. Não afeta estoque. Quando aprovado pelo cliente, converte-se em `Atendimento`.

**Contexto:** Discutida a alternativa de usar uma única entidade (`OrdemServico`) com um status que percorre Orçamento → ... → Concluído. Essa alternativa foi descartada para manter os relatórios financeiros limpos — um orçamento rejeitado não deve poluir dados de venda/estoque.

**Alternativas descartadas:**
- Entidade única `OrdemServico` com status progressivo → misturaria documentos que nunca viraram venda/serviço real com dados financeiros reais, complicando relatórios.

**Observação:** O aumento no número de entidades foi considerado aceitável pelo dono do produto (Davi), desde que bem organizado. Preferiu a separação clara entre "intenção" (orçamento) e "execução" (atendimento).

**Resolução aplicada:** Entidade `Orcamento` + `ItemOrcamento` criadas, com CRUD completo. Conversão transacional via `POST /api/orcamento/{id}/converter` — só converte se o orçamento estiver `Aprovado`, e a baixa de estoque acontece exclusivamente no momento da conversão (não na criação do orçamento). Commit `fffaba0`. `SyncCargaResponse.Orcamentos` também foi adicionado depois (commit `5e82411`), levando os orçamentos para o mobile na Carga do sync — a **descarga** (criar orçamento offline) segue em aberto, ver TASKS.md.

---

## DEC-17 — Agenda e Rota como prioridade; Cliente ganha Endereço

**Status:** 🟡 Parcialmente resolvido — endereço e agenda implementados (commits `da828bc`, `7007361`); lat/lng e roteirização continuam pendentes

**Decisão:** Agendamento de atendimentos e roteirização de campo passam a ser prioridades do MVP do prestador. A entidade `Cliente` precisa ganhar o campo `Endereco` (hoje só tem Nome, Telefone, CPF), com geolocalização (lat/lng) prevista para uma etapa futura.

**Contexto:** Um prestador de serviço de campo depende de saber onde e quando atender. Sem endereço estruturado no `Cliente`, não é possível montar agenda geolocalizada nem rota do dia.

**Implicações:**
- `Cliente.Endereco` precisa ser adicionado ao schema quando a feature for implementada.
- Lat/lng fica marcado como etapa futura, não obrigatória no primeiro corte.

**Resolução aplicada (parcial):**
- `Cliente` ganhou os campos `Logradouro`, `Numero`, `Bairro`, `Cidade`, `Cep` (commit `da828bc`).
- `Atendimento` ganhou `DataAgendada` e o endpoint `GET /api/atendimento/agenda`, com filtro por perfil (Agente vê só a própria agenda; Dono vê todas/filtra), viabilizado pelo novo helper `TryGetPerfil` em `ApiControllerBase` (commit `7007361`).
- Depois, o endpoint de agenda foi enriquecido para devolver `AgendaItemResponse` com nome/telefone/endereço do cliente e resumo do serviço, eliminando N+1 no consumo mobile (commit `5e82411`).
- **Pendente:** geolocalização (lat/lng no `Cliente`) e roteirização (ordenação por proximidade/rota do dia) — fase posterior desta decisão, ainda não iniciada.
- **Delta identificado no mobile (mob-04, ver DEC-26):** a Carga da sincronização não inclui a agenda; o app mobile precisou de um passo `syncAgenda` separado (`GET /api/atendimento/agenda` cacheado) como contorno. Idealmente a agenda entraria na Carga.

---

## DEC-18 — Item de atendimento generalizado: catálogo vs avulso

**Status:** ✅ Resolvido — implementado (commit `61a9c29`)

**Decisão:** O campo `ProdutoId` do item de atendimento passa a ser opcional (nullable). Se `ProdutoId` estiver preenchido, o item é de catálogo e **baixa estoque**. Se for nulo, o item é avulso — descrição livre (ex: "Cano PVC 50mm" comprado na hora na loja), **não baixa estoque**.

**Contexto:** Regra única e simples: o gatilho de baixa de estoque é a presença de `ProdutoId`, não o contexto de uso (venda ou serviço). Um produto de catálogo instalado num atendimento de serviço também baixa estoque, porque fisicamente saiu da prateleira — o mesmo vale tanto para venda quanto para serviço.

**Esclarecimento importante (para evitar confusão futura):** `Produto` está ligado a ESTOQUE, não a "venda". "Venda" é apenas um contexto de uso. São dois eixos independentes:
- (a) origem do item = `ProdutoId` preenchido (catálogo) vs avulso (descrição livre)
- (b) contexto de uso = `TipoOperacao` (Venda / Servico / Hibrido)

Um produto de catálogo pode viver nos dois contextos. A venda avulsa de produto no balcão é apenas uma capacidade habilitada pela `TipoOperacao`, não uma entidade diferente de produto.

**Implicações:**
- `ProdutoId` no item deixa de ser obrigatório no schema.
- A lógica de baixa/devolução de estoque (DEC-11) passa a checar `ProdutoId != null` como condição, e não mais assumir que todo item tem produto vinculado.

> **Nota (DEC-22):** o item avulso efêmero (sem entidade de catálogo) vale só para **produtos**. Para serviços não existe equivalente — serviço fora do catálogo vira cadastro rápido no catálogo, ver DEC-22.

**Resolução aplicada:** `ItemProduto.ProdutoId` tornado nullable, com novo campo `Descricao` para o item avulso; a regra de baixa/devolução de estoque passou a checar `ProdutoId != null`. Commit `61a9c29`.

---

## DEC-19 — Rastreio de custo por item e margem por atendimento

**Status:** ✅ Resolvido — implementado (commits `61a9c29`, `2b0d253`)

**Decisão:** Cada item do atendimento ganha um campo `Custo` (opcional, preenchido livremente pelo prestador). `Subtotal` (o que entra no `ValorTotal`, o que o cliente paga) e `Custo` (o que o prestador pagou) são campos independentes — o prestador escolhe qual preencher: se cobra o material do cliente, preenche `Subtotal`; se absorve o custo, preenche só `Custo`.

**Contexto:** Filosofia deliberada: sem regra, sem markup automático, sem validação cruzada entre `Subtotal` e `Custo`. O prestador registra como quiser. Se não preencher `Custo`, nada quebra — o comportamento atual (DEC-05, snapshot de preço) continua válido.

**Implicações:**
- Habilita **margem por atendimento**: `Margem = ValorTotal − Σ Custos`.
- Feature de valor direto para o prestador entender o lucro real de cada serviço, não só o faturamento.
- Não há dependência entre DEC-19 e DEC-18 no schema — `Custo` se aplica tanto a itens de catálogo quanto avulsos.

> **Nota:** o campo `Custo` mora no `ItemProduto` (tanto de catálogo quanto avulso). Custo de material usado num serviço é registrado como uma **linha avulsa de produto** (ex: suporte de TV comprado na loja), não como campo no `ItemServico`.

**Resolução aplicada:** Campo `ItemProduto.Custo` adicionado (commit `61a9c29`); `Atendimento.CustoTotal` passou a ser recalculado e `AtendimentoResponse` passou a expor `Margem = ValorTotal - CustoTotal` (commit `2b0d253`). Depois, a margem também foi agregada em nível de negócio no novo `GET /api/metrics/rentabilidade` e no bloco `Rentabilidade` do `DashboardResponse` (faturamento, custo, margem, margem %, ticket médio, nº de atendimentos concluídos no período) — commit `5e82411`.

---

## DEC-20 — Camada de métricas separada da camada de IA

**Status:** ✅ Fase 1 implementada — commit `87f54e6` (KAN-77: KAN-78, KAN-80, KAN-81 concluídas; KAN-79 parcial). A parte de margem/tempo continua adiada, dependente da DEC-19/KAN-72.

**Decisão:** O sistema terá duas camadas distintas:
1. **Camada de métricas (analytics)** — agregações determinísticas calculadas no backend (C#/SQL): `GROUP BY`, `SUM`, `AVG`, giro de estoque, margem, etc. Correta, barata, sem IA. Essa camada alimenta tanto os dashboards/gráficos quanto a IA.
2. **Camada de IA** — recebe as métricas já calculadas e as interpreta em linguagem natural (resumos, destaques, alertas, recomendações).

**Contexto:** "Produto X vende mais", "serviço Y deu mais lucro" são agregações, não trabalho de IA. Enviar linhas cruas ao modelo e pedir que ele calcule resulta em erros aritméticos (LLMs alucinam em matemática). A IA nunca faz a conta — ela recebe números prontos e os interpreta. Ex: recebe "Serviço A: R$4.200 receita, 12h, margem R$2.800" e responde "Serviço A é seu mais rentável por hora, priorize agenda para ele".

**Sinergia importante:** a camada de métricas é a mesma coisa que o backend de relatórios/dashboards (antes adiado). Não é trabalho separado. E a margem por atendimento definida na DEC-19 é o que habilita as análises de lucro por serviço.

**A IA não lê imagens de gráfico** — lê os mesmos dados que geram o gráfico. Mesma fonte de dados, dois consumidores (render do gráfico + insight da IA).

**Alternativas descartadas:**
- Enviar dados brutos (linhas de `Atendimento`/`ItemServico`) direto ao modelo e pedir para ele agregar → descartado por risco de erro aritmético e custo de tokens maior.

**Implicações:**
- Ordem de implementação: a camada de métricas (que já entrega os gráficos/dashboards) é implementada **primeiro**; a IA por cima vem depois.
- Métricas base planejadas: produto mais vendido (qtd e receita), ticket médio, receita por período; receita por tipo de serviço, tempo médio, margem/hora; giro de estoque, produtos parados, ruptura iminente; margem por atendimento (DEC-19).
- A IA interpreta essas métricas em quatro blocos: (1) resumo do período, (2) destaques (ex: serviço mais rentável/hora), (3) alertas (produto parado, estoque acabando), (4) recomendações (repor/promover). Um endpoint estruturado pode devolver os quatro.

**Resolução aplicada (Fase 1):** implementados `MetricasController`, `MetricasService`/`IMetricasService`, `MetricasRepository`/`IMetricasRepository` e os endpoints `GET /api/metrics/vendas`, `/api/metrics/servicos`, `/api/metrics/estoque` e `/api/metrics/dashboard`, com DTOs próprios (`MetricasVendasResponse`, `MetricasServicosResponse`, `MetricasEstoqueResponse`, `DashboardResponse`) e testes `MetricasServiceTests` (DbContext InMemory). Todas as queries filtram por `EmpresaId` + `DeletedAt == null`, com join via `Atendimento` (já que `ItemProduto`/`ItemServico` não têm `EmpresaId` próprio). De KAN-79 (Métricas de Serviços), só a receita por tipo de serviço foi entregue nesta fase — margem/hora e tempo médio seguem pendentes, à espera do campo `Custo` (DEC-19/KAN-72) e de um campo de duração ainda não modelado.

**Complemento posterior (commit `5e82411`):** com `Custo`/`Margem` já implementados (DEC-19), foi adicionado o `GET /api/metrics/rentabilidade` e o bloco `Rentabilidade` no `DashboardResponse` — faturamento, custo, margem, margem %, ticket médio e nº de atendimentos, considerando só `Concluido` no período. Margem/hora por serviço (parte restante da KAN-79) continua adiada — depende de um campo de duração ainda inexistente; decisão do dono é substituir "serviço mais rentável/hora" por "serviços que mais faturam" no painel, métrica que já existe.

---

## DEC-21 — IA nativa paga por uso; interpreta métricas; controles de custo

**Status:** Decidido. (Reafirma e detalha a DEC-03.)

**Decisão:** A IA é nativa e paga por uso pelo operador do SaaS (Davi), não BYOK. Uma única chave da API (Anthropic Claude) fica no servidor; todos os tenants usam essa chave; o custo por token é embutido na mensalidade do plano. Todo cliente que assina tem acesso à IA.

**Alternativas descartadas:**
- **BYOK** (cliente traz o próprio token) — descartado na DEC-03; quebra a proposta de "todo cliente tem IA".
- **IA gratuita / modelo aberto self-hosted (Llama/Mistral via Ollama)** — descartado para o MVP: "grátis" desloca o custo para infra (servidor com GPU 24/7) e ops, inviável para dev solo, com qualidade menor. Pagar por uso é mais barato no volume de um micro-ERP (uma análise custa centavos com modelo econômico) e tem zero infra fixa.

**Controles de custo (a IA gasta o dinheiro do operador):**
- Modelo econômico (ex: Claude Haiku) para o comum; modelo mais capaz só onde precisa de raciocínio profundo.
- Cache de prompt para contexto repetido.
- Limite de uso por empresa por plano (free tier menor, plano pago maior).
- Rastreio de uso por `EmpresaId` (o `TenantUsage` já previsto na DEC-03) para saber quem consome e cobrar de acordo.

**Segurança (mantida da DEC-03):** chave só no servidor (nunca no front/mobile, nunca no `Configuracao` do tenant); mascarar CPF e dados sensíveis antes de enviar ao modelo; isolamento multi-tenant por `EmpresaId` em toda query que alimenta o prompt; read-only no MVP (a IA lê e sugere, nunca escreve).

**Ponto em aberto:** ✅ RESOLVIDO em 20/07/2026. Decisão do dono (dev solo, Davi): a camada de IA roda **dentro do backend C#**, usando o SDK oficial da Anthropic — não um serviço Python/FastAPI separado (design original, KAN-30). Motivo: elimina um codebase extra para um dev solo, reduzindo superfície operacional (ver `project_solo_dev`). Consequência: o épico "Módulo IA/Insights (Python)" (KAN-30) fica **obsoleto** — ver TASKS.md.

---

## DEC-22 — Serviço fora do catálogo = cadastro rápido (não linha efêmera)

**Status:** ✅ Resolvido — implementado por design (commit `61a9c29`)

**Decisão:** Quando um serviço aparece e não está no catálogo, o prestador faz um **cadastro rápido** que cria uma entidade `Servico` (catálogo) reutilizável, e então adiciona o item normalmente. NÃO existe "serviço avulso efêmero" (linha com `ServicoId` nulo). Portanto `ItemServico.ServicoId` continua **obrigatório**. Não há mudança de schema — reaproveita o `POST /api/servico` existente.

**Contexto:** Contraste proposital com o **produto avulso** (DEC-18): produto/material comprado na loja na hora (ex: suporte de TV) é genuinamente pontual e continua como linha efêmera (`ProdutoId` nulo + descrição livre), para não poluir o catálogo de produtos. Já serviços tendem a se repetir e precisam aparecer nas métricas (receita por tipo de serviço, margem/hora — camada DEC-20/KAN-77). Um serviço efêmero não entraria nesses rankings. Por isso serviço vira catálogo; produto avulso não.

**Alternativa descartada:** `ItemServico` com `ServicoId` nulo + descrição livre (linha de serviço efêmera) — descartada porque perderia o serviço nas métricas e impediria reuso/histórico de rentabilidade.

**Implicações:** assimetria intencional produto-avulso-efêmero vs serviço-sempre-catálogo. UX de "cadastro rápido de serviço" no fluxo do atendimento (frontend/mobile), mas sem backend novo.

**Resolução aplicada:** nenhuma mudança de schema foi necessária — `ItemServico.ServicoId` permanece obrigatório, conforme decidido. Commit `61a9c29` (mesmo lote que entregou DEC-18/19/23) apenas confirma que o comportamento do backend já está alinhado com esta decisão; o cadastro rápido em si é responsabilidade de UX no frontend/mobile, ainda não construído.

---

## DEC-23 — Valor do item é editável no atendimento; catálogo é só sugestão

**Status:** ✅ Resolvido — implementado (commit `61a9c29`)

**Decisão:** O valor de qualquer item de atendimento (produto ou serviço) passa a ser **digitável/editável no momento do atendimento**. O valor do catálogo (`Produto.Preco`, `Servico.ValorHora`, `Servico.ValorEmpreitada`) vira apenas **sugestão/pré-preenchimento**; o prestador pode sobrescrever conforme dificuldade/situação (ex: o mesmo serviço custa mais num caso difícil).

**Contexto:** Um mesmo serviço pode ter preços diferentes conforme a situação; forçar o valor do catálogo engessava isso.

**Relação com decisões anteriores:**
- **DEC-05** (snapshot de PrecoUnitario) continua válida: o valor fica congelado no histórico do atendimento. A mudança é que agora ele é **entrado/editável**, não apenas herdado do catálogo.
- **DEC-04** (Empreitada = ValorEmpreitada fixo, ignora quantidade): passa a ser "o catálogo pré-preenche esse valor, mas o prestador pode ajustar". A regra de não multiplicar por quantidade permanece como comportamento default.

**Implicações:** `ItemProdutoService`/`ItemServicoService` deixam de derivar o `Subtotal` estritamente do catálogo — passam a aceitar o valor informado (com o catálogo como default). Aplica-se a itens de produto e de serviço.

**Resolução aplicada:** `PrecoUnitario` passou a ser opcional nos requests de `ItemProduto` e `ItemServico`; quando informado, sobrescreve o default vindo do catálogo. Commit `61a9c29`.

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

**Atualização posterior:** Relatórios deixou de ser placeholder na web-13 e a suíte foi ampliada na web-14 e evoluções seguintes. O Módulo Dono possui MVP funcional contra MSW; a troca para API real aguarda a infraestrutura.

---

## DEC-26 — Stack e arquitetura do Mobile (App do Agente)

**Status:** ✅ Resolvido — implementado (mob-01 a mob-07, integrado na `main` em 11/08/2026)

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

**Status:** 🟡 Em implementação — organização, transferência e equipe concluídas em 19/08/2026; rulesets e formalização jurídica ainda pendentes

**Decisão:** O Agesto deixa de operar como projeto mantido por uma única pessoa e volta ao desenvolvimento em equipe. Davi continua responsável pelas decisões de produto. O repositório foi transferido para a organização `Agesto-Platform`, preservando histórico, branches e contribuições.

**Motivo:** embora o MVP tenha avançado sob desenvolvimento individual, a continuidade comercial exige revisão humana, divisão de responsabilidades, continuidade de acesso e capacidade de evolução paralela.

**Regras iniciais:**
- monorepo mantido enquanto backend, web e mobile evoluírem de forma acoplada;
- fluxo `feature/* → develop → main` por pull request;
- `develop` e `main` protegidas por revisão e verificações automatizadas;
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

**Impacto em documentos anteriores:** substitui a menção a Azure em `docs/PROJETO_CONTEXTO.md` (contexto histórico) e define a hospedagem que `DESIGN.md` seção 8 deixava em aberto. O `SETUP_LOG.md` permanece como registro histórico do Supabase de desenvolvimento original.

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

**Status:** 🟡 Decidido em 08/10/2026 — provisionamento pendente

**Decisão:** substitui a parte de API e banco da DEC-30:
- **API (.NET 8):** Render, plano Free, Web Service com o `Dockerfile` existente, configurado pelo `render.yaml` na raiz. Região **Virginia**. Publica a `develop` (provisório, até a promoção para `main`) só depois que o CI passa (`autoDeployTrigger: checksPass`).
- **Banco:** projeto Supabase novo em **East US (N. Virginia)**, ao lado da API, com a mesma `InitialCreate` da DEC-31. O projeto de São Paulo deixa de ser usado.
- **Web:** sem mudança, segue na Cloudflare Pages.

**Motivo:** a VM da Oracle exige operação (SO, Docker, HTTPS, firewall) e, sem Pay As You Go, pode ser parada por ociosidade; com Pay As You Go, exige cartão. O Render não pede cartão nem servidor para manter.

**Por que mudar o banco de região:** o Render não tem região no Brasil. Com a API em Virginia e o banco em São Paulo, cada consulta atravessaria EUA↔Brasil (~120 ms cada, várias por requisição). Com os dois em Virginia, o usuário no Brasil paga essa distância uma vez por requisição. A troca foi feita enquanto o banco ainda estava vazio.

**Alternativas descartadas:**
- **Manter Oracle** → operação da VM e risco de recuperação por ociosidade (ver DEC-30).
- **Google Cloud Run** em São Paulo → exige cartão.
- **Trocar a arquitetura da API** (TypeScript no Cloudflare Workers ou Supabase direto com RLS) → reescrever ~5.500 linhas e 51 endpoints já testados para resolver só a hospedagem; contraria o princípio de mudanças pequenas no MVP.

**Riscos e mitigações:**
- **API dorme após 15 min sem tráfego** e leva ~1 min para acordar → monitor externo chama `/health` a cada 10 min (consome ~744 das 750 h mensais; não cabe um segundo serviço Free ligado 24h).
- **Pausa do Supabase Free** após 7 dias sem atividade → o mesmo ping, porque o `/health` executa `SELECT 1`.
- **512 MB de RAM e 0,1 CPU** → suficiente para o MVP; reavaliar no primeiro sinal de lentidão.
- **Sem disco persistente** → a API não grava arquivos hoje; uploads futuros precisam de storage externo.
- **SMTP bloqueado** no plano Free → envio de e-mail futuro por API HTTP.
- **Latência Brasil↔EUA** (~120 ms por requisição) → aceita no MVP; o mobile é offline-first.

**Impacto no código:** nenhum na lógica. `deploy/oracle/` foi removido (fica no histórico do Git); o passo a passo está em `deploy/README.md`.

**Revisão:** ao surgir receita, reavaliar Render Starter (sem dormir) e Supabase Pro (sem pausa, com backup).

---

## DEC-33 — Sincronização confiável: Carga completa, Descarga por atendimento e cliente offline por UUID

**Status:** 🟡 Proposta implementada em `feature/sync-fixes` — aguardando revisão e aprovação de Davi

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
- **Migração para .NET 10** (o .NET 8 perde suporte em 10/11/2026).
