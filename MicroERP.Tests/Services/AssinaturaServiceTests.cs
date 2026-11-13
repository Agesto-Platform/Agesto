using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories;
using MicroERP.Api.Services;
using MicroERP.Api.Services.Exceptions;

namespace MicroERP.Tests.Services;

// Controle de assinatura e licenças (DEC-58).
public sealed class AssinaturaServiceTests
{
    // 13/11/2026 ao meio-dia em Brasília.
    private static readonly DateOnly Hoje = new(2026, 11, 13);
    private readonly RelogioFixo _relogio = new(new DateTimeOffset(2026, 11, 13, 15, 0, 0, TimeSpan.Zero));

    [Theory]
    [InlineData(null, SituacaoAssinatura.SemCobranca)]
    [InlineData(30, SituacaoAssinatura.EmDia)]
    [InlineData(5, SituacaoAssinatura.VenceEmBreve)]
    [InlineData(0, SituacaoAssinatura.VenceEmBreve)]
    [InlineData(-1, SituacaoAssinatura.EmCarencia)]
    [InlineData(-10, SituacaoAssinatura.EmCarencia)]
    [InlineData(-11, SituacaoAssinatura.Atrasada)]
    public void Calcular_SituacaoPeloPagoAte(int? diasAteVencer, SituacaoAssinatura esperada)
    {
        DateOnly? pagoAte = diasAteVencer is null ? null : Hoje.AddDays(diasAteVencer.Value);
        Assert.Equal(esperada, AssinaturaService.Calcular(pagoAte, Hoje).Situacao);
    }

    [Fact]
    public void Calcular_NaCarenciaDizQuantosDiasFaltamParaOBloqueio()
    {
        var (_, _, atraso, paraBloqueio) = AssinaturaService.Calcular(Hoje.AddDays(-3), Hoje);
        Assert.Equal(3, atraso);
        Assert.Equal(8, paraBloqueio);
    }

    [Theory]
    [InlineData(1, 49.90)]
    [InlineData(2, 69.80)]
    [InlineData(4, 109.60)]
    public void ValorMensal_AssinaturaMaisLicencasExtras(int licencas, decimal valor) =>
        Assert.Equal(valor, AssinaturaService.ValorMensal(licencas));

    [Fact]
    public async Task RegistrarPagamento_SemHistoricoCobreUmMesAPartirDeHoje_EComHistoricoContinuaDoUltimoDia()
    {
        await using var db = await Contexto();
        var servico = Servico(db);

        var primeira = await servico.RegistrarPagamentoAsync(9, 1, Pagamento(), null, CancellationToken.None);
        Assert.Equal(new DateOnly(2026, 12, 12), primeira.PagoAte);
        Assert.Equal(SituacaoAssinatura.EmDia, primeira.Situacao);

        var segunda = await servico.RegistrarPagamentoAsync(9, 1, Pagamento(meses: 2), null, CancellationToken.None);
        Assert.Equal(new DateOnly(2027, 2, 12), segunda.PagoAte);
        Assert.Equal(2, segunda.Pagamentos.Count);
        Assert.Equal(new DateOnly(2026, 12, 13), segunda.Pagamentos[0].PeriodoInicio);
        Assert.Contains(db.AuditoriasAdmin, a => a.Acao == "registrar-pagamento" && a.EmpresaId == 1);
    }

    [Fact]
    public async Task BloquearAtrasadas_SoDepoisDosDezDiasDeCarencia_ESemCobrancaNuncaBloqueia()
    {
        await using var db = await Contexto();
        db.Empresas.AddRange(
            new Empresa { Id = 2, Nome = "Carência", PagoAte = Hoje.AddDays(-10) },
            new Empresa { Id = 3, Nome = "Atrasada", PagoAte = Hoje.AddDays(-11) },
            new Empresa { Id = 4, Nome = "Sem cobrança", PagoAte = null });
        await db.SaveChangesAsync();

        var bloqueadas = await Servico(db).BloquearAtrasadasAsync(CancellationToken.None);

        Assert.Equal(1, bloqueadas);
        var atrasada = await db.Empresas.SingleAsync(e => e.Id == 3);
        Assert.False(atrasada.Ativa);
        Assert.True(atrasada.BloqueioAutomatico);
        Assert.Contains("10 dias de carência", atrasada.MotivoBloqueio);
        Assert.True((await db.Empresas.SingleAsync(e => e.Id == 2)).Ativa);
        Assert.True((await db.Empresas.SingleAsync(e => e.Id == 4)).Ativa);
        Assert.Contains(db.AuditoriasAdmin, a => a.Acao == "bloqueio-automatico" && a.EmpresaId == 3 && a.AdminId == null);
    }

