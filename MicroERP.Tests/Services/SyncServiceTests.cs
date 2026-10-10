using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.EntityFrameworkCore.Diagnostics;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories;
using MicroERP.Api.Services;

namespace MicroERP.Tests.Services;

public sealed class SyncServiceTests
{
    [Fact]
    public async Task CargaAsync_TrazOrcamentosAtualizadosDaEmpresaComItens()
    {
        await using var db = CreateContext();
        var antiga = DateTime.UtcNow.AddDays(-10);

        // Recente, empresa 1 -> deve vir (com item)
        db.Orcamentos.Add(new Orcamento
        {
            Id = 1,
            Uuid = Guid.NewGuid(),
            EmpresaId = 1,
            UsuarioId = 1,
            ClienteId = 1,
            Status = StatusOrcamento.Enviado,
            DataRegistro = DateTime.UtcNow,
            ValorTotal = 100m,
            UpdatedAt = DateTime.UtcNow,
            Itens = new List<ItemOrcamento>
            {
                new() { Uuid = Guid.NewGuid(), ServicoId = 5, Quantidade = 1, PrecoUnitario = 100m, Subtotal = 100m }
            }
        });
        // Antigo (antes do 'desde') -> nao vem
        db.Orcamentos.Add(new Orcamento { Id = 2, Uuid = Guid.NewGuid(), EmpresaId = 1, UsuarioId = 1, ClienteId = 1, Status = StatusOrcamento.Rascunho, DataRegistro = antiga, ValorTotal = 50m, UpdatedAt = antiga });
        // Outra empresa -> nao vem
        db.Orcamentos.Add(new Orcamento { Id = 3, Uuid = Guid.NewGuid(), EmpresaId = 2, UsuarioId = 1, ClienteId = 1, Status = StatusOrcamento.Enviado, DataRegistro = DateTime.UtcNow, ValorTotal = 999m, UpdatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var service = BuildSync(db);
        var carga = await service.CargaAsync(1, DateTime.UtcNow.AddDays(-1), CancellationToken.None);

        Assert.Single(carga.Orcamentos);
        Assert.Equal(1, carga.Orcamentos[0].Id);
        Assert.Equal(StatusOrcamento.Enviado, carga.Orcamentos[0].Status);
        Assert.Single(carga.Orcamentos[0].Itens);
        Assert.Equal(5, carga.Orcamentos[0].Itens[0].ServicoId);
    }

    [Fact]
    public async Task CargaAsync_IncluiConfiguracaoDaEmpresa()
    {
        await using var db = CreateContext();
        db.Configuracoes.Add(new Configuracao
        {
            Id = 1,
            EmpresaId = 1,
            TipoOperacao = TipoOperacao.Servico,
            ModoAgendaAgente = ModoAgendaAgente.Fixa,
            ControlaEstoque = false,
        });
        await db.SaveChangesAsync();

        var carga = await BuildSync(db).CargaAsync(1, null, CancellationToken.None);

        Assert.NotNull(carga.Configuracao);
        Assert.Equal(ModoAgendaAgente.Fixa, carga.Configuracao!.ModoAgendaAgente);
        Assert.False(carga.Configuracao.ControlaEstoque);
    }

    [Fact]
    public async Task CargaAsync_SemConfiguracao_RetornaPadraoSeguro()
    {
        await using var db = CreateContext();

        var carga = await BuildSync(db).CargaAsync(1, null, CancellationToken.None);

        Assert.NotNull(carga.Configuracao);
        Assert.Equal(ModoAgendaAgente.Flexivel, carga.Configuracao!.ModoAgendaAgente);
        Assert.True(carga.Configuracao.ControlaEstoque);
    }

    [Fact]
    public async Task CargaAsync_IncluiMateriaisSugeridosDosServicos()
    {
        await using var db = CreateContext();
        db.ServicoItemSugeridos.Add(new ServicoItemSugerido { Id = 1, EmpresaId = 1, ServicoId = 5, ProdutoId = 10, QuantidadePadrao = 2 });
        db.ServicoItemSugeridos.Add(new ServicoItemSugerido { Id = 2, EmpresaId = 2, ServicoId = 9, ProdutoId = 99, QuantidadePadrao = 1 }); // outra empresa
        await db.SaveChangesAsync();

        var carga = await BuildSync(db).CargaAsync(1, null, CancellationToken.None);

        Assert.Single(carga.Sugeridos);
        Assert.Equal(5, carga.Sugeridos[0].ServicoId);
        Assert.Equal(10, carga.Sugeridos[0].ProdutoId);
        Assert.Equal(2, carga.Sugeridos[0].QuantidadePadrao);
    }

    [Fact]
    public async Task DescargaAsync_ModoFixa_IgnoraDataAgendada()
    {
        await using var db = CreateContext();
        db.Configuracoes.Add(new Configuracao { Id = 1, EmpresaId = 1, ModoAgendaAgente = ModoAgendaAgente.Fixa, ControlaEstoque = true });
        SeedCliente(db, id: 1, empresaId: 1);
        await db.SaveChangesAsync();

        var req = new SyncDescargaRequest
        {
            Clientes = [],
            Atendimentos =
            [
                new AtendimentoSyncRequest
                {
                    Uuid = Guid.NewGuid(),
                    DataRegistro = DateTime.UtcNow,
                    DataAgendada = DateTime.UtcNow.AddDays(2),
                    Status = StatusAtendimento.Pendente,
                    ClienteId = 1,
                    ItensProduto = [],
                    ItensServico = [],
                },
            ],
        };

        var res = await BuildSync(db).DescargaAsync(1, 1, req, CancellationToken.None);

        Assert.Equal(1, res.AtendimentosImportados);
        var at = await db.Atendimentos.FirstAsync();
        Assert.Null(at.DataAgendada); // Fixa: agendamento vindo do agente é ignorado no servidor
    }

    [Theory]
    [InlineData(1900)]
    [InlineData(2999)]
    public async Task DescargaAsync_DataRegistroImplausivel_RejeitaAtendimento(int ano)
    {
        await using var db = CreateContext();
        SeedCliente(db, id: 1, empresaId: 1);
        await db.SaveChangesAsync();

        var uuid = Guid.NewGuid();
        var req = new SyncDescargaRequest
        {
            Atendimentos =
            [
                new AtendimentoSyncRequest
                {
                    Uuid = uuid,
                    DataRegistro = new DateTime(ano, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                    Status = StatusAtendimento.Concluido,
                    ClienteId = 1,
                },
            ],
        };

        var res = await BuildSync(db).DescargaAsync(1, 1, req, CancellationToken.None);

        Assert.Equal(0, res.AtendimentosImportados);
        Assert.DoesNotContain(uuid, res.AtendimentosSincronizados);
        Assert.Contains(res.Erros, e => e.Contains("Data de registro inválida."));
    }

    [Fact]
    public async Task DescargaAsync_ModoFlexivel_MantemDataAgendada()
    {
        await using var db = CreateContext();
        db.Configuracoes.Add(new Configuracao { Id = 1, EmpresaId = 1, ModoAgendaAgente = ModoAgendaAgente.Flexivel });
        SeedCliente(db, id: 1, empresaId: 1);
        await db.SaveChangesAsync();

        var req = new SyncDescargaRequest
        {
            Clientes = [],
            Atendimentos =
            [
                new AtendimentoSyncRequest
                {
                    Uuid = Guid.NewGuid(),
                    DataRegistro = DateTime.UtcNow,
                    DataAgendada = DateTime.UtcNow.AddDays(2),
                    Status = StatusAtendimento.Pendente,
                    ClienteId = 1,
                    ItensProduto = [],
                    ItensServico = [],
                },
            ],
        };

        await BuildSync(db).DescargaAsync(1, 1, req, CancellationToken.None);

        var at = await db.Atendimentos.FirstAsync();
        Assert.NotNull(at.DataAgendada); // Flexível: agendamento do agente é preservado
    }

    [Fact]
    public async Task DescargaAsync_Sucesso_GravaItensBaixaEstoqueERetornaUuid()
    {
        await using var db = CreateContext();
        SeedCliente(db, id: 1, empresaId: 1);
        SeedProduto(db, id: 10, empresaId: 1, preco: 25m, estoque: 5);
        await db.SaveChangesAsync();
        var uuid = Guid.NewGuid();

        var res = await BuildSync(db).DescargaAsync(1, 1, Descarga(Atendimento(uuid, clienteId: 1, (10, 2))), CancellationToken.None);

        Assert.Equal(1, res.AtendimentosImportados);
        Assert.Equal([uuid], res.AtendimentosSincronizados);
        Assert.Empty(res.Erros);
        var at = await db.Atendimentos.Include(a => a.ItensProduto).SingleAsync();
        Assert.Equal(50m, at.ValorTotal);
        Assert.Single(at.ItensProduto);
        Assert.Equal(3, (await db.Produtos.SingleAsync()).QuantidadeEstoque);
    }

    [Fact]
    public async Task DescargaAsync_ProdutoInexistente_RejeitaAtendimentoInteiro()
    {
        await using var db = CreateContext();
        SeedCliente(db, id: 1, empresaId: 1);
        SeedProduto(db, id: 10, empresaId: 1, preco: 25m, estoque: 5);
        await db.SaveChangesAsync();
        var uuid = Guid.NewGuid();

        var res = await BuildSync(db).DescargaAsync(1, 1, Descarga(Atendimento(uuid, clienteId: 1, (10, 1), (999, 1))), CancellationToken.None);

        Assert.Equal(0, res.AtendimentosImportados);
        Assert.Empty(res.AtendimentosSincronizados); // segue pendente no device
        Assert.Contains(res.Erros, e => e.Contains("Produto 999"));
        Assert.False(await db.Atendimentos.AnyAsync());
        Assert.Equal(5, (await db.Produtos.SingleAsync()).QuantidadeEstoque); // item valido nao baixou
    }

    [Fact]
    public async Task DescargaAsync_EstoqueInsuficienteSomandoItens_RejeitaSemBaixarEstoque()
    {
        await using var db = CreateContext();
        db.Configuracoes.Add(new Configuracao { Id = 1, EmpresaId = 1, ControlaEstoque = true });
        SeedCliente(db, id: 1, empresaId: 1);
        SeedProduto(db, id: 10, empresaId: 1, preco: 10m, estoque: 3);
        await db.SaveChangesAsync();

        // 2 + 2 do mesmo produto excede o estoque de 3, mesmo cada item cabendo sozinho
        var res = await BuildSync(db).DescargaAsync(1, 1, Descarga(Atendimento(Guid.NewGuid(), clienteId: 1, (10, 2), (10, 2))), CancellationToken.None);

        Assert.Empty(res.AtendimentosSincronizados);
        Assert.Contains(res.Erros, e => e.Contains("Estoque insuficiente"));
        Assert.False(await db.Atendimentos.AnyAsync());
        Assert.Equal(3, (await db.Produtos.SingleAsync()).QuantidadeEstoque);
    }

    [Fact]
    public async Task DescargaAsync_QuantidadeNegativa_RejeitaSemAumentarEstoque()
    {
        await using var db = CreateContext();
        SeedCliente(db, id: 1, empresaId: 1);
        SeedProduto(db, id: 10, empresaId: 1, preco: 10m, estoque: 3);
        await db.SaveChangesAsync();

        var res = await BuildSync(db).DescargaAsync(1, 1, Descarga(Atendimento(Guid.NewGuid(), clienteId: 1, (10, -5))), CancellationToken.None);

        Assert.Empty(res.AtendimentosSincronizados);
        Assert.False(await db.Atendimentos.AnyAsync());
        Assert.Equal(3, (await db.Produtos.SingleAsync()).QuantidadeEstoque);
    }

    [Fact]
    public async Task DescargaAsync_ClienteDeOutraEmpresa_Rejeita()
    {
        await using var db = CreateContext();
        SeedCliente(db, id: 7, empresaId: 2);
        await db.SaveChangesAsync();

        var res = await BuildSync(db).DescargaAsync(1, 1, Descarga(Atendimento(Guid.NewGuid(), clienteId: 7)), CancellationToken.None);

        Assert.Empty(res.AtendimentosSincronizados);
        Assert.Contains(res.Erros, e => e.Contains("Cliente 7"));
        Assert.False(await db.Atendimentos.AnyAsync());
    }

    [Fact]
    public async Task DescargaAsync_FalhaEmUmAtendimento_NaoImpedeOsDemais()
    {
        await using var db = CreateContext();
        SeedCliente(db, id: 1, empresaId: 1);
        await db.SaveChangesAsync();
        var ok = Guid.NewGuid();
        var ruim = Guid.NewGuid();

        var res = await BuildSync(db).DescargaAsync(1, 1, Descarga(
            Atendimento(ruim, clienteId: 999),
            Atendimento(ok, clienteId: 1)), CancellationToken.None);

        Assert.Equal([ok], res.AtendimentosSincronizados);
        Assert.Single(await db.Atendimentos.ToListAsync());
    }

    [Fact]
    public async Task DescargaAsync_AtendimentoJaSincronizado_RetornaComoSincronizadoSemDuplicar()
    {
        await using var db = CreateContext();
        SeedCliente(db, id: 1, empresaId: 1);
        await db.SaveChangesAsync();
        var uuid = Guid.NewGuid();
        var service = BuildSync(db);

        await service.DescargaAsync(1, 1, Descarga(Atendimento(uuid, clienteId: 1)), CancellationToken.None);
        var reenvio = await service.DescargaAsync(1, 1, Descarga(Atendimento(uuid, clienteId: 1)), CancellationToken.None);

        Assert.Equal(0, reenvio.AtendimentosImportados);
        Assert.Equal([uuid], reenvio.AtendimentosSincronizados);
        Assert.Single(await db.Atendimentos.ToListAsync());
    }

    [Fact]
    public async Task DescargaAsync_ClienteComUuidDoDevice_PreservaUuidEReenvioEIdempotente()
    {
        await using var db = CreateContext();
        var uuid = Guid.NewGuid();
        var cliente = new ClienteCreateRequest { Uuid = uuid, Nome = "Maria", Cpf = "52998224725" };
        var service = BuildSync(db);

        var primeira = await service.DescargaAsync(1, 1, new SyncDescargaRequest { Clientes = [cliente] }, CancellationToken.None);
        var reenvio = await service.DescargaAsync(1, 1, new SyncDescargaRequest { Clientes = [cliente] }, CancellationToken.None);

        Assert.Empty(primeira.Erros);
        Assert.Equal([uuid], primeira.ClientesSincronizados);
        Assert.Equal([uuid], reenvio.ClientesSincronizados);
        var salvo = await db.Clientes.SingleAsync();
        Assert.Equal(uuid, salvo.Uuid);
    }

    [Fact]
    public async Task DescargaAsync_AtendimentoComClienteCriadoOfflineNaMesmaLeva_ResolvePeloUuid()
    {
        await using var db = CreateContext();
        var clienteUuid = Guid.NewGuid();
        var atendimento = Atendimento(Guid.NewGuid(), clienteId: 0);
        atendimento.ClienteId = null;
        atendimento.ClienteUuid = clienteUuid;

        var res = await BuildSync(db).DescargaAsync(1, 1, new SyncDescargaRequest
        {
            Clientes = [new ClienteCreateRequest { Uuid = clienteUuid, Nome = "Maria", Cpf = "52998224725" }],
            Atendimentos = [atendimento],
        }, CancellationToken.None);

        Assert.Empty(res.Erros);
        var cliente = await db.Clientes.SingleAsync();
        Assert.Equal(cliente.Id, (await db.Atendimentos.SingleAsync()).ClienteId);
        Assert.Contains(res.ClientesMapeados, m => m.Uuid == clienteUuid && m.Id == cliente.Id);
    }

    [Fact]
    public async Task DescargaAsync_ClienteOfflineComCpfJaExistente_MapeiaUuidParaClienteExistente()
    {
        await using var db = CreateContext();
        db.Clientes.Add(new Cliente { Id = 42, Uuid = Guid.NewGuid(), EmpresaId = 1, Nome = "Maria (web)", Cpf = "52998224725" });
        await db.SaveChangesAsync();
        var clienteUuid = Guid.NewGuid();
        var atendimento = Atendimento(Guid.NewGuid(), clienteId: 0);
        atendimento.ClienteId = null;
        atendimento.ClienteUuid = clienteUuid;

        var res = await BuildSync(db).DescargaAsync(1, 1, new SyncDescargaRequest
        {
            Clientes = [new ClienteCreateRequest { Uuid = clienteUuid, Nome = "Maria", Cpf = "529.982.247-25" }],
            Atendimentos = [atendimento],
        }, CancellationToken.None);

        Assert.Equal([clienteUuid], res.ClientesSincronizados);
        Assert.Contains(res.ClientesMapeados, m => m.Uuid == clienteUuid && m.Id == 42);
        Assert.Equal(42, (await db.Atendimentos.SingleAsync()).ClienteId);
    }

    [Fact]
    public async Task DescargaAsync_ClienteUuidDeOutraEmpresa_Rejeita()
    {
        await using var db = CreateContext();
        var alheio = Guid.NewGuid();
        db.Clientes.Add(new Cliente { Id = 7, Uuid = alheio, EmpresaId = 2, Nome = "Outro", Cpf = "52998224725" });
        await db.SaveChangesAsync();
        var atendimento = Atendimento(Guid.NewGuid(), clienteId: 0);
        atendimento.ClienteId = null;
        atendimento.ClienteUuid = alheio;

        var res = await BuildSync(db).DescargaAsync(1, 1, Descarga(atendimento), CancellationToken.None);

        Assert.Empty(res.AtendimentosSincronizados);
        Assert.False(await db.Atendimentos.AnyAsync());
    }

    private static void SeedCliente(AppDbContext db, long id, long empresaId) =>
        db.Clientes.Add(new Cliente { Id = id, Uuid = Guid.NewGuid(), EmpresaId = empresaId, Nome = $"Cliente {id}", Cpf = $"{id:D11}" });

    private static void SeedProduto(AppDbContext db, long id, long empresaId, decimal preco, int estoque) =>
        db.Produtos.Add(new Produto { Id = id, Uuid = Guid.NewGuid(), EmpresaId = empresaId, Nome = $"Produto {id}", Preco = preco, QuantidadeEstoque = estoque });

    private static AtendimentoSyncRequest Atendimento(Guid uuid, long clienteId, params (long ProdutoId, int Quantidade)[] itens) => new()
    {
        Uuid = uuid,
        DataRegistro = DateTime.UtcNow,
        Status = StatusAtendimento.Concluido,
        ClienteId = clienteId,
        ItensProduto = itens.Select(i => new ItemProdutoSyncRequest { ProdutoId = i.ProdutoId, Quantidade = i.Quantidade }).ToList(),
        ItensServico = [],
    };

    private static SyncDescargaRequest Descarga(params AtendimentoSyncRequest[] atendimentos) =>
        new() { Clientes = [], Atendimentos = atendimentos };

    private static SyncService BuildSync(AppDbContext db)
    {
        var clienteRepo = new ClienteRepository(db);
        return new SyncService(
            db,
            new ClienteService(clienteRepo),
            clienteRepo,
            new ProdutoRepository(db),
            new ServicoRepository(db),
            new AtendimentoRepository(db),
            new ItemProdutoRepository(db),
            new ItemServicoRepository(db),
            NullLogger<SyncService>.Instance);
    }

    private static AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options);
}
