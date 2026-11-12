using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Services;
using MicroERP.Api.Services.Email;
using MicroERP.Api.Services.Exceptions;

namespace MicroERP.Tests.Services;

// Convites por email e criação da senha pelo link (DEC-55).
public sealed class ConviteServiceTests
{
    private sealed class FilaFalsa : IFilaDeEmails
    {
        public List<EmailMensagem> Enviados { get; } = [];
        public bool Enfileirar(EmailMensagem mensagem)
        {
            Enviados.Add(mensagem);
            return true;
        }
    }

    [Fact]
    public async Task ConviteDeAgente_Link72HorasParaCriarSenhaEDepoisOApp()
    {
        await using var db = await Seed();
        var fila = new FilaFalsa();
        var carla = await db.Usuarios.SingleAsync(u => u.Id == 2);

        await Convites(db, fila).EnviarParaUsuarioAsync(carla, CancellationToken.None);

        var email = Assert.Single(fila.Enviados);
        Assert.Equal("carla@teste.com", email.ParaEmail);
        Assert.Contains("Refrigeração", email.Assunto);
        Assert.Contains("https://agesto.exemplo/criar-senha#token=", email.Texto);
        Assert.Contains("https://agesto.exemplo/baixar", email.Texto);
        Assert.Contains("72 horas", email.Texto);

        var token = await db.TokensRedefinicaoSenha.SingleAsync();
        Assert.Equal(TipoTokenSenha.Convite, token.Tipo);
        Assert.Equal(2, token.UsuarioId);
        Assert.Null(token.AdminId);
        Assert.InRange(token.ExpiraEm - token.CreatedAt, TimeSpan.FromHours(71.9), TimeSpan.FromHours(72.1));
    }

    [Fact]
    public async Task ConviteUsado_CriaASenhaConfirmaOEmailEDeixaEntrar()
    {
        await using var db = await Seed();
        var fila = new FilaFalsa();
        var carla = await db.Usuarios.SingleAsync(u => u.Id == 2);
        await Convites(db, fila).EnviarParaUsuarioAsync(carla, CancellationToken.None);

        var perfil = await Senhas(db).RedefinirAsync(
            new RedefinirSenhaRequest { Token = Token(fila.Enviados[0].Texto), NovaSenha = "SenhaDaCarla1" }, CancellationToken.None);

        Assert.Equal(PerfilUsuario.Agente, perfil);
        carla = await db.Usuarios.SingleAsync(u => u.Id == 2);
        Assert.NotNull(carla.EmailConfirmadoEm);
        Assert.Equal(PasswordVerificationResult.Success,
            new PasswordHasher<Usuario>().VerifyHashedPassword(carla, carla.Senha, "SenhaDaCarla1"));
    }

    [Fact]
    public async Task QuemJaTemAcesso_RecebeOEmailDeSenhaNovaENaoOBoasVindas()
    {
        await using var db = await Seed();
        var fila = new FilaFalsa();
        var dono = await db.Usuarios.SingleAsync(u => u.Id == 1);

        await Convites(db, fila).EnviarParaUsuarioAsync(dono, CancellationToken.None);

        var email = Assert.Single(fila.Enviados);
        Assert.Equal("Crie uma senha nova para o Agesto", email.Assunto);
    }

    [Fact]
    public async Task ConviteNovo_InvalidaOAnterior()
    {
        await using var db = await Seed();
        var fila = new FilaFalsa();
        var convites = Convites(db, fila);
        var carla = await db.Usuarios.SingleAsync(u => u.Id == 2);
        await convites.EnviarParaUsuarioAsync(carla, CancellationToken.None);
        await convites.EnviarParaUsuarioAsync(carla, CancellationToken.None);

        await Assert.ThrowsAsync<TokenRedefinicaoInvalidoException>(() => Senhas(db).RedefinirAsync(
            new RedefinirSenhaRequest { Token = Token(fila.Enviados[0].Texto), NovaSenha = "SenhaDaCarla1" }, CancellationToken.None));
        await Senhas(db).RedefinirAsync(
            new RedefinirSenhaRequest { Token = Token(fila.Enviados[1].Texto), NovaSenha = "SenhaDaCarla1" }, CancellationToken.None);
    }