    [Fact]
    public async Task DesbloqueioManual_ARotinaNaoBloqueiaDeNovoNoMesmoPeriodo()
    {
        await using var db = await Contexto();
        db.Empresas.Add(new Empresa { Id = 3, Nome = "Atrasada", PagoAte = Hoje.AddDays(-20) });
        await db.SaveChangesAsync();
        var servico = Servico(db);
        await servico.BloquearAtrasadasAsync(CancellationToken.None);

        // A equipe desbloqueia na mão (ex.: pagamento prometido).
        var admin = new AdminEmpresaService(db, new AuthService(db, new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build()),
            new ConvitesFalsos(), servico, _relogio);
        await admin.DesbloquearAsync(9, 3, null, CancellationToken.None);

        Assert.Equal(0, await servico.BloquearAtrasadasAsync(CancellationToken.None));
        Assert.True((await db.Empresas.SingleAsync(e => e.Id == 3)).Ativa);
    }

    [Fact]
    public async Task Pagamento_TiraOBloqueioAutomatico_MasNaoOManual()
    {
        await using var db = await Contexto();
        db.Empresas.AddRange(
            new Empresa { Id = 3, Nome = "Automático", PagoAte = Hoje.AddDays(-20) },
            new Empresa { Id = 4, Nome = "Manual", PagoAte = Hoje.AddDays(-20), Ativa = false, MotivoBloqueio = "Fraude" });
        await db.SaveChangesAsync();
        var servico = Servico(db);
        await servico.BloquearAtrasadasAsync(CancellationToken.None);

        // 20 dias de atraso: um mês pago cobre até daqui a 10 dias.
        var automatica = await servico.RegistrarPagamentoAsync(9, 3, Pagamento(), null, CancellationToken.None);
        var manual = await servico.RegistrarPagamentoAsync(9, 4, Pagamento(), null, CancellationToken.None);

        Assert.True(automatica.Ativa);
        Assert.False(manual.Ativa);
    }

    [Fact]
    public async Task GarantirLicenca_DonoMaisLicencas_ContaAtivosEConvitesPendentes()
    {
        await using var db = await Contexto();
        db.Usuarios.AddRange(
            Usuario(1, "dono@x.com", PerfilUsuario.Dono),
            Usuario(2, "agente@x.com", PerfilUsuario.Agente),
            Usuario(3, "inativo@x.com", PerfilUsuario.Agente, ativo: false));
        await db.SaveChangesAsync();
        var servico = Servico(db);

        // Licença padrão: 1 funcionário. Dono + 1 agente ativo = cheio.
        var ex = await Assert.ThrowsAsync<RegraUsuarioException>(() => servico.GarantirLicencaAsync(1, CancellationToken.None));
        Assert.Contains("fale com a equipe do Agesto", ex.Message);

        await servico.AtualizarAsync(9, 1, new AssinaturaAtualizarRequest { LicencasFuncionarios = 2 }, null, CancellationToken.None);
        await servico.GarantirLicencaAsync(1, CancellationToken.None);
    }

    [Fact]
    public async Task UsuarioService_DonoNaoPassaDoContratado_NemReativando()
    {
        await using var db = await Contexto();
        db.Usuarios.AddRange(
            Usuario(1, "dono@x.com", PerfilUsuario.Dono),
            Usuario(2, "agente@x.com", PerfilUsuario.Agente),
            Usuario(3, "inativo@x.com", PerfilUsuario.Agente, ativo: false));
        await db.SaveChangesAsync();
        var usuarios = new UsuarioService(new UsuarioRepository(db), new ConvitesFalsos(), Servico(db));

        await Assert.ThrowsAsync<RegraUsuarioException>(() => usuarios.CreateAsync(1,
            new UsuarioCreateRequest { Nome = "Novo", Email = "novo@x.com", Perfil = PerfilUsuario.Agente }, CancellationToken.None));
        await Assert.ThrowsAsync<RegraUsuarioException>(() => usuarios.SetAtivoAsync(1, 1, 3, true, CancellationToken.None));

        // Desativar sempre pode, e libera a vaga.
        await usuarios.SetAtivoAsync(1, 1, 2, false, CancellationToken.None);
        await usuarios.SetAtivoAsync(1, 1, 3, true, CancellationToken.None);
    }

    private AssinaturaService Servico(AppDbContext db) => new(db, _relogio);

    private static PagamentoAssinaturaRequest Pagamento(int meses = 1) =>
        new() { Valor = 49.90m, PagoEm = Hoje, Forma = FormaPagamento.Pix, Meses = meses };

    private static Usuario Usuario(long id, string email, PerfilUsuario perfil, bool ativo = true) =>
        new() { Id = id, Nome = email, Email = email, Senha = "x", EmpresaId = 1, Perfil = perfil, Ativo = ativo };

    private static async Task<AppDbContext> Contexto()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options);
        db.Empresas.Add(new Empresa { Id = 1, Nome = "Empresa" });
        await db.SaveChangesAsync();
        return db;
    }

    private sealed class RelogioFixo(DateTimeOffset agora) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => agora;
    }
}
