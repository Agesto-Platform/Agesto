# Agesto — Design e Arquitetura

## 1. Arquitetura Geral

O sistema segue uma arquitetura em camadas clássica no backend, com separação clara entre módulos:

```
┌─────────────────┐     ┌─────────────────┐
│   Web (React)   │     │ Mobile (RN+SQLite│
│   localhost:5173│     │   offline-first) │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │     HTTPS + JWT        │ HTTPS + JWT
         ▼                       ▼
┌─────────────────────────────────────────┐
│         Backend ASP.NET Core .NET 8     │
│                                         │
│  Controllers → Services → Repositories  │
│              ↓                          │
│         AppDbContext (EF Core)          │
└─────────────────┬───────────────────────┘
                  │
                  ▼
        ┌──────────────────────┐
        │ PostgreSQL           │
        │ provedor a definir   │
        └──────────────────────┘
```

> A IA nativa está planejada dentro do backend C# (DEC-21), mas ainda não foi implementada. O design original em Python permanece apenas como histórico na seção 6. O Mobile offline-first foi implementado — ver seção 11.

---

## 2. Arquitetura em Camadas (Backend C#)

### Responsabilidades

| Camada | Responsabilidade | Regra |
|--------|-----------------|-------|
| `Controllers` | Receber HTTP, extrair JWT, devolver resposta | Não contém regra de negócio |
| `Services` | Regras de negócio, validações, mapeamento DTO↔Entidade | Não acessa banco diretamente |
| `Repositories` | Queries ao banco via EF Core | Não contém regra de negócio |
| `AppDbContext` | Configuração do modelo, relacionamentos, índices | — |

### Padrões obrigatórios
- Toda dependência injetada via interface (`IClienteService`, `IClienteRepository`, etc.)
- Registradas como `AddScoped` no `Program.cs`
- `usuarioId` e `empresaId` sempre extraídos do JWT no Controller, nunca do body
- Entidades nunca saem pelos Controllers — sempre DTOs
- Soft delete via `DeletedAt` — nunca `DELETE` físico nas entidades operacionais

### Extração do JWT nos Controllers
Todos os controllers autenticados usam o método `TryGetUsuarioId`:

```csharp
private bool TryGetUsuarioId(out long usuarioId)
{
    usuarioId = 0;
    var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub)
        ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
    return long.TryParse(sub, out usuarioId);
}
```

> **Débito técnico registrado:** esse método está duplicado em todos os controllers. Refatorar para classe base `ApiControllerBase` em sprint futura.

---

## 3. Modelo de Dados

### 3.1 Entidades e Relações

```
Empresa 1 ──── * Usuario
Empresa 1 ──── 1 Configuracao
Empresa 1 ──── * Cliente
Empresa 1 ──── * Produto
Empresa 1 ──── * Servico
Empresa 1 ──── * Atendimento

Usuario  1 ──── * Atendimento   (agente que registrou)
Cliente  1 ──── * Atendimento

Atendimento 1 ──── * ItemProduto
Atendimento 1 ──── * ItemServico
Produto     1 ──── * ItemProduto
Servico     1 ──── * ItemServico
```

### 3.2 Entidades

#### `Empresa`
```
Id, Nome, Documento?, CreatedAt, UpdatedAt
Navegações: Usuarios[]
```

#### `Usuario`
```
Id, Nome, Email (único), Senha (hash), EmpresaId (FK),
Perfil (enum: Dono|Agente), CreatedAt, UpdatedAt
```

#### `Configuracao`
```
Id, EmpresaId (FK único — 1:1 com Empresa),
TipoOperacao (enum string: Venda|Servico|Hibrido),
CreatedAt, UpdatedAt
```

#### `Cliente`
```
Id, Uuid, Nome, Telefone?, Cpf (único por EmpresaId),
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
TipoCobranca (enum string: PorHora|Empreitada),
ValorHora? (decimal 12,2), ValorEmpreitada? (decimal 12,2),
EmpresaId (FK), CreatedAt, UpdatedAt, SyncedAt?, DeletedAt?
Regra: TipoCobranca=PorHora exige ValorHora; Empreitada exige ValorEmpreitada
```

