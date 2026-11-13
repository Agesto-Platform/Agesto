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
   - `Termos__Versao`, `Termos__UrlTermos` e `Termos__UrlPrivacidade` (opcionais): versão vigente dos termos de uso e da política de privacidade (ex.: `2026-11`) e os links dos textos. Com a versão definida, quem ainda não aceitou essa versão vê a tela de aceite no próximo login; trocar a versão pede o aceite de novo a todos. Sem ela, ninguém precisa aceitar.
   - `Auth__RegistrationKey` (opcional): ver "Cadastrar uma empresa" abaixo. Sem ela, o cadastro fica fechado.
   - `Geocoding__OpenRouteServiceApiKey` (opcional): chave gratuita criada em openrouteservice.org (*Dashboard → Tokens*, plano Standard). Liga a geocodificação dos endereços dos clientes para o mapa da agenda (DEC-38); a API envia ao serviço só o endereço, nunca nome ou CPF. Sem ela, o mapa mostra que os clientes ainda não têm localização.
   - `App__VersaoMinimaAndroid` e `App__UrlDownload` (opcionais): versão mínima do APK e link para baixá-lo. Ver "APK" no passo 5.
   - `Insights__AnthropicApiKey` (opcional): chave da Anthropic para a IA (DEC-21). Sem ela, `/api/insights` e `/api/agente/perguntar` respondem 503 e o resto da API segue normal. `Insights__Modelo` troca o modelo (padrão `claude-haiku-5-5`). `Insights__PerguntasPorDia` muda o limite diário de perguntas ao Agente por empresa (padrão 20).
   - `Admin__SetupKey` (temporária): libera a criação do primeiro admin da área de superadmin. Ver a seção 10.
   - `Email__BrevoApiKey`, `Email__RemetenteEmail`, `Email__RemetenteNome` e `Email__UrlWeb` (opcionais): envio do "Esqueci a senha" e dos convites de acesso pelo Brevo (DEC-54 e DEC-55). Ver a seção 11. Sem a chave e o remetente, o envio fica desligado e a tela responde igual.
4. O serviço publica a branch `main` (DEC-41), e só depois que o CI do GitHub passa no commit (`autoDeployTrigger: checksPass`). A `develop` não vai para a nuvem: é testada localmente (ver "Ambiente local" abaixo).
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
| Production branch | `main` (DEC-41) |
| Preview deployments | desligados (*Settings → Builds → Branch control → Preview branch: None*) |
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

### APK (DEC-47)

O app do agente sai só como APK, fora das lojas. Preparação, uma vez, dentro de `mobile/`:

1. `npx eas-cli login` com uma conta que seja membro da organização `agesto` no expo.dev.
2. `npx eas-cli init`: liga o projeto à organização e grava `extra.eas.projectId` no `app.json`.
3. `npx eas-cli update:configure`: grava a URL de atualização e o `runtimeVersion` no `app.json`. Confira que o `runtimeVersion` usa a política `appVersion`, porque é esse número que o aviso de APK novo compara.
4. No projeto do expo.dev, crie a variável `EXPO_PUBLIC_API_BASE_URL` com a URL da API, nos ambientes *preview* e *production*, com visibilidade *Plain text*. O build lê a URL do `eas.json`, mas o `eas update` só lê essas variáveis; sem ela, o app atualizado não abre.
5. Faça commit das mudanças no `app.json`.

Gerar o APK: `npx eas-cli build --platform android --profile preview` para teste, ou `--profile production`. No primeiro build, deixe o EAS gerar a chave de assinatura e guarde uma cópia dela fora do repositório e do Expo (*Credentials → Download*). Todo APK precisa da mesma chave para instalar por cima do anterior sem perder os dados do aparelho.

Correção só de JavaScript: `npx eas-cli update --channel production --environment production --message "<o que mudou>"`. Mudança nativa (biblioteca nova, SDK novo) exige APK novo com `expo.version` maior.

Aviso de APK novo: depois de publicar um APK com `expo.version` maior, defina no Render `App__VersaoMinimaAndroid` (ex.: `1.1.0`) e `App__UrlDownload` (link do APK). O app compara com a versão instalada e mostra o aviso no Início.

## 6. Manter API e Supabase acordados

Uma chamada a `https://<URL da API>/health` **a cada 5 minutos**:

- evita que a API durma (o Render Free dorme após 15 minutos sem tráfego e leva cerca de 1 minuto para acordar; o ping consome ~744 das 750 horas mensais);
- gera atividade real no banco (`SELECT 1`) e evita a pausa do Supabase Free após 7 dias sem uso.

Quem faz o ping é o Worker `agesto-keepalive` da Cloudflare, versionado em `deploy/keepalive/` (Cron Trigger a cada 5 minutos, grátis no plano Free da Cloudflare). Ele substitui o cron-job.org.

**Publicar ou atualizar o Worker** (conta Cloudflare do Agesto):

```bash
cd deploy/keepalive
npm test                 # testes do Worker, sem dependências
npx wrangler login       # uma vez por máquina
npx wrangler deploy
```

**Conferir:**
- No painel da Cloudflare, em *Workers & Pages → agesto-keepalive → Logs*, cada execução registra `health 200 em N ms`. Uma falha aparece como execução com erro.
- Ao vivo, pelo terminal: `npx wrangler tail`.
- Depois de 30 minutos, o `/health` deve responder em menos de 1 segundo, sem a espera da API acordando.

O Worker foi publicado e conferido em 11/11/2026, e o monitor antigo do cron-job.org foi desligado no mesmo dia.

**Alerta:** o Worker mantém tudo acordado, mas não avisa ninguém. Para receber aviso quando a API cair, cadastre o mesmo `/health` num monitor grátis com alerta (UptimeRobot, a cada 5 minutos, ou Better Stack, a cada 3 minutos). Ele também serve de segundo ping.

Não use o GitHub Actions para isso: o agendamento atrasa em horários de pico, o bastante para a API dormir.

A solução definitiva é o Render Starter, sem sono, e o Supabase Pro, sem pausa e com backup (DEC-49). Com eles, o Worker vira só uma camada extra.

## 7. Usuário dedicado e TLS verificado (DEC-34)

A API não deve conectar como `postgres`. Depois de aplicar as migrations:

1. Rode `deploy/api-role.sql` no SQL Editor, trocando `<SENHA>` por uma senha aleatória longa.
2. No Render, troque a connection string para o novo usuário e TLS verificado:

   ```
   Host=<host do pooler>;Port=5432;Database=postgres;Username=agesto_api.<ref-do-projeto>;Password=<senha do agesto_api>;SSL Mode=VerifyFull;Root Certificate=/app/certs/supabase-ca.crt
   ```

   O certificado `MicroERP.Api/certs/supabase-ca.crt` é a CA pública do Supabase (*Database → Settings → SSL Configuration*) e vai junto na imagem.
3. Confira `/health` e um login. Se falhar, volte a connection string anterior no Render e veja o log.

Sempre que uma migration criar tabela nova, rode de novo o último bloco de `deploy/api-role.sql` (policies do RLS).

## 8. Ambiente local (testar a `develop`)

A `develop` é testada na máquina, contra um Postgres local, nunca contra o banco de produção.

1. Suba o Postgres de desenvolvimento (precisa de Docker): `docker compose up -d` na raiz. Ele escuta em `localhost:5433` (usuário, senha e banco `agesto`).
2. Em `MicroERP.Api`, copie `appsettings.Development.json.example` para `appsettings.Development.json` (a connection string do exemplo já aponta para esse Postgres) e gere o `Jwt.Secret`.
3. `dotnet ef database update --project MicroERP.Api` cria o schema local. Aqui pode, porque é o banco local; em produção continua valendo o passo 2 (script revisado + autorização).
4. `dotnet run --project MicroERP.Api --launch-profile http` sobe a API em `http://localhost:5216`. Para o app no celular, use `--urls http://0.0.0.0:5216` e o IP da máquina na rede.
5. Web: `web/.env.local` com `VITE_API_BASE_URL=http://localhost:5216` e `VITE_USE_MOCKS=false`, depois `npm run dev`.
6. Mobile: `mobile/.env` com `EXPO_PUBLIC_API_BASE_URL=http://<IP da máquina>:5216` e `EXPO_PUBLIC_USE_MOCKS=false`, depois `npx expo start --go`.

Para criar a primeira empresa local, defina `Auth__RegistrationKey` no `appsettings.Development.json` e use o `curl` de "Cadastrar uma empresa" trocando a URL.

