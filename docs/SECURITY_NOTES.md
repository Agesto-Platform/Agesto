# Security Notes — Micro-ERP Auto

> Coletânea de orientações de segurança para o time. Cada seção começa com **quando ler isto**: a próxima pessoa que for tocar nesse pedaço do código deve consultar antes.

Última revisão: 2026-05-12 (após security review do PR #1 + PR #2/#6).

---

## 1. Storage do token JWT no frontend

**Quando ler isto:** quando atacar a KAN-44 (Frontend Web React) ou o módulo Mobile (React Native + SQLite).

### Decisão a tomar

Onde o frontend vai guardar o JWT recebido em `POST /api/auth/login`? Três opções comuns, da mais segura à mais perigosa:

| Opção | Como funciona | Segurança | Trade-off |
|-------|---------------|-----------|-----------|
| **`httpOnly cookie` + `SameSite=Strict`** | Backend seta cookie automaticamente; JS do frontend **não consegue ler** | ✅ Imune a XSS roubando token | Precisa configurar CORS com `credentials: include`. Não funciona out-of-the-box pra API consumida por mobile |
| **`sessionStorage`** | JS lê via `sessionStorage.getItem('token')`. Some quando fecha a aba | ⚠️ Vulnerável a XSS, mas vida curta limita dano | Usuário perde login ao fechar aba |
| **`localStorage`** | JS lê via `localStorage.getItem('token')`. Persiste pra sempre | ❌ Vulnerável a XSS, dano longo | Mais cômodo pro usuário |

### Recomendação

**Web (KAN-44):** começar com `httpOnly cookie + SameSite=Strict`. Backend precisa de:

```csharp
// AuthService.cs (futuro) - retornar cookie em vez de body
HttpContext.Response.Cookies.Append("auth_token", token, new CookieOptions
{
    HttpOnly = true,
    Secure = true,
    SameSite = SameSiteMode.Strict,
    Expires = expiresAt
});
```

E o middleware JWT lê do cookie em vez de header `Authorization`. Documentação: https://learn.microsoft.com/en-us/aspnet/core/security/cookie-sharing

**Mobile (KAN futura):** React Native **não tem cookie storage decente**. Use **SecureStore (Expo) / Keychain (iOS) / Keystore (Android)** via lib `expo-secure-store` ou `@react-native-async-storage/async-storage` **com criptografia em cima** (não plain AsyncStorage).

### Decisão precedente

Hoje (sem frontend), a API retorna o token no **body** de `POST /api/auth/login` (campo `Token` em `AuthResponse`). Funciona pra qualquer cliente (curl, Postman, Swagger), mas o frontend final precisa decidir como guardar.

---

## 2. Logging — nunca expor o token

**Quando ler isto:** quando for adicionar uma lib de logging (Serilog, Microsoft.Extensions.Logging custom providers) ou enviar logs pra serviços externos (Datadog, Application Insights, ELK).

### O problema

ASP.NET Core, por padrão, **não loga o body de request nem o header `Authorization`**. Mas qualquer middleware customizado de logging (especialmente "request logging" pra debug) pode escorregar e capturar o `Authorization: Bearer <token>`. Token capturado em log = atacante que acesse o log tem acesso ao sistema.

### O que fazer

#### 1. Nunca logar o request inteiro sem scrubbing

Se for usar `app.UseHttpLogging()` ou Serilog request logging, configurar pra **remover/mascarar** o header `Authorization`:

```csharp
// Program.cs (futuro)
builder.Services.AddHttpLogging(options =>
{
    options.LoggingFields = HttpLoggingFields.RequestPath
                          | HttpLoggingFields.RequestMethod
                          | HttpLoggingFields.ResponseStatusCode;
    // NUNCA adicionar HttpLoggingFields.RequestHeaders sem scrub
});
```

#### 2. Se precisar logar headers (raro), filtrar Authorization

```csharp
// Middleware exemplo de scrub - usar quando logging customizado
app.Use(async (context, next) =>
{
    var sanitizedHeaders = context.Request.Headers
        .Where(h => h.Key != "Authorization" && h.Key != "Cookie")
        .ToDictionary(h => h.Key, h => h.Value.ToString());
    
    logger.LogInformation("Request: {Method} {Path}, Headers: {Headers}",
        context.Request.Method, context.Request.Path, sanitizedHeaders);
    
    await next();
});
```

#### 3. Endpoints de `/api/auth/*` — body também é sensível

`AuthRegisterRequest` tem `Senha`. `AuthLoginRequest` tem `Senha`. **Body request desses endpoints nunca pode ser logado em texto plano**, mesmo "só pra debug".

### Validação rápida (checklist pré-merge)

Quando alguém abrir PR que toca em logging:
- [ ] Procurar por `LogInformation`/`LogDebug` que recebem `context.Request` inteiro
- [ ] Procurar por inclusão de `Authorization` ou `Cookie` no que vai pro log
- [ ] Procurar por log dentro de `AuthController`, `AuthService` que receba `request.Senha`

---

## 3. Senha — quando adicionar "Esqueci minha senha"

**Quando ler isto:** quando criar o endpoint `POST /api/auth/forgot-password` ou similar.

### Armadilhas comuns

#### 1. Não confirmar se o email existe na resposta

❌ **Errado:**
```csharp
if (!emailExists)
    return BadRequest(new ApiResponse { Message = "Email nao cadastrado." });
return Ok(new ApiResponse { Message = "Link de reset enviado." });
```

Isso vira oráculo de enumeração — atacante descobre quais emails estão na base. Mesmo problema do CPF do PR #1.

✅ **Certo:**
```csharp
// Sempre retornar a mesma resposta, exista o email ou não
// Mandar email só se existir (silenciosamente)
return Ok(new ApiResponse { Message = "Se o email estiver cadastrado, enviamos um link." });
```

#### 2. Token de reset com expiração curta

Gerar token aleatório criptograficamente seguro (`RandomNumberGenerator.GetBytes(32)`), armazenar HASH no banco (não o token raw), expirar em **15 minutos**.

```csharp
// Tabela PasswordResetToken
// - Id
// - UsuarioId FK
// - TokenHash (SHA256 do token enviado por email)
// - ExpiresAt
// - UsedAt nullable (token single-use)
```

#### 3. Single-use

Após usar com sucesso, marcar `UsedAt`. Tentativas subsequentes com mesmo token = 401.

---

## 4. Refresh tokens (se algum dia adicionar)

**Quando ler isto:** quando decidir adicionar fluxo de refresh token (token JWT de longa duração para evitar pedir login a cada 2h).

### Regras

1. **Armazenar HASH** do refresh token no banco, nunca o token raw
2. **Rotacionar a cada uso:** quando o cliente apresenta refresh token, gerar novo e invalidar o antigo (estratégia de detecção de roubo)
3. **Expiração:** 7-30 dias dependendo do uso
4. **Revogação:** endpoint `POST /api/auth/logout` invalida o refresh token (marca `RevokedAt`)
5. **Detecção de roubo:** se um refresh token revogado for usado, invalidar TODOS os refresh tokens daquele usuário (potencial comprometimento)

### Por que não usar JWT como refresh token

JWT é stateless, não dá pra revogar de verdade. Refresh token precisa estar no banco pra permitir revogação. Use opaque random string (não JWT).

---

## 5. CORS quando o frontend chegar

**Quando ler isto:** quando configurar `app.UseCors(...)` no `Program.cs`.

### Regra

**NUNCA usar `AllowAnyOrigin()` em produção.** Lista exata de origins permitidas:

```csharp
// Program.cs (futuro)
var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? Array.Empty<string>();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();   // <- precisa pra cookie httpOnly funcionar
    });
});
```

`appsettings.json` (com placeholders):
```json
{
  "Cors": {
    "AllowedOrigins": []
  }
}
```

`appsettings.Development.json` (não vai pro git):
```json
{
  "Cors": {
    "AllowedOrigins": ["https://localhost:5173", "http://localhost:3000"]
  }
}
```

`appsettings.Production.json` (no servidor):
```json
{
  "Cors": {
    "AllowedOrigins": ["https://app.auto-erp.com.br"]
  }
}
```

---

## 6. Rate limiting

> ✅ **Implementado (DEC-34):** login 10 a cada 5 min e cadastro 5 por hora por IP; sync 30/min por usuário. O lockout por conta abaixo continua como melhoria futura.

### Por que importa

`POST /api/auth/login` sem rate limit permite **brute force de senhas**. Atacante itera senhas comuns (`123456`, `senha123`, etc) contra um email conhecido.

### Implementação .NET 8

`Microsoft.AspNetCore.RateLimiting` é built-in. Não precisa de pacote extra.

```csharp
// Program.cs (futuro)
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("login", limiter =>
    {
        limiter.PermitLimit = 5;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
    });
});

app.UseRateLimiter();

// No controller:
[HttpPost("login")]
[EnableRateLimiting("login")]
public async Task<ActionResult<AuthResponse>> Login(...)
```

5 tentativas por minuto por IP. Excedeu = 429 Too Many Requests.

### Lockout adicional (futuro)

Após N falhas consecutivas em **um email específico** (não IP), bloquear conta por X minutos. Requer coluna `FailedLoginAttempts` e `LockedUntil` em Usuario.

---

## 7. LGPD — direito ao esquecimento (KAN-55)

> ✅ **Clientes (DEC-34):** soft delete + anonimização. Nome, CPF, telefone e endereço são apagados na exclusão; a linha fica para histórico e métricas. O Agente recebe CPF mascarado e orçamentos sem custo. A exclusão de **Usuario** segue o desenho abaixo.

**Quando ler isto:** quando implementar `DELETE /api/usuario` (KAN-55).

### Decisão pendente

Hard delete (apaga linhas) ou soft delete (campo `DeletedAt`)?

- **Hard delete:** cumpre LGPD ao máximo, perde histórico contábil. Recomendado pra projeto acadêmico.
- **Soft delete + anonimização:** preserva integridade contábil substituindo PII por hashes/strings genéricas. Recomendado pra projeto comercial real (auditoria).

### Atenção em cascata

O `Usuario` tem relacionamento com:
- `Configuracao` (1:1 — cascade delete já configurado)
- `Cliente`, `Atendimento`, `Produto`, `Servico` (N:1 — restrict configurado)

Deletar `Usuario` com `Restrict` falha se houver Clientes/Atendimentos. Estratégia:
1. Soft-delete em cascata de TUDO do usuário (`DeletedAt = NOW()`)
2. Hard-delete do `Usuario` (com cascade pra `Configuracao` apenas)
3. Job assíncrono limpa fisicamente os soft-deleted após X dias

---

## 8. Migrations EF Core — nunca editar manualmente

**Quando ler isto:** quando rodar `dotnet ef migrations add` ou for revisar migration de outro dev.

### Regras

1. **Sempre** `dotnet ef migrations add <NomeSemantico>` (ex.: `InitialCreate`, `AddRefreshToken`, `MakeCpfCompositeUnique`)
2. **Nunca editar** o arquivo gerado em `Migrations/*.cs` manualmente, exceto pra:
   - Adicionar comentário explicativo
   - Renomear pra ficar mais legível (raro)
3. Cada migration é **uma feature/correção**. Não acumular várias mudanças numa migration só.
4. Antes de commitar migration, rodar `dotnet ef database update --no-build` em ambiente isolado pra confirmar que aplica sem erro.
5. **Nunca apagar migration mergeada em `develop`/`main`** — gera divergência entre devs. Se precisar reverter, gerar nova migration que desfaz.

### Migration pendente

A migration **InitialCreate** ainda não foi gerada. Será criada quando provisionarmos o Supabase (KAN-29). Vai conter:
- 8 tabelas (Usuarios, Configuracoes, Clientes, Atendimentos, Produtos, Servicos, ItemProdutos, ItemServicos)
- Índice composto único `(UsuarioId, Cpf)` em Clientes (fix do PR #6)
- Outros índices definidos no AppDbContext

---

## Histórico de revisões

| Data | Quem | Mudança |
|------|------|---------|
| 2026-05-12 | Diego Mendes (Depowo) | Criação inicial — coletânea pós security review do PR #1 |
| 2026-10-10 | Equipe Agesto | Auditoria completa e endurecimento validado em produção (DEC-34): rate limiting, perfis, revogação de token, LGPD de clientes, RLS, role `agesto_api` e TLS verificado |
