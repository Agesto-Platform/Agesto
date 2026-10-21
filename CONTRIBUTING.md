# Contribuindo com o Agesto

O Agesto ainda é um MVP. O objetivo do processo é manter segurança e contexto sem criar burocracia desnecessária.

## Antes de começar

1. Leia `AGENTS.md` e os documentos relevantes em `docs/project/`.
2. Confirme que a task possui objetivo e critério de aceite compreensíveis.
3. Se a mudança exigir nova regra de produto, registre a dúvida antes de implementar.
4. Atualize sua `develop` local e crie uma branch curta.

## Branches

- `feature/<task>-<descricao>` para funcionalidade.
- `fix/<task>-<descricao>` para correção.
- `chore/<descricao>` para manutenção sem regra de negócio.
- `docs/<descricao>` para documentação isolada.

Fluxo: branch curta → pull request para `develop` → teste local → pull request de marco para `main`.

A `main` é a produção: o Render e a Cloudflare publicam tudo o que entra nela. A `develop` é integração e teste local, sem deploy na nuvem. Promoção para `main` usa merge commit, nunca squash (passo a passo em `deploy/README.md`, seção 9).

Não faça push direto em `develop` ou `main`, não use force push nessas branches e não misture tarefas sem relação no mesmo pull request.

## Commits

Escreva em inglês, no formato:

```text
feat(scope): short description (KAN-XX)
fix(scope): short description (KAN-XX)
test(scope): short description (KAN-XX)
docs(scope): short description (KAN-XX)
chore(scope): short description
```

Quando não existir KAN, explique a origem da manutenção no pull request. Não invente identificadores.

## Verificações

Execute apenas os módulos afetados durante o desenvolvimento e todas as verificações exigidas antes da promoção para `main`.

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

## Regras de segurança e domínio

- Nunca inclua segredos, tokens ou connection strings.
- `empresaId` e `usuarioId` vêm do JWT no backend, nunca do body.
- Toda consulta operacional respeita `EmpresaId`.
- Exclusão operacional é soft delete por `DeletedAt`.
- Mudanças de enum persistido devem manter conversão para string.
- Migrations são geradas e revisadas no pull request, mas só aplicadas com autorização e ambiente definido.
- Alterações de sincronização precisam considerar retry, idempotência, UUID e falhas parciais.

## Pull request

O PR deve explicar comportamento anterior e novo, impacto entre módulos, evidência dos testes, migration e risco residual. Interface deve incluir imagem ou vídeo curto quando a alteração visual for relevante.

Uma aprovação não substitui testes verdes. Testes verdes também não substituem revisão de regra de negócio.
