# Agesto — Requisitos do Sistema

> **Estado documental:** em auditoria. Este arquivo foi reconstruído em 17/08/2026 após uma sobrescrita acidental fora do Git. As regras confirmadas pelo código e pelas decisões são válidas; seções sem evidência devem ser tratadas como proposta até a conclusão da auditoria registrada em `docs/project/README.md`.

> **Foco do produto:** o Agesto é focado no **Prestador de Serviço**. A espinha do produto é o ciclo de vida do serviço — Orçamento → Agendamento → Execução (Atendimento) → Cobrança. A venda de produtos é um recurso secundário ("plus"), habilitado conforme a `TipoOperacao` configurada pela empresa. Ver DEC-15 em `DECISIONS.md`.

## Glossário obrigatório

Antes de qualquer implementação, entender a distinção entre esses termos é crítico:

| Termo | Significado | Exemplo |
|-------|-------------|---------|
| `Empresa` | Cliente pagante do SaaS (microempreendedor) | "AC Fernando", "Doce Sabor" |
| `Usuario` | Pessoa que faz login no sistema | "Fernando" (dono), "Carlos" (agente) |
| `Cliente` | Consumidor final do negócio do nosso cliente | "Vó Joana" (quem comprou o doce) |
| `Perfil` | Papel do Usuario dentro da Empresa | `Dono` ou `Agente` |

---

## 1. Gestão de Empresas e Usuários

### 1.1 Registro de Empresa
- O registro cria automaticamente uma `Empresa`, um `Usuario` com `Perfil = Dono` e uma `Configuracao` padrão (`TipoOperacao = Servico`)
- O email é normalizado (trim + lowercase) antes de qualquer operação
- Email deve ser único no sistema
- Senha mínima de 8 caracteres, armazenada com hash (ASP.NET Identity PasswordHasher)
- **[Implementado]** Cadastro fechado: `POST /api/auth/register` exige `X-Registration-Key`; sem a chave responde 404. Reabrir depende de verificação de email, ainda não implementada (DEC-34)

### 1.2 Perfis de Acesso
- **Dono:** acessa o módulo Web, vê dados de todos os agentes da empresa, gerencia configurações
- **Agente:** acessa o módulo Mobile, vê apenas seus próprios atendimentos
- O sistema deve distinguir perfis via claim `perfil` no JWT

### 1.3 Múltiplos Agentes
- Uma `Empresa` pode ter vários `Usuarios` com `Perfil = Agente`
- Agentes compartilham o mesmo catálogo de `Clientes`, `Produtos` e `Servicos` da empresa
- Cada `Atendimento` registra qual agente o realizou (`UsuarioId`) além da empresa (`EmpresaId`)

---

## 2. Configuração do Sistema

### 2.1 Tipos de Operação
A `Configuracao` define como a empresa opera:

| Tipo | Descrição |
|------|-----------|
| `Servico` | Apenas prestação de serviços (padrão) |
| `Venda` | Apenas venda de produtos |
| `Hibrido` | Venda e serviços |

- O default de `TipoOperacao` é `Servico` — reflete o foco do produto no prestador (DEC-15). `Venda` e `Hibrido` continuam suportados para quem precisar.
- Existe exatamente **1 Configuracao por Empresa**
- A configuração é gerenciada pelo Dono no módulo Web
- O módulo Mobile usa a configuração para determinar quais funcionalidades exibir (ex: venda avulsa de produto só aparece se `TipoOperacao` habilitar)
- **[Implementado]** O **web** reage ao `TipoOperacao`: no modo `Venda` a sidebar oculta **Serviços** e **Agenda**, e o seletor de item (Atendimento/Orçamento) oculta a opção **Serviço**. **`Produtos` nunca é ocultado** — é material/estoque, não "venda" (DEC-18). `Servico`/`Hibrido` mostram tudo.

### 2.2 Modo de agenda do agente e controle de estoque (DEC-27)

A `Configuracao` tem mais dois parâmetros por Empresa, editáveis pelo Dono em Parametrização (web) e propagados ao mobile pela Carga:

