# Contributing to Agesto

Agesto is still an MVP. The goal of the process is to keep security and context without creating unnecessary bureaucracy.

## Before you start

1. Read `AGENTS.md` and the relevant documents in `docs/project/`.
2. Make sure the task has an understandable goal and acceptance criteria.
3. If the change needs a new product rule, record the question before implementing.
4. Update your local `develop` and create a short-lived branch.

## Branches

- `feature/<task>-<description>` for features.
- `fix/<task>-<description>` for fixes.
- `chore/<description>` for maintenance without business rules.
- `docs/<description>` for standalone documentation.

Flow: short-lived branch → pull request to `develop` → local testing → milestone pull request to `main`.

`main` is production: Render and Cloudflare deploy everything that lands in it. `develop` is for integration and local testing, with no cloud deploy. Promotion to `main` uses a merge commit, never squash (step by step in `deploy/README.md`, section 9).

Do not push directly to `develop` or `main`, do not force push to those branches and do not mix unrelated tasks in the same pull request.

## Commits

Write in English, in the format:

```text
feat(scope): short description (KAN-XX)
fix(scope): short description (KAN-XX)
test(scope): short description (KAN-XX)
docs(scope): short description (KAN-XX)
chore(scope): short description
```

When there is no KAN, explain where the maintenance came from in the pull request. Do not invent identifiers.

## Checks

Run only the affected modules during development, and every required check before promotion to `main`.

Backend:

```bash
dotnet build MicroERP.sln
dotnet test MicroERP.sln
```

Web:

```bash
cd web
npm ci
npm run lint
npm test
npm run build
```

Mobile:

```bash
cd mobile
npm ci
npm run lint
npm run typecheck
npm test -- --runInBand
```

## Security and domain rules

- Never include secrets, tokens or connection strings.
- `empresaId` and `usuarioId` come from the JWT on the backend, never from the body.
- Every operational query respects `EmpresaId`.
- Operational deletion is a soft delete through `DeletedAt`.
- Changes to a persisted enum must keep the conversion to string.
- Migrations are generated and reviewed in the pull request, but only applied with authorization and a defined environment.
- Synchronization changes must take retry, idempotency, UUID and partial failures into account.

## Pull request

The PR must explain the previous and new behavior, the impact across modules, test evidence, migrations and residual risk. Interface changes should include an image or short video when the visual change is relevant.

An approval does not replace green tests. Green tests do not replace a business rule review either.
