# Setup Log — Bootstrap de Infraestrutura

> Registro das decisões e passos executados durante o setup inicial do projeto.
> Cobre as KAN-12 (repositório Git) e KAN-14 (Postgres/Supabase) do board.

**Data:** 2026-05-11
**Executado por:** Diego Mendes Santos (Depowo) com Luan Gonzaga em call de voz.

---

## Decisões registradas

| Decisão | Escolha | Por quê |
|---------|---------|---------|
| Dono do repo no GitHub | Org `Auto-academic-erp` (criada nesta sessão) | Nome `auto-erp` já estava em uso. Org centraliza o time e permite gestão de permissões via teams. |
| Visibilidade do repo | Privado | Projeto acadêmico — evita exposição acidental de credenciais. |
| Branch model | Gitflow (`main` ← `develop` ← `feature/*`) | Convenção do `PROJETO_CONTEXTO.md` seção 10. `develop` é o default. |
| Hospedagem do Postgres | **Supabase** (free tier, região South America São Paulo) | Banco compartilhado entre os 5 devs sem precisar VPN/expor IP. Decisão revisada vs Postgres local (descartado por complicar sync entre devs) e Azure (postergado pra deploy de produção). |
| `.gitignore` | Template GitHub para Visual Studio | Já cobre `bin/`, `obj/`, `appsettings.Development.json` — essencial para não vazar a senha do Supabase. |
| Licença | MIT | Default escolhido na criação. Pode revisar com a faculdade se houver restrição. |

---

## Passos executados

### 1. Autenticação no GitHub CLI (Fase 1.1)

- Estado inicial: `gh` autenticado como `supmitra-lab` (token de outro contexto).
- Conta alvo: `Depowo` (Diego Mendes Santos).
- **Bloqueio inicial:** device flow do `gh auth login` não recebia o código no email — usamos PAT (Personal Access Token).
- **Primeira tentativa (fine-grained PAT):** falhou para operar na org. Fine-grained PATs precisam ser autorizados por org explicitamente, e na criação inicial não tinham acesso à `Auto-academic-erp`.
- **Solução:** trocamos para um **classic PAT** (`ghp_*`) com escopos: `repo`, `workflow`, `admin:org`, `delete_repo`. Funciona em todas as orgs onde o usuário é admin.

Comandos:
```bash
# Login com classic PAT via stdin
gh auth login --with-token --hostname github.com < token.txt

# Validação
gh auth status                             # confirmou Depowo como Active
gh api user/memberships/orgs/Auto-academic-erp   # role: admin, state: active
```

**Pendência:** revogar em https://github.com/settings/tokens os PATs criados nesta configuração que não estiverem mais em uso.

### 2. Criação da Organização GitHub (Fase 1.2)

- Criada via web em https://github.com/account/organizations/new (gh CLI não cria orgs).
- Nome `auto-erp` recusado (já existente) → adotado **`Auto-academic-erp`**.
- Plano Free (repos privados ilimitados, Actions com 2000 min/mês).
- Owner: Depowo.

### 3. Criação do Repositório (Fase 2.1)

```bash
gh repo create Auto-academic-erp/micro-erp-auto \
  --private \
  --description "Micro-ERP Auto - Sistema de Gestao para Microempreendedores (Projeto academico Software 2)" \
  --gitignore VisualStudio \
  --license MIT \
  --add-readme
```

Saída: https://github.com/Auto-academic-erp/micro-erp-auto

### 4. Configuração Gitflow (Fase 2.3)

Clonado em `C:\Users\whatw\OneDrive\Documentos\Claude Trabalho\micro-erp-auto`.

```bash
git checkout -b develop
# (após este commit:) git push -u origin develop
# (após o push:) gh repo edit --default-branch develop
```

### 5. Documentação inicial (Fase 2.5)