#### `Atendimento`
```
Id, Uuid, DataRegistro, Status (enum string: Pendente|Concluido|Cancelado),
ValorTotal (decimal 12,2 — calculado),
EmpresaId (FK), UsuarioId (FK — agente que registrou), ClienteId (FK),
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
Subtotal = ValorEmpreitada (se Empreitada) | Quantidade × ValorHora (se PorHora)
```

### 3.3 Índices relevantes

| Tabela | Índice | Tipo |
|--------|--------|------|
| Usuarios | Email | Único |
| Clientes | (EmpresaId, Cpf) | Único composto |
| Clientes | Uuid | Único |
| Configuracoes | EmpresaId | Único |
| Produtos | Uuid | Único |
| Servicos | Uuid | Único |
| Atendimentos | Uuid | Único |
| ItemProdutos | Uuid | Único |
| ItemServicos | Uuid | Único |

### 3.4 Campos offline-first
Entidades manipuladas pelo Mobile possuem:
- `Uuid` — gerado no dispositivo, identifica o registro antes da sincronização
- `SyncedAt?` — null = ainda não sincronizado
- `DeletedAt?` — soft delete, necessário para comunicar deleções na sincronização

---

## 4. Autenticação e Autorização

### JWT
```
Claims: sub (usuarioId), email, jti (único por token),
        empresaId, perfil
Algoritmo: HMAC-SHA256
Expiração: 120 minutos
ClockSkew: 2 minutos
```

### Fluxo de registro (Opção A — MVP)
```
POST /api/auth/register
  → Cria Empresa (com NomeEmpresa do request)
  → Cria Usuario (Perfil=Dono, EmpresaId)
  → Cria Configuracao padrão (TipoOperacao=Hibrido, EmpresaId)
```

---

## 5. Padrões de Código

### Nomenclatura
- Entidades: singular PascalCase (`Cliente`, `ItemProduto`)
- DbSets: plural (`Clientes`, `ItemProdutos`)
- Interfaces: prefixo `I` (`IClienteService`, `IClienteRepository`)
- Enums: em pasta `Enums/`, salvos como string no banco via `HasConversion<string>()`
- DTOs: sufixo do propósito (`ClienteCreateRequest`, `ClienteResponse`)

### Enums existentes
```csharp
// Enums/PerfilUsuario.cs
public enum PerfilUsuario { Dono, Agente }

// Enums/TipoCobranca.cs
public enum TipoCobranca { PorHora, Empreitada }
```

### Enums planejados (débito técnico)
```csharp
// Enums/TipoOperacao.cs — atualmente string livre em Configuracao
public enum TipoOperacao { Venda, Servico, Hibrido }

// Enums/StatusAtendimento.cs — atualmente string livre em Atendimento
public enum StatusAtendimento { Pendente, Concluido, Cancelado }
```

### Resposta padrão da API
```csharp
public sealed class ApiResponse
{
    public bool Success { get; set; }
    public string Message { get; set; }
    public object? Data { get; set; }
    public IReadOnlyList<string> Errors { get; set; }
}
```

### Estrutura de pastas (Backend)
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

## 6. Módulo de IA (Python + FastAPI) — design original, obsoleto (ver DEC-21)

> **Obsoleto:** esta seção descreve o design original planejado. A DEC-21 resolveu essa decisão em favor de a IA rodar **dentro do backend C#**, via SDK oficial da Anthropic — não como serviço Python/FastAPI separado. Mantida como histórico.

### Princípios
- IA nativa ao produto — não configurável pelo cliente
- Isolamento via `empresaId` em toda query — nunca mistura dados
- Somente leitura no MVP — nunca altera dados
- Dados sensíveis mascarados antes de enviar ao modelo (CPF, etc.)
- SQL livre gerado pelo modelo não é permitido — apenas funções controladas

### Integração com Backend C# (planejada, obsoleta)
- Valida o mesmo JWT gerado pelo backend C#
- `empresaId` sempre extraído do token, nunca do body
- Comunicação via HTTP direto com Anthropic Claude (sem SDK comunitário)