| Campo | Valores | Efeito |
|-------|---------|--------|
| `ModoAgendaAgente` | `Flexivel` (default) / `Fixa` | **Flexível:** o agente registra *agora* **ou** agenda para o futuro no app. **Fixa:** o agente só executa a agenda do Dono — **não agenda** (walk-in/registro imediato continua liberado). |
| `ControlaEstoque` | `true` (default) / `false` | **true:** itens de catálogo baixam/validam estoque. **false:** catálogo vira lista de materiais com preço/custo, **sem** baixa nem validação (prestador pass-through). |

- **[Implementado]** Default seguro (`Flexivel` + `ControlaEstoque = true`) em todos os caminhos; migration preserva o comportamento das empresas existentes.
- **[Implementado]** `ControlaEstoque` é aplicado nos 5 pontos de mutação de estoque (item de produto criar/editar/remover, cancelar atendimento, Descarga).
- **[Implementado]** `Fixa` tem enforcement de servidor: a Descarga ignora `DataAgendada` do agente quando a empresa é `Fixa` (o caminho online do Dono permanece livre — montar a agenda é papel dele).

---

## 3. Gestão de Clientes

- CRUD completo de clientes (consumidores finais)
- CPF é obrigatório e único por `Empresa` — formato aceito: com ou sem máscara
- CPF é normalizado (apenas dígitos) antes de armazenar
- Clientes são compartilhados entre todos os agentes da mesma empresa
- Cadastro pode ser feito no Web ou no Mobile
- Conflito de cadastro simultâneo (offline + online): última escrita por `UpdatedAt` prevalece
- **[Implementado]** Campos de endereço estruturado — `Logradouro`, `Numero`, `Bairro`, `Cidade`, `Cep` (commit `da828bc`) —, necessários para viabilizar Agenda (§13). **[Implementado]** Geolocalização: `Latitude`, `Longitude` e `GeocodificadoEm` preenchidos em segundo plano pelo OpenRouteService, só a partir do endereço (DEC-38). Ver DEC-17.

---

## 4. Gestão de Produtos

- CRUD completo de produtos
- Campos: nome, preço, quantidade em estoque
- Estoque deve ser decrementado ao registrar item de catálogo em um atendimento (venda ou serviço) e devolvido ao cancelar
- Controle de estoque negativo não é permitido — sistema deve rejeitar operação sem estoque suficiente
- Catálogo compartilhado entre todos os agentes da empresa
- `Produto` está ligado a **estoque**, não a "venda" — um produto de catálogo pode ser usado tanto em contexto de venda quanto de serviço. "Venda" é apenas um dos contextos de uso (`TipoOperacao`), não uma categoria de produto.

---

## 5. Gestão de Serviços

- CRUD completo de serviços
- Suporte a dois tipos de cobrança:

| Tipo | Campo | Cálculo do Subtotal |
|------|-------|---------------------|
| `PorHora` | `ValorHora` (obrigatório) | `Quantidade × ValorHora` |
| `Empreitada` | `ValorEmpreitada` (obrigatório) | `ValorEmpreitada` (fixo, sem multiplicação — DEC-04) |

- `TipoCobranca` é obrigatório na criação
- Serviço do tipo `Empreitada` ignora `Quantidade` no cálculo — valor é sempre fixo por padrão
- Catálogo compartilhado entre todos os agentes da empresa
- **[Implementado]** `ValorHora`/`ValorEmpreitada` do catálogo são apenas **sugestão/pré-preenchimento** — o valor real do item pode ser editado no momento do atendimento (DEC-23)
- Serviço fora do catálogo não existe como linha avulsa: é sempre **cadastro rápido** que cria um `Servico` reutilizável antes de virar item (DEC-22)

---

## 6. Atendimentos e Orçamentos

### 6.1 Registro de Atendimento
- Um atendimento pertence a uma `Empresa` e a um `Cliente`
- Registra qual `Usuario` (agente) o realizou
- Status possíveis: `Pendente`, `Concluido`, `Cancelado`
- `DataRegistro` pode ser informada pelo agente (suporte offline-first)
- **[Implementado]** `DataAgendada` permite agendar o atendimento para uma data futura (DEC-17), consumido pelo endpoint de Agenda (§13)