Adicionados nesta branch `develop`:
- `docs/PROJETO_CONTEXTO.md` — copiado de `C:\Users\whatw\Downloads\PROJETO_CONTEXTO.md`
- `docs/SETUP_LOG.md` — este arquivo
- `README.md` — substituído pelo README do projeto com instruções de setup e Gitflow

---

## Em andamento (não concluído nesta sessão)

- [ ] Criação do projeto Supabase + connection string + teste com `psql`.
- [ ] `dotnet ef database update` aplicando migrations no Supabase.
- [ ] Smoke test da API contra o Supabase.
- [ ] Convite pro Richard (richardgazana18@gmail.com) ainda pendente.

---

## Sessão 2 (mesmo dia) — Import do backend, PR #1, Security Review, PR #2

### 6. Team e org — estado final

Após o Diego convidar via web e os membros aceitarem, a org `Auto-academic-erp` ficou:
- **Owner:** `Depowo` (Diego Mendes Santos)
- **Members:** `falkz-cmd` (Davi Gomes Rocha), `luanzz012` (Luan Gonzaga), `ghzpro034` (Davi Bueno)
- **Convite pendente:** `richardgazana18@gmail.com` (Richard)
- **Team `core-devs`:** Depowo, falkz-cmd, luanzz012, ghzpro034 — todos com `push` no repo `micro-erp-auto`. Quando Richard aceitar, adicionar via `gh api -X PUT orgs/Auto-academic-erp/teams/core-devs/memberships/<USERNAME> -f role=member`.

### 7. Import do backend C# do Luan — PR #1

O Luan compartilhou o ZIP `MicroERP.zip` (12MB) com o código backend completo: 8 entidades, AppDbContext, AuthService com JWT, 6 CRUDs (Cliente, Produto, Servico, Atendimento, ItemProduto, ItemServico), DTOs e Repositories. O código foi importado na branch `feature/backend-import-initial` em **6 commits faseados** (cada um compilando isoladamente), todos com autoria do Luan (`luangonzagaoliveira@gmail.com`):

1. `6055120 chore: scaffold inicial do projeto ASP.NET Core 8 (KAN-13)`
2. `d8f2c42 feat: modelo de dados - 8 entidades EF Core e AppDbContext`
3. `6a472d7 feat: autenticacao JWT com cadastro e login de Usuario (KAN-20)`
4. `51b0d87 feat: CRUDs Cliente, Produto, Servico, Atendimento, ItemProduto, ItemServico (KAN-22 a 26)`
5. `2ab99d6 chore: arquivo HTTP smoke test e respostas de validacao padronizadas`
6. `68c8c98 chore(ci): habilita Dependabot para NuGet e GitHub Actions`

PR #1 aberto: https://github.com/Auto-academic-erp/micro-erp-auto/pull/1 — mergeado em `develop` via "Create a merge commit" (commit `d457eea`), preservando os 6 commits do Luan no histórico.

### 8. Security review automatizado do PR #1

Executado a skill `/security-review` sobre o diff completo (146KB). Identificados 3 findings preliminares, validados em paralelo por sub-agentes contra os filtros de false-positive. Resultado final:

- **1 HIGH confirmado:** `ClienteRepository.GetByCpfAsync` sem filtro `UsuarioId` permite enumeração cross-tenant de CPF via resposta 409 Conflict (descrito em detalhe no PDF `docs/ESTRUTURA_COMMITS_E_SCHEMA.pdf`).
- **2 descartados:** 1 era redundante com o HIGH, outro era defense-in-depth sem caminho de exploração concreto (confiança 3/10).

### 9. Documentação técnica gerada (PDF de 12 páginas)

`docs/ESTRUTURA_COMMITS_E_SCHEMA.pdf` foi gerado contendo: estrutura dos 6 commits, comportamento de cada campo das 8 entidades, convenções transversais e sumário do security review. Serve como material do CP III.

### 10. PR #2 — QA do código importado (esta branch `feature/qa-security-fix-cpf`)

