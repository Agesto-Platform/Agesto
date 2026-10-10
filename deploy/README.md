# Deploy — Render + Supabase + Cloudflare Pages

Passo a passo para subir o Agesto nos tiers gratuitos (DEC-32).

```
Navegador / App ──HTTPS──> Render (API .NET, Virginia) ──> Supabase (Postgres, N. Virginia)
Navegador ──HTTPS──> Cloudflare Pages (web)
```

## 1. Supabase

1. Crie o projeto na região **East US (North Virginia)**, a mesma da API no Render.
2. Em *Project Settings → Data API*, **desative a Data API**. O Agesto acessa o banco só pela própria API .NET; com a Data API ligada, as tabelas do schema `public` ficam expostas pela API REST do Supabase usando a chave `anon`, que é pública.
3. Em *Connect*, copie a connection string do **Session pooler**. A conexão direta do plano Free é só IPv6; o pooler funciona em IPv4.
4. Converta para o formato Npgsql:

   ```
   Host=<host do pooler>;Port=5432;Database=postgres;Username=postgres.<ref-do-projeto>;Password=<senha>;SSL Mode=Require;Trust Server Certificate=true
   ```

   Se a senha tiver `;` ou `"`, coloque-a entre aspas simples: `Password='minha;senha'`.

## 2. Migrations

A aplicação de migrations **depende de autorização do Davi** (AGENTS.md). A API não aplica migrations sozinha ao subir.

Gere um script idempotente na máquina de desenvolvimento, revise e rode no **SQL Editor** do Supabase:

```bash
# na raiz do repositório, com a branch atualizada
dotnet ef migrations has-pending-model-changes --project MicroERP.Api   # deve dizer que não há mudanças
dotnet ef migrations script --idempotent --project MicroERP.Api -o deploy/migrate.sql
sed -i '1s/^\xEF\xBB\xBF//' deploy/migrate.sql
```

- O `migrate.sql` **não vai para o Git** (está no `.gitignore`). Gere de novo sempre que for aplicar.
- O aviso `IDX10703 ... key length is zero` durante a geração é esperado: sem o segredo JWT, a ferramenta segue sem o host da aplicação.
- O `dotnet ef` grava o arquivo com BOM UTF-8; o `sed` acima remove.
- Cada migration roda na própria transação e só se ainda não estiver em `__EFMigrationsHistory`, então rodar de novo é seguro.

Confira depois de aplicar:

```sql
SELECT "MigrationId" FROM "__EFMigrationsHistory" ORDER BY 1;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1;
```

A primeira deve listar todas as migrations de `MicroERP.Api/Migrations`; a segunda, as tabelas do modelo mais `__EFMigrationsHistory`.

A migration `EnableRlsLockdown` liga o RLS em todas as tabelas e revoga o acesso dos roles `anon` e `authenticated`. É uma segunda camada além da Data API desligada; a API não é afetada porque conecta como dona das tabelas. Para conferir:

```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;  -- todas true
```

## 3. API no Render

1. Em render.com, entre com o GitHub e autorize o acesso ao repositório `Agesto-Platform/Agesto`.
2. *New → Blueprint* → selecione o repositório. O Render lê o `render.yaml` da raiz e cria o serviço `agesto-api` (plano Free, região Virginia).
3. Preencha as variáveis pedidas:
   - `ConnectionStrings__DefaultConnection`: a connection string do passo 1.
   - `Cors__AllowedOrigins__0`: a URL da web na Cloudflare Pages (passo 4). Se ainda não existir, use um valor provisório e troque depois. Aceita várias origens separadas por vírgula; a `/` final é ignorada.
   - `Jwt__Secret` é gerado pelo próprio Render. A API não sobe com segredo menor que 32 bytes.
   - `Auth__RegistrationKey` (opcional): ver "Cadastrar uma empresa" abaixo. Sem ela, o cadastro fica fechado.
4. O serviço publica a branch `develop` (provisório, até a promoção para `main`), e só depois que o CI do GitHub passa no commit (`autoDeployTrigger: checksPass`).
5. Teste: `curl https://agesto-api.onrender.com/health` deve responder `Healthy`. A URL exata aparece no painel.

### Cadastrar uma empresa

O cadastro público é fechado. `POST /api/auth/register` responde 404 enquanto `Auth__RegistrationKey` não estiver definida no Render. Para criar uma empresa:

1. No painel do Render, defina `Auth__RegistrationKey` com um valor aleatório longo (ex.: `openssl rand -base64 32`).
2. Chame o cadastro enviando a chave no header:

   ```bash
   curl -X POST https://agesto-api.onrender.com/api/auth/register      -H "Content-Type: application/json"      -H "X-Registration-Key: <a chave>"      -d '{"nomeEmpresa":"...","nome":"...","email":"...","senha":"..."}'
   ```

3. Apague a variável depois, para fechar o cadastro de novo.

O endpoint aceita 5 tentativas por hora por IP; o login, 10 a cada 5 minutos por IP.

### Limites do plano Free

- **Dorme após 15 min sem tráfego** e leva cerca de 1 minuto para acordar.
- **750 horas por mês** por workspace: dá para **um** serviço ligado 24h, não dois.
- 512 MB de RAM e 0,1 CPU.
- Sem disco persistente: tudo que for gravado no sistema de arquivos se perde a cada deploy ou reinício.
- Saída por SMTP (portas 25, 465, 587) bloqueada: envio de e-mail precisa de uma API HTTP.

## 4. Web na Cloudflare Pages

Conecte o repositório e configure:

| Campo | Valor |
|---|---|
| Production branch | `develop` (provisório, até a promoção para `main`) |
| Root directory | `web` |
| Build command | `npm run build` |
| Output directory | `dist` |
| `VITE_API_BASE_URL` | URL da API no Render |
| `VITE_USE_MOCKS` | `false` |

Depois, coloque a URL final da Pages em `Cors__AllowedOrigins__0` no painel do Render. O serviço reinicia sozinho ao salvar.

## 5. Mobile

No `mobile/.env`:

```
EXPO_PUBLIC_API_BASE_URL=<URL da API no Render>
EXPO_PUBLIC_USE_MOCKS=false
```

## 6. Manter API e Supabase acordados

Agende num monitor externo grátis (ex.: cron-job.org) uma chamada a `https://<URL da API>/health` **a cada 10 minutos**, com aviso por e-mail em caso de falha. Isso:

- evita que a API durma (consome ~744 das 750 horas mensais);
- gera atividade real no banco (`SELECT 1`) e evita a pausa do Supabase Free após 7 dias sem uso.

Não use o GitHub Actions para isso: um ping a cada 10 minutos estoura a cota de minutos.

## Pendências

- Backup periódico com `pg_dump` (o Supabase Free não tem backup automático).
