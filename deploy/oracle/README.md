# Deploy da API — Oracle Cloud Always Free

Passo a passo para subir a API do Agesto numa VM do Oracle Cloud, com o banco no Supabase e a web na Cloudflare Pages (DEC-30).

```
Navegador / App ──HTTPS──> Caddy (VM Oracle) ──> API .NET (container) ──> Supabase (Postgres)
```

## 1. Supabase

1. Crie o projeto na região **South America (São Paulo)**.
2. Em *Connect*, copie a connection string do **Session pooler**. A conexão direta do plano Free é só IPv6; o pooler funciona em IPv4.
3. Converta para o formato Npgsql (ver `.env.example`).
4. Em *Project Settings → Data API*, **desative a Data API**. O Agesto acessa o banco só pela própria API .NET; com a Data API ligada, as tabelas do schema `public` ficam expostas pela API REST do Supabase usando a chave `anon`, que é pública.

## 2. VM no Oracle Cloud

1. Na criação da conta, escolha **Brazil East (São Paulo)** como home region. **Não dá para trocar depois.**
2. Crie uma instância:
   - Shape: `VM.Standard.A1.Flex` (Ampere, ARM), dentro do limite Always Free atual (até 2 OCPUs / 12 GB no total).
   - Imagem: Ubuntu 24.04 (aarch64).
   - Guarde a chave SSH.
3. Na *Security List* da VCN, libere entrada TCP **80** e **443** de `0.0.0.0/0`.
4. As imagens Ubuntu da Oracle bloqueiam portas também no `iptables` da própria VM. Libere:

   ```bash
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```

5. Instale o Docker:

   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER   # saia e entre de novo no SSH
   ```

6. Converta a conta para **Pay As You Go** (*Billing → Upgrade and Manage Payment*) e crie um **alerta de orçamento** (*Billing → Budgets*, ex.: US$ 1). A Oracle pode recuperar instâncias de contas Always Free que ficam 7 dias com uso baixo de CPU, rede e memória, e a API do MVP fica ociosa a maior parte do tempo. Em Pay As You Go a VM sai dessa regra e continua sem custo enquanto estiver dentro dos limites Always Free. Ver DEC-30.

## 3. Domínio (provisório: sslip.io)

O Caddy precisa de um domínio apontado para o IP público da VM para emitir o certificado HTTPS. Enquanto não houver domínio próprio, use o **sslip.io**, que resolve o IP embutido no nome sem nenhum cadastro:

```
API_DOMAIN=api.<IP-com-hífens>.sslip.io     # ex.: IP 129.151.1.2 -> api.129-151-1-2.sslip.io
```

Confira antes de subir: `nslookup api.129-151-1-2.sslip.io` deve devolver o IP da VM.

Limitações: o domínio muda se o IP mudar. Use um **IP público reservado** na Oracle (*Networking → Reserved Public IPs*) para ele não mudar ao recriar a VM. Também depende de um serviço de terceiros. Ao migrar para domínio próprio, crie um registro `A` para o IP, troque `API_DOMAIN`, `VITE_API_BASE_URL` (Pages) e a URL do app mobile, e rode `docker compose up -d`.

## 4. Subir a API

```bash
git clone https://github.com/Agesto-Platform/Agesto.git
cd Agesto/deploy/oracle
cp .env.example .env
nano .env            # preencha domínio, connection string, segredo JWT e origem da web
docker compose up -d --build
curl https://SEU_DOMINIO/health   # deve responder "Healthy"
```

O repositório é privado: para clonar na VM, use uma *deploy key* (somente leitura) ou `gh auth login`.

### Atualizar

```bash
cd Agesto && git pull
cd deploy/oracle && docker compose up -d --build
```

### Logs

```bash
docker compose logs -f api
```

## 5. Migrations

A aplicação de migrations **depende de autorização do Davi** (AGENTS.md). A API não aplica migrations sozinha ao subir.

Caminho adotado: gerar um script idempotente na máquina de desenvolvimento, revisá-lo e rodá-lo no SQL Editor do Supabase.

```bash
# na raiz do repositório
dotnet ef migrations has-pending-model-changes --project MicroERP.Api   # deve dizer que não há mudanças
dotnet ef migrations script --idempotent --project MicroERP.Api -o deploy/oracle/migrate.sql
```

- O `migrate.sql` **não vai para o Git** (está no `.gitignore`). Gere de novo sempre que for aplicar, para não rodar uma versão desatualizada.
- O aviso `IDX10703 ... key length is zero` durante a geração é esperado: sem o segredo JWT, a ferramenta segue sem o host da aplicação.
- O `dotnet ef` grava o arquivo com BOM UTF-8, e o `psql` não aceita isso. Remova antes de usar: `sed -i '1s/^\xEF\xBB\xBF//' deploy/oracle/migrate.sql`.
- Cada migration roda na própria transação e só se ainda não estiver em `__EFMigrationsHistory`, então rodar o script de novo é seguro.
- Depois de aplicar, confira: `SELECT "MigrationId" FROM "__EFMigrationsHistory" ORDER BY 1;` deve listar todas as migrations de `MicroERP.Api/Migrations`.

## 6. Web na Cloudflare Pages

Conecte o repositório e configure:

| Campo | Valor |
|---|---|
| Root directory | `web` |
| Build command | `npm run build` |
| Output directory | `dist` |
| `VITE_API_BASE_URL` | `https://SEU_DOMINIO` |
| `VITE_USE_MOCKS` | `false` |

Depois, coloque o domínio final da Pages em `Cors__AllowedOrigins__0` no `.env` da VM e rode `docker compose up -d` de novo.

## 7. Manter o Supabase ativo

O Supabase Free pausa o projeto após 7 dias sem atividade. O `/health` executa `SELECT 1` no banco. Agende um monitor externo grátis (ex.: cron-job.org) para chamar `https://SEU_DOMINIO/health` pelo menos uma vez por dia.

## Pendências

- Backup periódico com `pg_dump` (o Supabase Free não tem backup automático).
- Deploy automático pelo GitHub Actions (hoje é manual, por SSH).