Branch criada a partir de `develop` (após merge do PR #1). Commits autorados pelo Diego (correções/manutenção, não código original):

1. `007d640 fix(seguranca): filtrar GetByCpfAsync por UsuarioId para isolamento multi-tenant`
   - Corrige o achado HIGH do security review.
   - 4 arquivos modificados, 6 linhas alteradas (mudança cirúrgica).
   - Mudou o índice unique de `Cpf` para `(UsuarioId, Cpf)` no AppDbContext.
2. `(este commit) docs: adiciona PDF de estrutura de commits e schema`
3. `(este commit) docs: atualiza SETUP_LOG com sessão 2`

### 11. Convenção de autoria (definida pelo Diego)

- **Código original** (feature escrita por algum dev do time) → autorar como esse dev.
- **Correções, manutenção, docs, infra** durante coordenação → autorar como **Depowo (`diegosantosmendes000@edu.uniube.br`)**.
- Sem `Co-Authored-By: Claude` em projeto acadêmico.

### 12. Diretiva permanente de segurança

Cada commit antes de push e cada PR antes de merge passa por inspeção contra: secrets (connection strings, JWT keys, PATs, AWS/Stripe keys, certificados privados), IPs RFC1918 privados, hostnames internos, PII real (CPFs reais validados, emails de pessoas reais, hashes BCrypt/PBKDF2 de senhas reais). Localhost + portas locais em `launchSettings.json` são seguros e não bloqueiam. Automação recomendada para o futuro: gitleaks como pre-commit hook + GitHub Actions workflow (parte da KAN-16 CI/CD).

---

## Pontos de atenção (consolidado)

1. **Senha do Supabase:** será gerada (32 chars random) na criação do projeto. Não pode ser recuperada — só resetada. **Salvar em vault (Bitwarden/1Password)** e compartilhar via canal seguro.
2. **`appsettings.Development.json`** com a connection string está coberto pelo `.gitignore` do template VS. Sempre confirmar com `git check-ignore -v` antes do primeiro commit que tocar nele.
3. **PG Local na máquina do Diego:** PostgreSQL 18.3 instalado parcialmente em `C:\Program Files\PostgreSQL\18` (binários OK, cluster não inicializado). **Não está em uso** — projeto roda contra Supabase. Pode desinstalar via Painel de Controle ou deixar.
4. **Free tier Supabase pausa após 7 dias sem uso.** Combinar com o time pra acessar o dashboard 1x por semana, ou upgrade pro Pro ($25/mês) na semana do CP IV (18/06).
5. **PATs desta configuração** (classic com `admin:org`/`delete_repo` e o fine-grained antigo): revogar os que não estiverem mais em uso.
7. **Cloud para deploy ainda não decidida.** PROJETO_CONTEXTO menciona Azure, mas a realidade pragmática (acadêmico, free tier) sugere Render para hosting da API + Supabase para banco + GitHub Actions para CI. Azure for Students ($100 USD/ano) vale ativar como backup.

---

## Próximos passos (referência rápida)

1. Diego revisa e mergeia PR #2 em `develop`.
2. Diego cria projeto Supabase guiado por mim — gera senha, salva, pega connection string.
3. Diego configura `appsettings.Development.json` local com a connection string (já tem o `.example`).
4. Testar conexão com `psql` (binário local em `C:\Program Files\PostgreSQL\18\bin\psql.exe`).
5. Gerar migration inicial: `dotnet ef migrations add InitialCreate`.
6. Aplicar: `dotnet ef database update` apontando pro Supabase.
7. Smoke test da API (registrar usuário, login, criar cliente).
8. Atualizar Jira: KAN-12, KAN-13, KAN-20, KAN-22, KAN-23, KAN-24, KAN-25, KAN-26 → Concluído. KAN-14, KAN-29 → andamento.
9. Quando Richard aceitar o convite da org, adicionar ao team `core-devs`.
