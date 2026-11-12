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

// "Esqueci a senha" do Dono (DEC-54).
public sealed class RedefinicaoSenhaServiceTests
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
    public async Task Solicitar_DonoAtivo_GuardaSoOHashEEnviaOLink()
    {
        await using var db = await Seed();
        var fila = new FilaFalsa();

        await Servico(db, fila).SolicitarAsync(new EsqueciSenhaRequest { Email = " Dono@Teste.com " }, CancellationToken.None);

        var email = Assert.Single(fila.Enviados);
        Assert.Equal("dono@teste.com", email.ParaEmail);
        var token = TokenDoLink(email.Texto);
        Assert.Contains($"https://agesto.exemplo/redefinir-senha#token={token}", email.Texto);

        var registro = await db.TokensRedefinicaoSenha.SingleAsync();
        Assert.NotEqual(token, registro.TokenHash);
        Assert.Equal(RedefinicaoSenhaService.Hash(token), registro.TokenHash);
        Assert.InRange(registro.ExpiraEm - registro.CreatedAt, TimeSpan.FromMinutes(14.9), TimeSpan.FromMinutes(15.1));
    }

    [Theory]
    [InlineData("ninguem@teste.com")]   // não existe
    [InlineData("agente@teste.com")]    // Agente: a senha vem do Dono
    [InlineData("inativo@teste.com")]   // desativado
    [InlineData("bloqueada@teste.com")] // empresa suspensa pela equipe do Agesto
    public async Task Solicitar_ForaDoPublico_NaoGeraNemEnvia(string email)
    {
        await using var db = await Seed();
        var fila = new FilaFalsa();

        await Servico(db, fila).SolicitarAsync(new EsqueciSenhaRequest { Email = email }, CancellationToken.None);

        Assert.Empty(fila.Enviados);
        Assert.Empty(db.TokensRedefinicaoSenha);
    }

    [Fact]
    public async Task Solicitar_DeNovoLogoEmSeguida_NaoEnviaOutroEmail()
    {
        await using var db = await Seed();
        var fila = new FilaFalsa();
        var servico = Servico(db, fila);

        await servico.SolicitarAsync(new EsqueciSenhaRequest { Email = "dono@teste.com" }, CancellationToken.None);
        await servico.SolicitarAsync(new EsqueciSenhaRequest { Email = "dono@teste.com" }, CancellationToken.None);

        Assert.Single(fila.Enviados);
        Assert.Single(db.TokensRedefinicaoSenha);
    }

    [Fact]
    public async Task Solicitar_DepoisDoIntervalo_OLinkAntigoDeixaDeValer()
    {
        await using var db = await Seed();
        var fila = new FilaFalsa();
        var servico = Servico(db, fila);
        await servico.SolicitarAsync(new EsqueciSenhaRequest { Email = "dono@teste.com" }, CancellationToken.None);
        var antigo = TokenDoLink(fila.Enviados[0].Texto);
        (await db.TokensRedefinicaoSenha.SingleAsync()).CreatedAt = DateTime.UtcNow.AddMinutes(-3);
        await db.SaveChangesAsync();

        await servico.SolicitarAsync(new EsqueciSenhaRequest { Email = "dono@teste.com" }, CancellationToken.None);

        Assert.Equal(2, fila.Enviados.Count);
        await Assert.ThrowsAsync<TokenRedefinicaoInvalidoException>(() =>
            servico.RedefinirAsync(new RedefinirSenhaRequest { Token = antigo, NovaSenha = "SenhaNova9" }, CancellationToken.None));
        await servico.RedefinirAsync(
            new RedefinirSenhaRequest { Token = TokenDoLink(fila.Enviados[1].Texto), NovaSenha = "SenhaNova9" }, CancellationToken.None);
    }

    [Fact]
    public async Task Redefinir_TrocaASenhaDesbloqueiaEOLinkSoServeUmaVez()
    {
        await using var db = await Seed();
        var dono = await db.Usuarios.SingleAsync(u => u.Email == "dono@teste.com");
        dono.TentativasLoginFalhas = 3;
        dono.BloqueadoAte = DateTime.UtcNow.AddMinutes(10);
        dono.DeveTrocarSenha = true;
        await db.SaveChangesAsync();
        var fila = new FilaFalsa();
        var servico = Servico(db, fila);
        await servico.SolicitarAsync(new EsqueciSenhaRequest { Email = "dono@teste.com" }, CancellationToken.None);
        var token = TokenDoLink(fila.Enviados[0].Texto);

        await servico.RedefinirAsync(new RedefinirSenhaRequest { Token = token, NovaSenha = "SenhaNova9" }, CancellationToken.None);

        dono = await db.Usuarios.SingleAsync(u => u.Email == "dono@teste.com");
        Assert.Equal(PasswordVerificationResult.Success, new PasswordHasher<Usuario>().VerifyHashedPassword(dono, dono.Senha, "SenhaNova9"));
        Assert.Equal(0, dono.TentativasLoginFalhas);
        Assert.Null(dono.BloqueadoAte);
        Assert.False(dono.DeveTrocarSenha);
        Assert.NotNull((await db.TokensRedefinicaoSenha.SingleAsync()).UsadoEm);

        await Assert.ThrowsAsync<TokenRedefinicaoInvalidoException>(() =>
            servico.RedefinirAsync(new RedefinirSenhaRequest { Token = token, NovaSenha = "OutraSenha9" }, CancellationToken.None));
    }

    [Fact]
    public async Task Redefinir_LinkVencidoOuInventado_Recusa()
    {
        await using var db = await Seed();
        var fila = new FilaFalsa();
        var servico = Servico(db, fila);
        await servico.SolicitarAsync(new EsqueciSenhaRequest { Email = "dono@teste.com" }, CancellationToken.None);
        var token = TokenDoLink(fila.Enviados[0].Texto);
        (await db.TokensRedefinicaoSenha.SingleAsync()).ExpiraEm = DateTime.UtcNow.AddSeconds(-1);
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<TokenRedefinicaoInvalidoException>(() =>
            servico.RedefinirAsync(new RedefinirSenhaRequest { Token = token, NovaSenha = "SenhaNova9" }, CancellationToken.None));
        await Assert.ThrowsAsync<TokenRedefinicaoInvalidoException>(() =>
            servico.RedefinirAsync(new RedefinirSenhaRequest { Token = "inventado", NovaSenha = "SenhaNova9" }, CancellationToken.None));
    }

    [Fact]
    public async Task Redefinir_UsuarioDesativadoDepoisDoPedido_Recusa()
    {
        await using var db = await Seed();
        var fila = new FilaFalsa();
        var servico = Servico(db, fila);
        await servico.SolicitarAsync(new EsqueciSenhaRequest { Email = "dono@teste.com" }, CancellationToken.None);
        (await db.Usuarios.SingleAsync(u => u.Email == "dono@teste.com")).Ativo = false;
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<TokenRedefinicaoInvalidoException>(() =>
            servico.RedefinirAsync(
                new RedefinirSenhaRequest { Token = TokenDoLink(fila.Enviados[0].Texto), NovaSenha = "SenhaNova9" },
                CancellationToken.None));
    }

    private static string TokenDoLink(string texto) =>
        Regex.Match(texto, @"#token=([A-Za-z0-9_\-]+)").Groups[1].Value;

    private static RedefinicaoSenhaService Servico(AppDbContext db, IFilaDeEmails fila)
    {
        var ambiente = new Mock<IHostEnvironment>();
        ambiente.SetupGet(a => a.EnvironmentName).Returns("Production");
        return new RedefinicaoSenhaService(
            db,
            fila,
            Options.Create(new EmailOptions { UrlWeb = "https://agesto.exemplo/" }),
            NullLogger<RedefinicaoSenhaService>.Instance,
            ambiente.Object);
    }

    private static async Task<AppDbContext> Seed()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.Empresas.AddRange(new Empresa { Id = 1, Nome = "Ativa" }, new Empresa { Id = 2, Nome = "Suspensa", Ativa = false });
        var hasher = new PasswordHasher<Usuario>();
        Usuario U(long id, string email, PerfilUsuario perfil, long empresa = 1, bool ativo = true)
        {
            var u = new Usuario { Id = id, Nome = "Fulano", Email = email, EmpresaId = empresa, Perfil = perfil, Ativo = ativo };
            u.Senha = hasher.HashPassword(u, "SenhaAntiga1");
            return u;
        }
        db.Usuarios.AddRange(
            U(1, "dono@teste.com", PerfilUsuario.Dono),
            U(2, "agente@teste.com", PerfilUsuario.Agente),
            U(3, "inativo@teste.com", PerfilUsuario.Dono, ativo: false),
            U(4, "bloqueada@teste.com", PerfilUsuario.Dono, empresa: 2));
        await db.SaveChangesAsync();
        return db;
    }
}
