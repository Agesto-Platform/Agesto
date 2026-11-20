# Agesto — rules for agents

This file is the source of shared rules for any agent working in this repository.

## Product and architecture

- Agesto is a multi-tenant SaaS for solo service providers and teams.
- Backend: ASP.NET Core .NET 10 + Entity Framework Core, using the Controller → Service → Repository → AppDbContext architecture.
- Web: React 19 + TypeScript + Vite + Tailwind + TanStack Query.
- Mobile: React Native + Expo + TypeScript + Expo Router + SQLite, working offline-first.
- The product is still an MVP. Prefer small, reversible, end-to-end changes; avoid premature abstractions.

## Mandatory invariants

- `empresaId` and `usuarioId` are extracted from the JWT on the backend, never received from the body.
- Every query on operational data must respect `EmpresaId`.
- Operational entities use soft delete through `DeletedAt`; do not do a physical DELETE.
- Enums persisted by EF Core use `HasConversion<string>()`.
- Application dependencies are injected by interface and registered as `AddScoped` in `Program.cs`.
- Web and mobile consume `ApiResponse { success, message, data, errors }`.
- Mobile is offline-first: the UUID is born on the device, SQLite is the local source and synchronization must keep pending items when it fails.
- No secret, token, key, password or connection string may go into Git.

## Workflow

- Git flow: `feature/*` → `develop` → `main`.
- `main` is production (Render and Cloudflare deploy from it) and only receives reviewed milestones with every relevant suite green. `develop` is for integration and local testing.
- Before a code commit: review the diff and run the checks proportional to the module changed.
- Structural backend changes: `dotnet build MicroERP.sln` and `dotnet test MicroERP.sln`.
- Web: lint, tests and build defined in `web/package.json`.
- Mobile: lint, TypeScript and tests defined in `mobile/package.json`.
- Always ask Davi for authorization before a commit, push, promotion to `main`, applying a migration or an external change.
- Commits, pull request titles and descriptions in English, citing the KAN/task when there is one, with a short line explaining the result.
- Exception: Davi's own commits and pull requests (including those an agent writes for Davi) are in Portuguese (pt-BR). Do not translate them.
- Repository documentation is written in English. User-facing text in the app and the web panel stays in Portuguese (pt-BR).
- Do not discard or overwrite the user's existing changes.

## Authority and decisions

- Davi decides product, priority, scope and trade-offs.
- Agents may propose alternatives with impact and rationale, but must not turn a proposal into a requirement without approval.
- Check code, Git history and tests before stating that something is implemented.
- If documentation and code diverge, flag the divergence; do not invent a reconciliation.
- Documentation must be changed with small patches, in versioned files, and reviewed by diff. Never rewrite a whole document to "rebuild" it.

## Delivery from any agent

Every delivery must state:

1. the scope analyzed or changed;
2. the relevant files;
3. the checks run and their results;
4. risks, open items and decisions that still depend on Davi;
5. the Git state when applicable.
