using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using MicroERP.Api.Authorization;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Repositories;
using MicroERP.Api.Repositories.Interfaces;
using MicroERP.Api.Services;
using MicroERP.Api.Services.Interfaces;

var builder = WebApplication.CreateBuilder(args);

// Teto global do corpo da requisição (padrão do Kestrel é 30 MB). A Descarga
// do sync tem limite próprio no controller.
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 2 * 1024 * 1024);

builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var errors = context.ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => string.IsNullOrWhiteSpace(e.ErrorMessage) ? "Requisicao invalida." : e.ErrorMessage)
                .ToList();

            return new BadRequestObjectResult(new ApiResponse
            {
                Success = false,
                Message = "Falha de validacao.",
                Errors = errors
            });
        };
    })
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter()));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IClienteRepository, ClienteRepository>();
builder.Services.AddScoped<IClienteService, ClienteService>();
builder.Services.AddScoped<IServicoRepository, ServicoRepository>();
builder.Services.AddScoped<IServicoService, ServicoService>();
builder.Services.AddScoped<IServicoSugeridoRepository, ServicoSugeridoRepository>();
builder.Services.AddScoped<IServicoSugeridoService, ServicoSugeridoService>();
builder.Services.AddScoped<IProdutoRepository, ProdutoRepository>();
builder.Services.AddScoped<IProdutoService, ProdutoService>();
builder.Services.AddScoped<IAtendimentoRepository, AtendimentoRepository>();
builder.Services.AddScoped<IAtendimentoService, AtendimentoService>();
builder.Services.AddScoped<IItemProdutoRepository, ItemProdutoRepository>();
builder.Services.AddScoped<IItemProdutoService, ItemProdutoService>();
builder.Services.AddScoped<IItemServicoRepository, ItemServicoRepository>();
builder.Services.AddScoped<IItemServicoService, ItemServicoService>();
builder.Services.AddScoped<IConfiguracaoRepository, ConfiguracaoRepository>();
builder.Services.AddScoped<IConfiguracaoService, ConfiguracaoService>();
builder.Services.AddScoped<IUsuarioRepository, UsuarioRepository>();
builder.Services.AddScoped<IUsuarioService, UsuarioService>();
builder.Services.AddScoped<ISyncService, SyncService>();
builder.Services.AddScoped<IMetricasRepository, MetricasRepository>();
builder.Services.AddScoped<IMetricasService, MetricasService>();
builder.Services.AddScoped<IOrcamentoRepository, OrcamentoRepository>();
builder.Services.AddScoped<IOrcamentoService, OrcamentoService>();

var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtSecret = jwtSection["Secret"] ?? throw new InvalidOperationException("JWT secret not configured.");
var jwtIssuer = jwtSection["Issuer"];
var jwtAudience = jwtSection["Audience"];
// Falha no startup em vez de subir com validação enfraquecida.
if (Encoding.UTF8.GetByteCount(jwtSecret) < 32)
    throw new InvalidOperationException("JWT secret deve ter pelo menos 32 bytes.");
if (string.IsNullOrWhiteSpace(jwtIssuer) || string.IsNullOrWhiteSpace(jwtAudience))
    throw new InvalidOperationException("JWT Issuer e Audience devem ser configurados.");
var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));

builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = true;
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = signingKey,
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(2)
        };
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                if (!await TokenRevalidator.IsValidAsync(db, context.Principal!, context.HttpContext.RequestAborted))
                {
                    context.Fail("Sessao revogada.");
                }
            }
        };
    });

// Telas e ações de gestão são do Dono; o Agente usa só o app (sync e agenda).
builder.Services.AddAuthorization(options =>
    options.AddPolicy(Policies.Dono, policy => policy.RequireClaim("perfil", "Dono")));

// Limites por IP contra força bruta e abuso; a Descarga é limitada por usuário.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, ct) =>
        await context.HttpContext.Response.WriteAsJsonAsync(new ApiResponse
        {
            Success = false,
            Message = "Muitas tentativas. Aguarde alguns minutos e tente novamente."
        }, ct);

    options.AddPolicy(RateLimits.Login, http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "desconhecido",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(5) }));

    options.AddPolicy(RateLimits.Register, http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "desconhecido",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromHours(1) }));

    options.AddPolicy(RateLimits.Sync, http => RateLimitPartition.GetFixedWindowLimiter(
        http.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? http.Connection.RemoteIpAddress?.ToString() ?? "desconhecido",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1) }));
});

// Origens liberadas vêm da configuração (Cors:AllowedOrigins); em produção,
// o domínio da Cloudflare Pages é passado por variável de ambiente. Cada item
// aceita várias origens separadas por vírgula; espaços e "/" final são
// removidos, porque o navegador envia a origem sem barra.
var allowedOrigins = (builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [])
    .SelectMany(o => o.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
    .Select(o => o.TrimEnd('/'))
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Web", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Em produção a API roda atrás do proxy do Render, que termina o TLS; confia nos
// cabeçalhos X-Forwarded-* para o esquema HTTPS e o IP real do cliente. Usa só a
// última entrada (ForwardLimit = 1), que é a adicionada pelo proxy: valores
// forjados pelo cliente ficam à esquerda e não burlam o rate limit por IP.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = 1;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(365);
    options.IncludeSubDomains = true;
});

// SELECT 1 em vez de só abrir conexão: gera atividade real no banco, o que
// também evita a pausa por inatividade do Supabase Free (DEC-30, DEC-32).
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>(customTestQuery: async (db, ct) =>
    {
        await db.Database.ExecuteSqlRawAsync("SELECT 1", ct);
        return true;
    });

var app = builder.Build();

app.Logger.LogInformation("CORS liberado para: {Origins}",
    allowedOrigins.Length > 0 ? string.Join(", ", allowedOrigins) : "(nenhuma origem)");

app.UseForwardedHeaders();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseHsts();
}

// A API só devolve JSON: nada dela deve ser interpretado como HTML nem embutido.
app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "DENY";
    headers["Referrer-Policy"] = "no-referrer";
    headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
    await next();
});

app.UseHttpsRedirection();
app.UseCors("Web");
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
app.MapHealthChecks("/health");
app.MapControllers();

app.Run();
