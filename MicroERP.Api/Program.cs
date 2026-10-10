using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Repositories;
using MicroERP.Api.Repositories.Interfaces;
using MicroERP.Api.Services;
using MicroERP.Api.Services.Interfaces;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var errors = context.ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => string.IsNullOrWhiteSpace(e.ErrorMessage) ? "Requisição inválida." : e.ErrorMessage)
                .ToList();

            return new BadRequestObjectResult(new ApiResponse
            {
                Success = false,
                Message = "Falha de validação.",
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
var jwtIssuer = jwtSection["Issuer"] ?? string.Empty;
var jwtAudience = jwtSection["Audience"] ?? string.Empty;
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
            ValidateIssuer = !string.IsNullOrWhiteSpace(jwtIssuer),
            ValidIssuer = jwtIssuer,
            ValidateAudience = !string.IsNullOrWhiteSpace(jwtAudience),
            ValidAudience = jwtAudience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(2)
        };
    });

builder.Services.AddAuthorization();

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
// cabeçalhos X-Forwarded-* para o esquema HTTPS e o IP real do cliente.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
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

app.UseHttpsRedirection();
app.UseCors("Web");
app.UseAuthentication();
app.UseAuthorization();
app.MapHealthChecks("/health");
app.MapControllers();

app.Run();