### Arquitetura interna (planejada, obsoleta)
```
FastAPI → AgentRunner → ILLMProvider (Anthropic)
                     → IToolRegistry (funções de leitura controladas)
                     → SystemPromptBuilder
                     → ITokenBudgetGuard
```

---

## 7. Sincronização Mobile

### Endpoints (KAN-60, implementados)
```
GET  /api/sync/carga?ultimaSincronizacao={datetime}
     → Retorna: clientes, produtos, serviços atualizados desde a data
       (o mobile chama sem o parâmetro — Carga completa, DEC-33),
       configuração da empresa, e orçamentos (SyncCargaResponse.Orcamentos,
       commit 5e82411)
     → Não inclui a agenda — ver delta abaixo

POST /api/sync/descarga
     → Recebe: atendimentos offline, novos clientes (com Uuid do device);
       atendimento referencia cliente por ClienteId ou ClienteUuid
     → Retorna: ClientesSincronizados/AtendimentosSincronizados (uuids
       aceitos), ClientesMapeados (uuid → id) e Erros. Cada atendimento é
       tudo-ou-nada; rejeitados seguem pendentes no device (DEC-33)
```

### Consumo pelo app mobile (ver seção 11)
O app mobile implementou o ciclo Carga/Descarga contra esses endpoints, com dois deltas de backend identificados durante a construção (DEC-26, ver TASKS.md):
- A Carga não inclui a agenda — contornado no app com um passo `syncAgenda` separado (`GET /api/atendimento/agenda`).
- ~~Atendimento offline não referencia cliente criado offline~~ — resolvido pela DEC-33 (`ClienteUuid` + `ClientesMapeados`).

### Resolução de conflitos
- **Cliente:** última escrita por `UpdatedAt` prevalece
- **Atendimento:** Mobile é sempre fonte da verdade (criado offline)
- **Produto/Serviço:** servidor é sempre fonte da verdade (gerenciado pelo Web)

---

## 8. Banco de Dados

- **Provedor:** PostgreSQL no Supabase (plano Free, região East US / N. Virginia), ver DEC-32
- **ORM:** Entity Framework Core 8.0.11
- **Migrations:** controladas via `dotnet ef migrations`
- **Estado:** migrations geradas no código; aplicação será validada em um banco novo
- **Secrets:** connection string em `appsettings.Development.json` (gitignored)

### DeleteBehavior
- `Empresa → Usuario`: Cascade
- `Empresa → Configuracao`: Cascade
- `Atendimento → ItemProduto`: Restrict
- `Atendimento → ItemServico`: Restrict
- `Produto → ItemProduto`: Restrict
- `Servico → ItemServico`: Restrict

---

## 9. Camada de Métricas (DEC-20)