### 6.2 Itens do Atendimento
- Um atendimento pode ter `ItemProduto` e `ItemServico` simultaneamente (modo Híbrido)
- **[Implementado]** `ItemProduto.ProdutoId` é opcional — item de catálogo (baixa estoque) vs item avulso com descrição livre (não baixa estoque). `ItemServico.ServicoId` continua obrigatório (DEC-18, DEC-22)
- `PrecoUnitario` é capturado no momento do atendimento (snapshot) — imune a reajustes futuros do catálogo, e é **editável** no momento do lançamento, com o catálogo como default (DEC-05, DEC-23)
- **[Implementado]** `ItemProduto.Custo` (opcional) permite registrar o custo do material, habilitando margem por atendimento: `Margem = ValorTotal − CustoTotal` (DEC-19)
- `ValorTotal` do atendimento é recalculado automaticamente ao adicionar, atualizar ou remover itens
- Fórmula: `ValorTotal = Σ Subtotais de ItemProduto + Σ Subtotais de ItemServico`

### 6.3 Filtros
- Agente vê apenas seus próprios atendimentos
- Dono vê atendimentos de todos os agentes da empresa

### 6.4 Orçamento
- **[Implementado]** `Orcamento` é uma entidade separada de `Atendimento` — não afeta estoque nem métricas financeiras enquanto não é aprovado (DEC-16)
- Quando aprovado pelo cliente, o orçamento é convertido em `Atendimento` via `POST /api/orcamento/{id}/converter`; a baixa de estoque só acontece nesse momento
- **[Implementado]** Orçamentos entram na Carga da sincronização mobile (`SyncCargaResponse.Orcamentos`), permitindo que o agente veja propostas offline
- **[Planejado / não implementado]** Descarga de orçamento (criar orçamento a partir do mobile offline) — decisão de fluxo em aberto

---

## 7. Módulo Mobile — Requisitos Específicos

> As subseções abaixo descrevem o comportamento hoje construído no app mobile (`mobile/`, tasks mob-01 a mob-07, na `main` do repo `Agesto-Platform/Agesto`). Ver DEC-26 em `DECISIONS.md` e seção 11 do `DESIGN.md` para a stack e arquitetura.

### 7.1 Offline-First
- **[Implementado]** O agente consegue registrar atendimentos e cadastrar clientes sem conexão com internet — dados salvos localmente (`expo-sqlite` no device; adapter em memória no Expo Web/testes) atrás da interface `LocalDb`
- **[Implementado]** `Uuid` é gerado no dispositivo para identificação antes da sincronização
- `DataRegistro` deve refletir o momento real do atendimento, não da sincronização

### 7.2 Sincronização
Dois fluxos distintos:

**Carga (Servidor → Mobile):**
- Dispara quando o agente abre o app ou solicita sincronização
- Envia: clientes atualizados, produtos, serviços, configuração da empresa
- Critério: o backend aceita `ultimaSincronizacao`, mas o app sempre pede a Carga completa, para propagar exclusões (DEC-33)
- **[Implementado]** `SyncCargaResponse.Orcamentos` — a Carga também envia os orçamentos da empresa, permitindo que o agente veja propostas offline (commit `5e82411`)
- **[Implementado, com contorno]** A Carga **não inclui a agenda**. O app mobile contorna isso com um passo extra `syncAgenda`, que busca e cacheia `GET /api/atendimento/agenda` separadamente. **[Delta de backend]** o ideal é a agenda entrar na Carga — ver TASKS.md.

**Descarga (Mobile → Servidor):**
- Dispara quando o agente sincroniza
- Envia: atendimentos realizados offline, novos clientes e serviços cadastrados e conclusões de atendimentos agendados (DEC-33, DEC-36, DEC-39)
- Conflito de `Cliente`: última escrita por `UpdatedAt` prevalece
- **[Implementado]** Descarga de clientes pendentes e atendimentos pendentes — o app empurra os dois e marca como sincronizado ao receber confirmação do servidor
- **[Planejado / não implementado]** Descarga de `Orcamento` (criar orçamento offline no mobile) — decisão de fluxo ainda em aberto (se o agente deve poder criar proposta offline). Hoje o sync de orçamento é só Carga (leitura).
- **[Implementado]** Atendimento offline referencia cliente criado offline por `ClienteUuid`; a Descarga devolve `ClientesMapeados` e cada atendimento é tudo-ou-nada, com os rejeitados pendentes no aparelho (DEC-33)

