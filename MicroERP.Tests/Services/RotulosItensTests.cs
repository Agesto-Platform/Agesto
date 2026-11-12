using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories;
using MicroERP.Api.Services;

namespace MicroERP.Tests.Services;

// PAG-01: os itens de atendimento e de orçamento já vêm com o nome do catálogo, para o
// web não baixar os catálogos inteiros só para rotulá-los. Excluído continua nomeado.
public sealed class RotulosItensTests
{
    [Fact]
    public async Task ItensServico_TrazemDescricaoECobranca_MesmoDeServicoExcluido()
    {
        await using var db = await SeedAsync();
        db.ItemServicos.Add(new ItemServico { Id = 1, Uuid = Guid.NewGuid(), AtendimentoId = 1, ServicoId = 2, Quantidade = 1 });
        await db.SaveChangesAsync();
        var service = BuildItemServico(db);

        var itens = await service.GetAllByAtendimentoAsync(1, 1, CancellationToken.None);
        var item = Assert.Single(itens);
        Assert.Equal(("Poda antiga", (TipoCobranca?)TipoCobranca.Empreitada), (item.ServicoDescricao, item.TipoCobranca));

        var porId = await service.GetByIdAsync(1, 1, CancellationToken.None);
        Assert.Equal("Poda antiga", porId.ServicoDescricao);
    }

    [Fact]
    public async Task ItemServico_Criado_TrazDescricao()
    {
        await using var db = await SeedAsync();

        var item = await BuildItemServico(db).CreateAsync(1,
            new ItemServicoCreateRequest { AtendimentoId = 1, ServicoId = 1, Quantidade = 2 }, CancellationToken.None);

        Assert.Equal(("Instalação", (TipoCobranca?)TipoCobranca.PorHora), (item.ServicoDescricao, item.TipoCobranca));
    }

    [Fact]
    public async Task ItensProduto_TrazemNome_MesmoDeProdutoExcluido_EAvulsoSemNome()
    {
        await using var db = await SeedAsync();
        db.ItemProdutos.AddRange(
            new ItemProduto { Id = 1, Uuid = Guid.NewGuid(), AtendimentoId = 1, ProdutoId = 2, Descricao = "Cano (snapshot)", Quantidade = 1 },
            new ItemProduto { Id = 2, Uuid = Guid.NewGuid(), AtendimentoId = 1, Descricao = "Material avulso", Quantidade = 1 });
        await db.SaveChangesAsync();
        var service = BuildItemProduto(db);

        var itens = await service.GetAllByAtendimentoAsync(1, 1, CancellationToken.None);

        Assert.Equal("Cano velho", itens.Single(i => i.Id == 1).ProdutoNome);
        Assert.Null(itens.Single(i => i.Id == 2).ProdutoNome);
        Assert.Equal("Cano velho", (await service.GetByIdAsync(1, 1, CancellationToken.None)).ProdutoNome);
    }

    [Fact]
    public async Task ItemProduto_CriadoEEditado_TrazNome()
    {
        await using var db = await SeedAsync();
        var service = BuildItemProduto(db);

        var criado = await service.CreateAsync(1,
            new ItemProdutoCreateRequest { AtendimentoId = 1, ProdutoId = 1, Descricao = "Outro texto", Quantidade = 1 }, CancellationToken.None);
        Assert.Equal("Filtro", criado.ProdutoNome);

        var editado = await service.UpdateAsync(1, criado.Id, new ItemProdutoUpdateRequest { Quantidade = 2 }, CancellationToken.None);
        Assert.Equal("Filtro", editado.ProdutoNome);
    }

    [Fact]
    public async Task Orcamento_CriadoEAbertoPeloId_TrazClienteERotulos()
    {
        await using var db = await SeedAsync();
        var service = BuildOrcamento(db);

        var criado = await service.CreateAsync(1, 5, new OrcamentoCreateRequest
        {
            ClienteId = 1,
            Status = StatusOrcamento.Rascunho,
            Itens =
            [
                new() { ProdutoId = 1, Quantidade = 1, PrecoUnitario = 10m },
                new() { ServicoId = 1, Quantidade = 1, PrecoUnitario = 50m },
                new() { Descricao = "Avulso", Quantidade = 1, PrecoUnitario = 5m }
            ]
        }, CancellationToken.None);

        Assert.Equal("João", criado.ClienteNome);
        AssertRotulos(criado);

        // Produto excluído depois: o item antigo continua nomeado.
        var filtro = await db.Produtos.FindAsync(1L);
        filtro!.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var porId = await service.GetByIdAsync(1, criado.Id, CancellationToken.None);
        Assert.Equal("João", porId.ClienteNome);
        AssertRotulos(porId);

        var pagina = await service.GetPaginaAsync(1, new PaginacaoQuery(), null, CancellationToken.None);
        AssertRotulos(Assert.Single(pagina.Itens));
    }