Camada determinística de agregações (C#/SQL, sem IA), implementada como parte do backend Controllers → Services → Repositories descrito na seção 2. É a mesma fonte de dados usada tanto pelos dashboards/gráficos quanto pela futura interpretação da IA (seção 6) — nunca dados brutos enviados ao modelo.

### Endpoints (Fase 1 — KAN-77, commit `87f54e6`)
```
GET /api/metrics/vendas
     → Produto mais vendido (qtd e receita), ticket médio, receita por período
     → KAN-78 — concluído

GET /api/metrics/servicos
     → Receita por tipo de serviço
     → KAN-79 — parcial: margem/hora e tempo médio adiados (dependem de
       Custo/DEC-19/KAN-72 e de um campo de duração ainda não modelado)

GET /api/metrics/estoque
     → Giro de estoque, produtos parados (>30 dias), ruptura iminente (≤7 dias)
     → KAN-80 — concluído

GET /api/metrics/dashboard
     → Agregador dos três blocos acima num único payload
     → KAN-81 — concluído
```

### Camadas envolvidas
`MetricasController` → `MetricasService`/`IMetricasService` → `MetricasRepository`/`IMetricasRepository`, com DTOs próprios (`MetricasVendasResponse`, `MetricasServicosResponse`, `MetricasEstoqueResponse`, `DashboardResponse`). Segue os mesmos padrões da seção 2 (DI via interface, `AddScoped`).

### Regras de negócio aplicadas
- Multi-tenant: toda query filtra por `EmpresaId` + `DeletedAt == null`, com join via `Atendimento` (pois `ItemProduto`/`ItemServico` não têm `EmpresaId` próprio).
- Receita conta apenas atendimentos com `Status = Concluido`; movimentação de estoque conta itens de atendimentos com `Status != Cancelado`.
- Bloco Vendas soma `ItemProduto.Subtotal`; bloco Serviços soma `ItemServico.Subtotal` — nunca o `ValorTotal` do `Atendimento`, para não duplicar receita entre os blocos (concretiza a separação venda/serviço da DEC-15).
- Joins com `Produtos`/`Servicos` também filtram `DeletedAt == null`, evitando que catálogo soft-deletado entre nas somas.

---

## 10. Frontend Web (Módulo Dono)

Front web do perfil Dono, em `web/` no monorepo `Agesto-Platform/Agesto`. Consome a API C# via HTTPS+JWT (seção 1). Design original aprovado a partir do protótipo `web-dono.html` — web é a plataforma **analítica** (gráficos, margem, rankings), em contraste com o mobile, que é **action-first** para o agente em campo (ver identidade de design: azul `#2B4ACB` para marca/ação, verde `#0E9E63` para sucesso/margem/lucro, tema claro, serif Georgia opcional só nos números de dinheiro).

### Stack
- **Vite + React 19 + TypeScript**
- **Tailwind CSS v4** — config CSS-first via `@theme` em `src/styles/tokens.css`, tokens portados do protótipo aprovado
- **React Router** (`react-router-dom` fixado em `7.18.2` por segurança — advisory de modo RSC aceito, não usado no projeto)
- **TanStack Query** — todo dado de servidor (fetch, cache, invalidação)
- **MSW (Mock Service Worker)** — mock stateful da API enquanto o banco/API real não estão no ar; liga/desliga via `VITE_USE_MOCKS`
- **Recharts** — gráficos do dashboard
- **oxlint** — lint

### Arquitetura de pastas e camadas
```
web/src/
├── features/<nome>/     → cada recurso de negócio (Clientes, Produtos, Serviços,
│                           Agenda, Orçamentos, Atendimentos, Configuração)
├── components/ui/       → kit reutilizável: Drawer (slide-over), DataTable,
│                           ConfirmDialog, TextField/NumberField/SelectField,
│                           Toast, Card, Kpi, Money, Pill, RankBar, Alert
├── lib/api.ts            → desembrulha o envelope ApiResponse, injeta Bearer, trata 401
├── lib/resource.ts       → fábrica createResource (list/create/update/delete
│                           com invalidação automática do TanStack Query)
├── types/api.ts          → tipos espelhando os DTOs reais da API (camelCase)
└── mocks/lib/http.ts     → mock stateful (makeStore + crudHandlers)
```

### Decisões de UX/arquitetura
- **Formulários em drawer lateral (slide-over)**, não modal central nem página cheia — mantém a lista visível durante a edição.
- **Costura mock↔API real:** `VITE_USE_MOCKS=true|false` liga/desliga o MSW; desligar aponta para a API real via `VITE_API_BASE_URL`, sem mudar código de feature.
- **Delta do Atendimento resolvido no front:** `GET /api/atendimento` devolve o `AtendimentoResponse` real (só `clienteId`, sem nome); o nome do cliente é resolvido no front juntando com a lista de clientes já carregada. Encerrou o formato fictício "AtendimentoResumo" que existia na apresentação.

Ver DEC-25 em `DECISIONS.md` para o histórico completo da decisão, e TASKS.md (seção "Frontend Web") para a tabela de tasks/commits e pendências (Relatórios, testes de componente, lazy-load do Recharts, troca mock→API real).

---

## 11. Mobile (App do Agente)

App mobile do agente de campo, em `mobile/` no monorepo `Agesto-Platform/Agesto`. Consome a API C# via HTTPS+JWT (seção 1), com camada de persistência offline local. Design **action-first** — em contraste com o Web (seção 10), que é a plataforma analítica do dono — usando a mesma identidade visual base (azul `#243FA6`/`#2B4ACB`, verde `#12B886`/`#0E9E63`, tema claro). Ver DEC-26 em `DECISIONS.md` para o histórico completo da decisão.

### Stack
- **React Native + TypeScript**, via **Expo (prebuild)**
- **Expo Router** — navegação, incluindo tab bar (Início/Agenda/Atendimentos/Clientes/Mais)
- **theme + StyleSheet** — estilização tipada, tokens do protótipo (não NativeWind)
- **expo-sqlite** — persistência offline no device, atrás da interface `LocalDb`, com adapter em memória para Web/testes
- **expo-secure-store** (device) / `localStorage` (web) — armazenamento do token JWT, com split por plataforma
- **Camada de mock em código** (`config.useMocks`) — análoga ao `VITE_USE_MOCKS` do web (DEC-25)
- **Jest (jest-expo)** — 29 testes no último marco, cobrindo dados, sincronização e regras do app

### Arquitetura de pastas e camadas
```
mobile/src/
├── db/
│   ├── types.ts          → interface LocalDb (contrato único de persistência)
│   ├── index.native.ts   → adapter expo-sqlite (device)
│   └── index.ts          → adapter em memória (Expo Web / Jest)
├── sync/                 → Carga e Descarga (POST/GET contra /api/sync/*),
│                           incluindo o passo syncAgenda (ver seção 7)
├── lib/                  → cliente de API (envelope + 401), utilidades
├── auth/                 → login, guarda de rota, sessão (src/lib/session.ts)
├── app/                  → rotas do Expo Router
├── features/             → telas de negócio (Home, Agenda, Registrar Atendimento,
│                           Clientes, Mais)
└── ui/                   → tema (cores, tipografia) + componentes StyleSheet
```

### Ciclo offline Carga/Descarga
1. **Login** — autenticação JWT contra `/api/auth/login`; token guardado via `expo-secure-store`/`localStorage`.
2. **Carga** — sempre completa (DEC-33); popula o banco local com clientes, produtos, serviços e configuração (`GET /api/sync/carga`), mais orçamentos (`SyncCargaResponse.Orcamentos`). Um passo adicional `syncAgenda` busca e cacheia `GET /api/atendimento/agenda` separadamente, pois a Carga não inclui a agenda (delta de backend, ver seção 7 e DEC-17).
3. **Uso offline** — Home action-first (CTA Registrar + agenda do dia Próximo/Ainda hoje); registrar atendimento (cliente + itens de catálogo por quantidade + status) grava localmente como pendente; cadastro rápido de cliente offline grava como `PendingCliente`.
4. **Descarga** — empurra clientes e atendimentos pendentes para `POST /api/sync/descarga`; marca como sincronizados só os uuids que o servidor confirmou (os rejeitados seguem pendentes) e religa atendimentos de clientes criados offline ao id do servidor (DEC-33). O botão Sincronizar faz Descarga seguida de Carga + agenda. Aba "Mais" mostra status de sync (pendentes, última sincronização, botão Sincronizar) e logout.

### Limitações conhecidas (ver DEC-26 e TASKS.md)
- Consulta de histórico de atendimentos próprios não foi implementada nesta fase (fora do escopo de mob-01 a mob-07).
- Roteirização/geolocalização (lat/lng, ordenação por proximidade) depende da DEC-17, ainda pendente.
- Teste de componente React Native (`@testing-library/react-native`) foi adiado por incompatibilidade de versão (lib v14 + jest-expo + React 19).

### Verificação
O ciclo foi validado no **Expo Web**, sem device Android/iOS físico nesta fase. O `LocalDb` atrás de interface permite usar adapter em memória no Web/testes. No último marco: typecheck, lint e 29 testes Jest verdes. A validação em dispositivo físico permanece pendente.