### 7.3 Funcionalidades do Mobile
- **[Implementado]** Login e autenticação (JWT, token guardado via `expo-secure-store` no device / `localStorage` no web)
- **[Implementado]** Cadastro e consulta de Clientes (referência sincronizada + cadastro rápido offline)
- **[Implementado]** Consulta de catálogo de Produtos e Serviços (via Carga)
- **[Implementado]** Cadastro rápido de serviço no registrar, offline, enviado na Descarga e marcado para revisão do Dono; o Dono liga ou desliga em Parametrização (DEC-36)
- **[Implementado]** Registro de Atendimentos (cliente + itens de catálogo por quantidade + status), salvo offline como pendente
- Consulta de histórico de atendimentos próprios — não implementado nesta fase (fora do escopo de mob-01 a mob-07)
- **[Implementado]** Sincronização manual (aba "Mais": pendentes, última sync, botão Sincronizar) — sincronização automática em background não implementada
- **[Implementado]** Home action-first com CTA de registrar atendimento e agenda do dia (Próximo / Ainda hoje), consumindo o endpoint de Agenda (`GET /api/atendimento/agenda`, enriquecido com `AgendaItemResponse`) via o contorno `syncAgenda` descrito em 7.2. **[Implementado]** "Iniciar rota" abre o Google Maps com as visitas pendentes do dia, pela ordem dos horários (DEC-37). **[Planejado / não implementado]** Otimização da rota por proximidade ("Otimizar dia", fase 2).
- **[Implementado]** Telas dedicadas de **Agenda** (agenda completa agrupada por dia) e **Atendimentos** (lista com status e badge de pendência de envio).
- **[Implementado]** **Agendamento em campo** quando `ModoAgendaAgente = Flexivel` (ver §2.2): no registrar, alternância "Registrar agora / Agendar" com seletor de dia + hora (agenda como `Pendente` com `DataAgendada`); a aba Agenda mostra o CTA "+ Agendar". No modo `Fixa` o app oculta o agendar (só registro imediato/walk-in), e o servidor reforça isso.
- **[Implementado]** O hint de estoque nas telas do agente some quando `ControlaEstoque = false`.
- **[Implementado]** Valor do item editável no app, concluir no app um atendimento agendado e corrigir ou excluir o que ainda não foi enviado (DEC-39).

---

## 8. Módulo Web — Requisitos Específicos

- **[Implementado]** Login e autenticação (JWT)
- **[Implementado]** Dashboard "Visão geral" com KPIs, gráfico, rankings, alertas e tabela de últimos atendimentos (todos os agentes)
- **[Implementado]** Gestão de Configuração (`TipoOperacao`)
- **[Implementado]** CRUD de Produtos, Serviços, Clientes
- **[Implementado]** Agenda (timeline agrupada por dia), Orçamentos (editor de itens, status, conversão em atendimento) e Atendimentos (itens/estoque/margem)
- **[Implementado]** Relatórios — abas Rentabilidade/Serviços/Produtos/Estoque
- Visualização de atendimentos de todos os agentes — implementado
- **[Implementado]** Gestão de usuários da empresa: o Dono cadastra agentes com senha provisória, edita, desativa/reativa e redefine senha; atribui atendimentos a um agente (DEC-35)
- **[Implementado]** Mapa da agenda (aba "Mapa", Leaflet + OpenStreetMap) com os clientes geocodificados (DEC-38)
- Consome a API real em produção (DEC-32); o mock stateful (MSW) fica para desenvolvimento local, ver DEC-25

---

## 9. Módulo de Métricas (DEC-20)

