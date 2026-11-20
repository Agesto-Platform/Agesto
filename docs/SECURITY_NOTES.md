# Security Notes — Micro-ERP Auto

> A collection of security guidelines for the team. Each section starts with **when to read this**: the next person who touches that piece of code should check it first.

Last review: 2026-05-12 (after the security review of PR #1 + PR #2/#6).

---

## 1. JWT token storage on the frontend

**When to read this:** when tackling KAN-44 (React Web Frontend) or the Mobile module (React Native + SQLite).

### Decision to make

Where will the frontend store the JWT received from `POST /api/auth/login`? Three common options, from the safest to the most dangerous:

| Option | How it works | Security | Trade-off |
|-------|---------------|-----------|-----------|
| **`httpOnly cookie` + `SameSite=Strict`** | The backend sets the cookie automatically; the frontend JS **cannot read it** | ✅ Immune to XSS stealing the token | Requires configuring CORS with `credentials: include`. Does not work out of the box for an API consumed by mobile |
| **`sessionStorage`** | JS reads it via `sessionStorage.getItem('token')`. Gone when the tab closes | ⚠️ Vulnerable to XSS, but the short life limits damage | The user loses the login when closing the tab |
| **`localStorage`** | JS reads it via `localStorage.getItem('token')`. Persists forever | ❌ Vulnerable to XSS, long-lasting damage | Most convenient for the user |

### Recommendation

**Web (KAN-44):** start with `httpOnly cookie + SameSite=Strict`. The backend needs:

```csharp
// AuthService.cs (future) - return a cookie instead of the body
HttpContext.Response.Cookies.Append("auth_token", token, new CookieOptions
{
    HttpOnly = true,
    Secure = true,
    SameSite = SameSiteMode.Strict,
    Expires = expiresAt
});
```

And the JWT middleware reads from the cookie instead of the `Authorization` header. Documentation: https://learn.microsoft.com/en-us/aspnet/core/security/cookie-sharing

**Mobile (future KAN):** React Native **has no decent cookie storage**. Use **SecureStore (Expo) / Keychain (iOS) / Keystore (Android)** through the `expo-secure-store` lib or `@react-native-async-storage/async-storage` **with encryption on top** (not plain AsyncStorage).

### Prior decision

The API returns the token in the **body** of `POST /api/auth/login` (`Token` field in `AuthResponse`). Current state (11/11/2026): the web stores the JWT in `localStorage` (`web/src/lib/token.ts`) and the app uses `expo-secure-store`. The httpOnly cookie recommended above was not adopted on the web: the `localStorage` risk was accepted for the MVP in DEC-53 (`docs/project/DECISIONS.md`), which lists the triggers to migrate (own domain, first paying customer or end of the test accounts) and the rules until then (keep the CSP in `web/public/_headers` and do not use `dangerouslySetInnerHTML` with user data). With API and web on different sites, the cookie would need `SameSite=None` and CSRF protection, not the `Strict` from the example above.

---

## 2. Logging — never expose the token

**When to read this:** when adding a logging lib (Serilog, custom Microsoft.Extensions.Logging providers) or sending logs to external services (Datadog, Application Insights, ELK).

### The problem

ASP.NET Core, by default, **does not log the request body or the `Authorization` header**. But any custom logging middleware (especially "request logging" for debugging) can slip and capture `Authorization: Bearer <token>`. A token captured in a log = an attacker who accesses the log has access to the system.

### What to do

#### 1. Never log the whole request without scrubbing

If you use `app.UseHttpLogging()` or Serilog request logging, configure it to **remove/mask** the `Authorization` header:

```csharp
// Program.cs (future)
builder.Services.AddHttpLogging(options =>
{
    options.LoggingFields = HttpLoggingFields.RequestPath
                          | HttpLoggingFields.RequestMethod
                          | HttpLoggingFields.ResponseStatusCode;
    // NEVER add HttpLoggingFields.RequestHeaders without scrubbing
});
```

#### 2. If you need to log headers (rare), filter Authorization

```csharp
// Example scrub middleware - use it with custom logging
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

#### 3. `/api/auth/*` endpoints — the body is sensitive too

`AuthRegisterRequest` has `Senha`. `AuthLoginRequest` has `Senha`. **The request body of these endpoints can never be logged in plain text**, not even "just for debugging".

### Quick check (pre-merge checklist)

When someone opens a PR that touches logging:
- [ ] Look for `LogInformation`/`LogDebug` that receive the whole `context.Request`
- [ ] Look for `Authorization` or `Cookie` being included in what goes to the log
- [ ] Look for logs inside `AuthController`, `AuthService` that receive `request.Senha`

---

## 3. Password — when adding "Forgot my password"

**When to read this:** when creating the `POST /api/auth/forgot-password` endpoint or similar.

✅ Implemented (DEC-54, 12/11/2026): `POST /api/auth/esqueci-senha` and `POST /api/auth/redefinir-senha`, Dono only. It follows the three rules below: the response is the same whether the email exists or not, the token has 32 bytes with only the SHA-256 hash in the database (`TokensRedefinicaoSenha`), it lasts 15 minutes and works only once. Besides them: sending through Brevo happens outside the request (the response takes the same time), the token goes after the `#` in the link (out of the server logs) and each account gets at most one email every 2 minutes.

### Common pitfalls

#### 1. Do not confirm whether the email exists in the response

❌ **Wrong:**
```csharp
if (!emailExists)
    return BadRequest(new ApiResponse { Message = "Email nao cadastrado." });
return Ok(new ApiResponse { Message = "Link de reset enviado." });
```

This becomes an enumeration oracle — the attacker finds out which emails are in the database. Same problem as the CPF in PR #1.

✅ **Right:**
```csharp
// Always return the same response, whether the email exists or not
// Send the email only if it exists (silently)
return Ok(new ApiResponse { Message = "Se o email estiver cadastrado, enviamos um link." });
```

#### 2. Reset token with a short expiration

Generate a cryptographically secure random token (`RandomNumberGenerator.GetBytes(32)`), store the HASH in the database (not the raw token), expire it in **15 minutes**.

```csharp
// PasswordResetToken table
// - Id
// - UsuarioId FK
// - TokenHash (SHA256 of the token sent by email)
// - ExpiresAt
// - UsedAt nullable (single-use token)
```

#### 3. Single-use

After a successful use, set `UsedAt`. Later attempts with the same token = 401.

---

## 4. Refresh tokens (if ever added)

**When to read this:** when deciding to add a refresh token flow (long-lived JWT token to avoid asking for login every 2h).

### Rules

1. **Store the HASH** of the refresh token in the database, never the raw token
2. **Rotate on every use:** when the client presents a refresh token, generate a new one and invalidate the old one (theft detection strategy)
3. **Expiration:** 7-30 days depending on use
4. **Revocation:** the `POST /api/auth/logout` endpoint invalidates the refresh token (sets `RevokedAt`)
5. **Theft detection:** if a revoked refresh token is used, invalidate ALL of that user's refresh tokens (potential compromise)

### Why not use a JWT as the refresh token

A JWT is stateless, it cannot really be revoked. The refresh token must be in the database to allow revocation. Use an opaque random string (not a JWT).

---

## 5. CORS when the frontend arrives

**When to read this:** when configuring `app.UseCors(...)` in `Program.cs`.

### Rule

**NEVER use `AllowAnyOrigin()` in production.** An exact list of allowed origins:

```csharp
// Program.cs (future)
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
              .AllowCredentials();   // <- needed for the httpOnly cookie to work
    });
});
```

`appsettings.json` (with placeholders):
```json
{
  "Cors": {
    "AllowedOrigins": []
  }
}
```

`appsettings.Development.json` (does not go into git):
```json
{
  "Cors": {
    "AllowedOrigins": ["https://localhost:5173", "http://localhost:3000"]
  }
}
```

`appsettings.Production.json` (on the server):
```json
{
  "Cors": {
    "AllowedOrigins": ["https://app.auto-erp.com.br"]
  }
}
```

---

## 6. Rate limiting

> ✅ **Implemented (DEC-34):** login 10 every 5 min and sign-up 5 per hour per IP; sync 30/min per user. ✅ **Per-account lockout implemented (DEC-43, 11/11/2026):** 5 wrong passwords in a row lock the login for 15 minutes (423 response). The code below is the original design.

### Why it matters

`POST /api/auth/login` without a rate limit allows **password brute force**. An attacker iterates common passwords (`123456`, `senha123`, etc) against a known email.

### .NET 8 implementation

`Microsoft.AspNetCore.RateLimiting` is built in. No extra package needed.

```csharp
// Program.cs (future)
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

// In the controller:
[HttpPost("login")]
[EnableRateLimiting("login")]
public async Task<ActionResult<AuthResponse>> Login(...)
```

Original design: 5 attempts per minute per IP. In production it became 10 every 5 minutes per IP. Exceeded = 429 Too Many Requests.

### Additional lockout

✅ Implemented (DEC-43): after 5 consecutive failures on **a specific email** (not IP), the account is locked for 15 minutes. Columns `Usuarios.TentativasLoginFalhas` and `Usuarios.BloqueadoAte`. Creating the password through the email link (invitation or "Esqueci a senha", DEC-54 and DEC-55) unlocks it. The superadmin area login does not have this lockout yet (DEC-52).

---

## 7. LGPD — right to be forgotten (KAN-55)

> ✅ **Clients (DEC-34):** soft delete + anonymization. Name, CPF, phone and address are erased on deletion; the row stays for history and metrics. The Agente receives a masked CPF and quotes without cost. ✅ **Usuario (DEC-44, 11/11/2026):** soft delete (`DeletedAt`) + anonymization of name and email; the history keeps pointing to the row. The rest of this section is the original design.

**When to read this:** when implementing `DELETE /api/usuario` (KAN-55).

### Pending decision

Hard delete (deletes rows) or soft delete (`DeletedAt` field)?

- **Hard delete:** complies with LGPD to the maximum, loses the accounting history. Recommended for an academic project.
- **Soft delete + anonymization:** preserves accounting integrity by replacing PII with hashes/generic strings. Recommended for a real commercial project (auditing).

### Watch out for cascades

`Usuario` is related to:
- `Configuracao` (1:1 — cascade delete already configured)
- `Cliente`, `Atendimento`, `Produto`, `Servico` (N:1 — restrict configured)

Deleting a `Usuario` with `Restrict` fails if there are Clientes/Atendimentos. Strategy:
1. Cascading soft delete of EVERYTHING of the user (`DeletedAt = NOW()`)
2. Hard delete of the `Usuario` (with cascade to `Configuracao` only)
3. An async job physically cleans the soft-deleted rows after X days

---

## 8. EF Core migrations — never edit by hand

**When to read this:** when running `dotnet ef migrations add` or reviewing another dev's migration.

### Rules

1. **Always** `dotnet ef migrations add <SemanticName>` (e.g. `InitialCreate`, `AddRefreshToken`, `MakeCpfCompositeUnique`)
2. **Never edit** the generated file in `Migrations/*.cs` by hand, except to:
   - Add an explanatory comment
   - Rename it to be more readable (rare)
3. Each migration is **one feature/fix**. Do not pile several changes into a single migration.
4. Before committing a migration, run `dotnet ef database update --no-build` in an isolated environment to confirm it applies without errors.
5. **Never delete a migration merged into `develop`/`main`** — it creates divergence between devs. If you need to revert, generate a new migration that undoes it.

### Pending migration (history)

> Resolved: `InitialCreate` was generated and applied on Supabase on 08/10/2026 (DEC-31), with the unique index `(EmpresaId, Cpf)` on Clientes. The text below is the original plan.

The **InitialCreate** migration has not been generated yet. It will be created when we provision Supabase (KAN-29). It will contain:
- 8 tables (Usuarios, Configuracoes, Clientes, Atendimentos, Produtos, Servicos, ItemProdutos, ItemServicos)
- Unique composite index `(UsuarioId, Cpf)` on Clientes (fix from PR #6)
- Other indexes defined in AppDbContext

---

## Revision history

| Date | Who | Change |
|------|------|---------|
| 2026-05-12 | Diego Mendes (Depowo) | Initial creation — collection after the security review of PR #1 |
| 2026-10-10 | Agesto team | Full audit and hardening validated in production (DEC-34): rate limiting, profiles, token revocation, client LGPD, RLS, `agesto_api` role and verified TLS |
| 2026-11-11 | Agesto team | Status updated: per-account lockout (DEC-43), user deletion with anonymization (DEC-44), current token storage on the web and in the app, `InitialCreate` applied; `localStorage` token risk accepted in the MVP (DEC-53) |
| 2026-11-12 | Agesto team | Dono's "Esqueci a senha" implemented as in section 3, sending through Brevo (DEC-54) |
| 2026-11-12 | Agesto team | End of the temporary password: new accesses get an email invitation (72 hours, single use) and the person creates their own password; "Esqueci a senha" for the Agente too (DEC-55) |
| 2026-11-12 | Agesto team | RLS turned on in `AdminsPlataforma` and `AuditoriasAdmin`, the only tables without it; "RLS on all tables" applies again (DEC-34) |
| 2026-11-13 | Agesto team | Admin login: per-account lockout (5 wrong passwords, 15 minutes) and two-step verification with a 6-digit code by email (10 minutes, single use, only hashes in the database) (DEC-52) |