## 9. Lançar uma versão (develop → main)

1. Confirme que a `develop` está verde no CI e foi testada localmente.
2. Se houver migration nova, gere o `migrate.sql` (passo 2) e aplique no Supabase **antes** do merge, com autorização do Davi. Migrations precisam ser compatíveis com a versão anterior da API, porque a API antiga segue no ar até o deploy terminar.
3. Abra o PR `develop → main` (https://github.com/Agesto-Platform/Agesto/compare/main...develop) e faça o merge com **Create a merge commit**. Nunca squash ou rebase: a `main` e a `develop` precisam continuar com o mesmo histórico.
4. O Render e a Cloudflare publicam a `main` sozinhos depois do CI. Confira `/health`, um login na web e uma sincronização no app.
5. Rollback: no Render, *Events → Rollback* para o deploy anterior; na Cloudflare, *Deployments → Rollback*. Migration não tem rollback automático.

## 10. Área de superadmin (equipe do Agesto)

A equipe gerencia as empresas clientes em `https://<web>/admin`: listar, ver detalhes, criar empresa com dono, bloquear e desbloquear, criar acessos e desativar usuários, e enviar o link de senha por email (DEC-55). Toda ação fica na auditoria. As contas de admin são separadas das contas de cliente e o token delas tem outra audiência, então um não abre a área do outro.

Para criar o **primeiro** admin:

1. No Render, defina `Admin__SetupKey` com um valor longo e aleatório (`openssl rand -base64 32`).
2. Chame o setup uma vez (senha com pelo menos 12 caracteres):
   ```bash
   curl -X POST https://agesto-api.onrender.com/api/admin/auth/setup \
     -H "Content-Type: application/json" \
     -H "X-Admin-Setup-Key: <a chave>" \
     -d '{"nome":"...","email":"...","senha":"..."}'
   ```
3. Apague `Admin__SetupKey` no Render. O setup só funciona enquanto não existe nenhum admin; os próximos são convidados pela tela **Equipe** e criam a própria senha pelo link do email (DEC-55).

Opcional: `Admin__ExpiresMinutes` define quanto tempo o login de admin vale (padrão 1440, 24 horas, DEC-53). Se essa variável estiver no Render com 43200, apague-a para valer o padrão.

O login de admin tem duas etapas (DEC-52): depois da senha, chega um código de 6 dígitos no email do admin pelo Brevo (seção 11). Só em emergência, como o Brevo fora do ar, `Admin__DoisFatores=false` desliga a segunda etapa; volte a apagar a variável assim que o envio voltar.

## 11. Email pelo Brevo ("Esqueci a senha" e convites, DEC-54 e DEC-55)

1. Crie a conta em brevo.com (o plano gratuito envia até 300 emails por dia).
2. Em *Senders, domains & dedicated IPs → Senders*, cadastre e confirme o remetente (ex.: `nao-responda@seudominio`). Com domínio próprio, autentique o domínio (SPF e DKIM) para os emails não caírem no spam.
3. Em *SMTP & API → API keys*, gere uma chave.
4. No Render, defina:
   - `Email__BrevoApiKey`: a chave do passo 3;
   - `Email__RemetenteEmail`: o remetente confirmado no passo 2;
   - `Email__RemetenteNome` (opcional, padrão `Agesto`);
   - `Email__UrlWeb`: o endereço do web, base do link enviado (ex.: `https://agesto.pages.dev`).
5. Teste: em `/esqueci-senha`, peça o link para o email de um Dono e confira a caixa de entrada. Falhas de envio aparecem no log do Render como "Falha ao enviar email", sem o destinatário nem o link.

O link de redefinição vale 15 minutos; o convite, 72 horas. Os dois valem uma vez só. Em desenvolvimento (`ASPNETCORE_ENVIRONMENT=Development`), o link também sai no log da API, para testar sem o Brevo; em produção, nunca.

## Pendências

- Backup periódico com `pg_dump` (o Supabase Free não tem backup automático).
- Verificação de email antes de reabrir o cadastro (DEC-34). O envio de email já existe (Brevo, seção 11).
- ~~Migração para .NET 10 (o .NET 8 perde suporte em 10/11/2026).~~ Feita na DEC-40.