    // Os itens guardam só o id: um id de outra empresa nunca vira rótulo.
    [Fact]
    public async Task Orcamento_ItemApontandoParaCatalogoDeOutraEmpresa_FicaSemRotulo()
    {
        await using var db = await SeedAsync();
        db.Orcamentos.Add(new Orcamento
        {
            Id = 50, Uuid = Guid.NewGuid(), EmpresaId = 1, UsuarioId = 5, ClienteId = 1, DataRegistro = DateTime.UtcNow,
            Itens =
            [
                new() { Uuid = Guid.NewGuid(), ProdutoId = 9, Quantidade = 1 },
                new() { Uuid = Guid.NewGuid(), ServicoId = 9, Quantidade = 1 }
            ]
        });
        await db.SaveChangesAsync();

        var orcamento = await BuildOrcamento(db).GetByIdAsync(1, 50, CancellationToken.None);

        Assert.All(orcamento.Itens, i =>
        {
            Assert.Null(i.ProdutoNome);
            Assert.Null(i.ServicoDescricao);
            Assert.Null(i.TipoCobranca);
        });
    }

    private static void AssertRotulos(OrcamentoResponse orcamento)
    {
        var produto = orcamento.Itens.Single(i => i.ProdutoId == 1);
        Assert.Equal("Filtro", produto.ProdutoNome);
        Assert.Null(produto.ServicoDescricao);

        var servico = orcamento.Itens.Single(i => i.ServicoId == 1);
        Assert.Equal(("Instalação", (TipoCobranca?)TipoCobranca.PorHora), (servico.ServicoDescricao, servico.TipoCobranca));
        Assert.Null(servico.ProdutoNome);

        var avulso = orcamento.Itens.Single(i => i.ProdutoId == null && i.ServicoId == null);
        Assert.Null(avulso.ProdutoNome);
        Assert.Null(avulso.ServicoDescricao);
    }

    // Empresa 1: cliente João, atendimento 1, produto 1 "Filtro", produto 2 excluído,
    // serviço 1 "Instalação" (por hora), serviço 2 excluído (empreitada). Empresa 2: produto e serviço 9.
    private static async Task<AppDbContext> SeedAsync()
    {
        var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options);
        db.Clientes.Add(new Cliente { Id = 1, Uuid = Guid.NewGuid(), Nome = "João", Cpf = "1", EmpresaId = 1 });
        db.Atendimentos.Add(new Atendimento { Id = 1, Uuid = Guid.NewGuid(), EmpresaId = 1, UsuarioId = 5, ClienteId = 1, DataRegistro = DateTime.UtcNow });
        db.Produtos.AddRange(
            new Produto { Id = 1, Uuid = Guid.NewGuid(), Nome = "Filtro", Preco = 10m, QuantidadeEstoque = 10, EmpresaId = 1 },
            new Produto { Id = 2, Uuid = Guid.NewGuid(), Nome = "Cano velho", EmpresaId = 1, DeletedAt = DateTime.UtcNow },
            new Produto { Id = 9, Uuid = Guid.NewGuid(), Nome = "De outra empresa", EmpresaId = 2 });
        db.Servicos.AddRange(
            new Servico { Id = 1, Uuid = Guid.NewGuid(), Descricao = "Instalação", TipoCobranca = TipoCobranca.PorHora, ValorHora = 50m, EmpresaId = 1 },
            new Servico { Id = 2, Uuid = Guid.NewGuid(), Descricao = "Poda antiga", TipoCobranca = TipoCobranca.Empreitada, EmpresaId = 1, DeletedAt = DateTime.UtcNow },
            new Servico { Id = 9, Uuid = Guid.NewGuid(), Descricao = "De outra empresa", EmpresaId = 2 });
        await db.SaveChangesAsync();
        return db;
    }

    private static ItemServicoService BuildItemServico(AppDbContext db) =>
        new(new ItemServicoRepository(db), new AtendimentoRepository(db), new ServicoRepository(db), new ItemProdutoRepository(db));

    private static ItemProdutoService BuildItemProduto(AppDbContext db) =>
        new(new ItemProdutoRepository(db), new AtendimentoRepository(db), new ProdutoRepository(db), new ItemServicoRepository(db), new ConfiguracaoRepository(db));

    private static OrcamentoService BuildOrcamento(AppDbContext db)
    {
        var atendimentoService = new AtendimentoService(new AtendimentoRepository(db), new ClienteRepository(db), new ItemProdutoRepository(db),
            new ItemServicoRepository(db), new ProdutoRepository(db), new ConfiguracaoRepository(db), new UsuarioRepository(db));
        return new OrcamentoService(db, new OrcamentoRepository(db), new ClienteRepository(db), atendimentoService,
            BuildItemProduto(db), BuildItemServico(db));
    }
}
