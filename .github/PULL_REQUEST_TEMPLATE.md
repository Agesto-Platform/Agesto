## Goal

<!-- What problem does this change solve? Cite the KAN/task when there is one. -->

## What changed

-

## Impact

- [ ] Backend/API
- [ ] Database/migration
- [ ] Web
- [ ] Mobile/offline
- [ ] Synchronization
- [ ] Documentation

## Evidence

<!-- Tests run, results and screenshots when applicable. -->

## Checklist

- [ ] The scope matches the approved task.
- [ ] No `empresaId` or `usuarioId` is trusted from the body.
- [ ] Operational queries respect `EmpresaId` and soft delete.
- [ ] C# and TypeScript contracts remain compatible.
- [ ] Offline failures/retries were considered when applicable.
- [ ] There are no secrets or local configuration in the diff.
- [ ] Relevant build, lint, typecheck and tests are green.
- [ ] The migration was reviewed and was not applied without authorization.
- [ ] Relevant documentation was updated with a small patch.

## Risks and rollback

<!-- What has not been validated yet? How can the change be safely undone? -->
