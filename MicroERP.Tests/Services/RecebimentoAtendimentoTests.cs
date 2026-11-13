using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories;
using MicroERP.Api.Services;

namespace MicroERP.Tests.Services;

// Cobrança mínima do atendimento (TASKS L5): pago ou a receber, com data e forma.
public sealed class RecebimentoAtendimentoTests
{
    private static async Task<AppDbContext> Contexto()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options);
        db.Clientes.Add(new Cliente { Id = 1, Uuid = Guid.NewGuid(), Nome = "Maria", Cpf = "1", EmpresaId = 1 });
        db.Atendimentos.AddRange(
            Atendimento(1, StatusAtendimento.Concluido, 350m),
            Atendimento(2, StatusAtendimento.Concluido, 150m),
            Atendimento(3, StatusAtendimento.Pendente, 900m),
            Atendimento(4, StatusAtendimento.Cancelado, 200m),
            Atendimento(5, StatusAtendimento.Concluido, 999m, empresaId: 2));
        await db.SaveChangesAsync();
        return db;
    }

    private static Atendimento Atendimento(long id, StatusAtendimento status, decimal valor, long empresaId = 1) => new()
    {
        Id = id, Uuid = Guid.NewGuid(), EmpresaId = empresaId, UsuarioId = 1, ClienteId = 1,
        Status = status, ValorTotal = valor, DataRegistro = DateTime.UtcNow.AddDays(-id),
    };

    private static AtendimentoService Servico(AppDbContext db) =>
        new(new AtendimentoRepository(db), new ClienteRepository(db), new ItemProdutoRepository(db), new ItemServicoRepository(db),
            new ProdutoRepository(db), new ConfiguracaoRepository(db), new UsuarioRepository(db));

    [Fact]
    public async Task AReceber_SaoOsConcluidosSemPagamento_DaPropriaEmpresa()
    {
        await using var db = await Contexto();

        var contagem = await Servico(db).ContarPorStatusAsync(1, CancellationToken.None);

        Assert.Equal(2, contagem.AReceber);
        Assert.Equal(500m, contagem.ValorAReceber);
    }

    [Fact]
    public async Task RegistrarRecebimento_TiraDoAReceber_EAparecemNoFiltroDePagos()
    {
        await using var db = await Contexto();
        var servico = Servico(db);

        var pago = await servico.RegistrarRecebimentoAsync(1, 1,
            new AtendimentoRecebimentoRequest { PagoEm = new DateOnly(2026, 11, 13), Forma = FormaRecebimento.Pix }, CancellationToken.None);

        Assert.Equal(new DateOnly(2026, 11, 13), pago.PagoEm);
        Assert.Equal(FormaRecebimento.Pix, pago.FormaPagamento);
        Assert.Equal("Maria", pago.ClienteNome);
        var contagem = await servico.ContarPorStatusAsync(1, CancellationToken.None);
        Assert.Equal((1, 150m), (contagem.AReceber, contagem.ValorAReceber));

        var aReceber = await servico.GetPaginaAsync(1, new PaginacaoQuery(), new AtendimentoFiltroQuery { Recebimento = "areceber" }, CancellationToken.None);
        Assert.Equal([2L], aReceber.Itens.Select(a => a.Id).ToList());
        var pagos = await servico.GetPaginaAsync(1, new PaginacaoQuery(), new AtendimentoFiltroQuery { Recebimento = "pago" }, CancellationToken.None);
        Assert.Equal([1L], pagos.Itens.Select(a => a.Id).ToList());
    }

    [Fact]
    public async Task SemData_VoltaParaAReceber_ELimpaAForma()
    {
        await using var db = await Contexto();
        var servico = Servico(db);
        await servico.RegistrarRecebimentoAsync(1, 1, new AtendimentoRecebimentoRequest { PagoEm = new DateOnly(2026, 11, 13), Forma = FormaRecebimento.Dinheiro }, CancellationToken.None);

        var voltou = await servico.RegistrarRecebimentoAsync(1, 1, new AtendimentoRecebimentoRequest { PagoEm = null }, CancellationToken.None);

        Assert.Null(voltou.PagoEm);
        Assert.Null(voltou.FormaPagamento);
    }

    [Fact]
    public async Task Recusa_Cancelado_SemForma_EDeOutraEmpresa()
    {
        await using var db = await Contexto();
        var servico = Servico(db);
        var hoje = new DateOnly(2026, 11, 13);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            servico.RegistrarRecebimentoAsync(1, 4, new AtendimentoRecebimentoRequest { PagoEm = hoje, Forma = FormaRecebimento.Pix }, CancellationToken.None));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            servico.RegistrarRecebimentoAsync(1, 1, new AtendimentoRecebimentoRequest { PagoEm = hoje }, CancellationToken.None));
        await Assert.ThrowsAsync<MicroERP.Api.Services.Exceptions.NotFoundException>(() =>
            servico.RegistrarRecebimentoAsync(1, 5, new AtendimentoRecebimentoRequest { PagoEm = hoje, Forma = FormaRecebimento.Pix }, CancellationToken.None));
    }
}