    [Fact]
    public async Task ConviteDeAdmin_LinkDaAreaDeAdminESoServeParaAdmin()
    {
        await using var db = await Seed();
        var fila = new FilaFalsa();
        var admin = new AdminPlataforma { Nome = "Nova", Email = "nova@agesto.com", Senha = "x" };
        db.AdminsPlataforma.Add(admin);
        await db.SaveChangesAsync();

        await Convites(db, fila).EnviarParaAdminAsync(admin, CancellationToken.None);

        var email = Assert.Single(fila.Enviados);
        Assert.Contains("https://agesto.exemplo/admin/criar-senha#token=", email.Texto);
        var token = Token(email.Texto);

        // Link de admin não cria senha de usuário de empresa.
        await Assert.ThrowsAsync<TokenRedefinicaoInvalidoException>(() => Senhas(db).RedefinirAsync(
            new RedefinirSenhaRequest { Token = token, NovaSenha = "SenhaNova9" }, CancellationToken.None));

        await Senhas(db).CriarSenhaAdminAsync(new AdminCriarSenhaRequest { Token = token, NovaSenha = "senha-bem-longa-123" }, CancellationToken.None);
        admin = await db.AdminsPlataforma.SingleAsync();
        Assert.NotNull(admin.EmailConfirmadoEm);
        Assert.Equal(PasswordVerificationResult.Success,
            new PasswordHasher<AdminPlataforma>().VerifyHashedPassword(admin, admin.Senha, "senha-bem-longa-123"));
        Assert.Contains(db.AuditoriasAdmin, a => a.Acao == "criar-senha" && a.AdminId == admin.Id);

        // Uso único.
        await Assert.ThrowsAsync<TokenRedefinicaoInvalidoException>(() => Senhas(db).CriarSenhaAdminAsync(
            new AdminCriarSenhaRequest { Token = token, NovaSenha = "outra-senha-longa-1" }, CancellationToken.None));
    }

    [Fact]
    public async Task LinkDeUsuario_NaoCriaSenhaDeAdmin()
    {
        await using var db = await Seed();
        var fila = new FilaFalsa();
        await Convites(db, fila).EnviarParaUsuarioAsync(await db.Usuarios.SingleAsync(u => u.Id == 2), CancellationToken.None);

        await Assert.ThrowsAsync<TokenRedefinicaoInvalidoException>(() => Senhas(db).CriarSenhaAdminAsync(
            new AdminCriarSenhaRequest { Token = Token(fila.Enviados[0].Texto), NovaSenha = "senha-bem-longa-123" }, CancellationToken.None));
    }

    private static string Token(string texto) => Regex.Match(texto, @"#token=([A-Za-z0-9_\-]+)").Groups[1].Value;

    private static IHostEnvironment Producao()
    {
        var ambiente = new Mock<IHostEnvironment>();
        ambiente.SetupGet(a => a.EnvironmentName).Returns("Production");
        return ambiente.Object;
    }

    private static readonly IOptions<EmailOptions> Opcoes = Options.Create(new EmailOptions { UrlWeb = "https://agesto.exemplo/" });

    private static ConviteService Convites(AppDbContext db, IFilaDeEmails fila) =>
        new(db, fila, Opcoes, NullLogger<ConviteService>.Instance, Producao());

    private static RedefinicaoSenhaService Senhas(AppDbContext db) =>
        new(db, new FilaFalsa(), Opcoes, NullLogger<RedefinicaoSenhaService>.Instance, Producao());

    private static async Task<AppDbContext> Seed()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.Empresas.Add(new Empresa { Id = 1, Nome = "Refrigeração" });
        db.Usuarios.AddRange(
            new Usuario { Id = 1, Nome = "Dono", Email = "dono@teste.com", Senha = "x", EmpresaId = 1, Perfil = PerfilUsuario.Dono, EmailConfirmadoEm = DateTime.UtcNow },
            new Usuario { Id = 2, Nome = "Carla", Email = "carla@teste.com", Senha = "x", EmpresaId = 1, Perfil = PerfilUsuario.Agente });
        await db.SaveChangesAsync();
        return db;
    }
}