- **[Implementado]** Camada determinística de agregações (C#/SQL, sem IA) — mesma fonte de dados usada pelos dashboards e pela futura interpretação por IA
- Endpoints: `GET /api/metrics/vendas` (produto mais vendido, ticket médio, receita por período), `/api/metrics/servicos` (receita por tipo de serviço — margem/hora e tempo médio pendentes, dependem de campo de duração ainda não modelado), `/api/metrics/estoque` (giro, produtos parados, ruptura iminente), `/api/metrics/dashboard` (agregador) e `/api/metrics/rentabilidade` (faturamento, custo, margem, margem %, ticket médio, nº de atendimentos concluídos)
- Toda query filtra por `EmpresaId` + `DeletedAt == null`
- Receita conta apenas atendimentos `Concluido`; estoque conta itens de atendimentos não-`Cancelado`

---

## 10. Item de Atendimento Genérico, Custo e Margem

> Detalhado em §6.2. Resumo normativo: `ItemProduto.ProdutoId` opcional (catálogo vs avulso, DEC-18); `ItemServico.ServicoId` sempre obrigatório (DEC-22); `ItemProduto.Custo` opcional habilita margem por atendimento (DEC-19); `PrecoUnitario` editável em ambos, com catálogo como default (DEC-23).

---

## 11. Reservado

> Seção reservada para expansão futura de requisitos de domínio (numeração mantida para preservar as referências cruzadas existentes a §13 — Agenda e Rota).

---

## 12. Reservado

> Seção reservada — mesma nota de §11.

---

## 13. Agenda e Rota

- **[Implementado]** `Atendimento.DataAgendada` + `GET /api/atendimento/agenda`, com filtro por perfil: Agente vê só a própria agenda; Dono vê todas/filtra (DEC-17)
- **[Implementado]** Endpoint enriquecido com `AgendaItemResponse` (nome/telefone/endereço do cliente + resumo do serviço), evitando N+1 no consumo mobile (commit `5e82411`)
- **[Implementado]** Geolocalização do `Cliente` (DEC-38), rota do dia no Google Maps pelo app (DEC-37) e mapa da agenda no web (DEC-38)
- **[Planejado / não implementado]** Otimização da rota por proximidade ("Otimizar dia") e `Servico.DuracaoMinutos` — fase 2

---

## 14. Módulo IA/Insights

- IA nativa ao produto — não configurável nem paga separadamente pelo cliente (DEC-03, DEC-21)
- Acesso somente leitura aos dados da empresa (read-only no MVP)
- Isolamento multi-tenant obrigatório — IA nunca mistura dados de empresas diferentes (`empresaId` sempre extraído do JWT)
- Dados sensíveis (CPF, etc.) mascarados antes de enviar ao modelo
- Camada de métricas (§9) alimenta a IA — a IA nunca recebe dados brutos, só agregações já calculadas (DEC-20)
- **[Decisão revisada — DEC-21]** A IA roda **dentro do backend C#** via SDK oficial da Anthropic Claude, e não como serviço Python/FastAPI separado. O módulo Python (KAN-30) está obsoleto — ver TASKS.md
- Cobrança por uso é do operador do SaaS (Davi), não do cliente final (BYOK descartado — DEC-03, DEC-21)

---

## 15. Segurança

- JWT obrigatório em todas as rotas exceto `/auth/register` e `/auth/login`
- `empresaId` e `usuarioId` sempre extraídos do JWT — nunca do corpo da requisição
- Isolamento multi-tenant: toda query filtra por `EmpresaId`
- CPF único por empresa (índice composto `EmpresaId + Cpf`)
- Soft delete em todas as entidades operacionais (`DeletedAt`)
- HTTPS obrigatório em produção
- Senha nunca armazenada em texto puro
- Chave da API de IA fica só no servidor — nunca no front/mobile, nunca em `Configuracao` do tenant (DEC-21)

---

## 16. Requisitos Não Funcionais

- API RESTful com respostas padronizadas via `ApiResponse { Success, Message, Data, Errors }`
- Validações de entrada via Data Annotations nos DTOs
- Erros de validação retornam `400 Bad Request` com lista de erros
- Entidades nunca expostas diretamente — sempre via DTOs
- CORS configurado para `localhost:5173` em desenvolvimento
- Testes unitários obrigatórios para regras de negócio críticas (xUnit + Moq)
