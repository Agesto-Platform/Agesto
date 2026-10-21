# Agesto — regras para agentes

Este arquivo é a fonte de regras compartilhadas para qualquer agente que trabalhe neste repositório.

## Produto e arquitetura

- O Agesto é um SaaS multiempresa para prestadores de serviço solo e equipes.
- Backend: ASP.NET Core .NET 10 + Entity Framework Core, na arquitetura Controller → Service → Repository → AppDbContext.
- Web: React 19 + TypeScript + Vite + Tailwind + TanStack Query.
- Mobile: React Native + Expo + TypeScript + Expo Router + SQLite, com operação offline-first.
- O produto ainda é um MVP. Prefira mudanças pequenas, reversíveis e entregues de ponta a ponta; evite abstrações prematuras.

## Invariantes obrigatórios

- `empresaId` e `usuarioId` são extraídos do JWT no backend, nunca recebidos do body.
- Toda consulta de dados operacionais deve respeitar `EmpresaId`.
- Entidades operacionais usam soft delete por `DeletedAt`; não faça DELETE físico.
- Enums persistidos pelo EF Core usam `HasConversion<string>()`.
- Dependências de aplicação são injetadas por interface e registradas como `AddScoped` no `Program.cs`.
- Web e mobile consomem `ApiResponse { success, message, data, errors }`.
- O mobile é offline-first: UUID nasce no dispositivo, SQLite é a fonte local e a sincronização precisa preservar pendências em falhas.
- Nenhum segredo, token, chave, senha ou connection string pode entrar no Git.

## Fluxo de trabalho

- Fluxo Git: `feature/*` → `develop` → `main`.
- `main` é a produção (Render e Cloudflare publicam dela) e recebe apenas marcos revisados e com todas as suítes relevantes verdes. `develop` é integração e teste local.
- Antes de commit de código: revisar o diff e executar as verificações proporcionais ao módulo alterado.
- Backend estrutural: `dotnet build MicroERP.sln` e `dotnet test MicroERP.sln`.
- Web: lint, testes e build definidos em `web/package.json`.
- Mobile: lint, TypeScript e testes definidos em `mobile/package.json`.
- Sempre pedir autorização de Davi antes de commit, push, promoção para `main`, aplicação de migration ou mudança externa.
- Commits em inglês, citando a KAN/task quando existir, com uma linha curta explicando o resultado.
- Não descarte nem sobrescreva alterações existentes do usuário.

## Autoridade e decisões

- Davi decide produto, prioridade, escopo e trade-offs.
- Agentes podem propor alternativas com impacto e justificativa, mas não transformar proposta em requisito sem aprovação.
- Verifique código, histórico Git e testes antes de afirmar que algo está implementado.
- Se documentação e código divergirem, sinalize a divergência; não invente uma reconciliação.
- Documentação deve ser alterada com patches pequenos, em arquivos versionados, e revisada por diff. Nunca reescreva um documento inteiro para “reconstruí-lo”.

## Entrega de qualquer agente

Toda entrega deve informar:

1. escopo analisado ou alterado;
2. arquivos relevantes;
3. verificações executadas e resultados;
4. riscos, pendências e decisões que ainda dependem de Davi;
5. estado do Git quando aplicável.
