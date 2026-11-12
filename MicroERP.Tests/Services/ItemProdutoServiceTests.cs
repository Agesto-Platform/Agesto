using MicroERP.Api.DTOs;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;
using MicroERP.Api.Services;
using MicroERP.Api.Services.Exceptions;
using Moq;

namespace MicroERP.Tests.Services;

public sealed class ItemProdutoServiceTests
{
    private readonly Mock<IItemProdutoRepository> _itemProdutoRepoMock = new();
    private readonly Mock<IAtendimentoRepository> _atendimentoRepoMock = new();
    private readonly Mock<IProdutoRepository> _produtoRepoMock = new();
    private readonly Mock<IItemServicoRepository> _itemServicoRepoMock = new();
    private readonly Mock<IConfiguracaoRepository> _configuracaoRepoMock = new();
    private readonly ItemProdutoService _service;

    public ItemProdutoServiceTests()
    {
        _service = new ItemProdutoService(
            _itemProdutoRepoMock.Object,
            _atendimentoRepoMock.Object,
            _produtoRepoMock.Object,
            _itemServicoRepoMock.Object,
            _configuracaoRepoMock.Object);
    }

    [Fact]
    public async Task GetByIdAsync_WhenNotFound_ThrowsNotFoundException()
    {
        _itemProdutoRepoMock
            .Setup(r => r.GetByIdAsync(1, 99, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync((ItemProduto?)null);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.GetByIdAsync(1, 99, CancellationToken.None));
    }

    [Fact]
    public async Task CreateAsync_WhenAtendimentoNotFound_ThrowsNotFoundException()
    {
        _atendimentoRepoMock
            .Setup(r => r.GetByIdAsync(1, 1, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Atendimento?)null);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.CreateAsync(1, new ItemProdutoCreateRequest { AtendimentoId = 1, ProdutoId = 1, Quantidade = 1 }, CancellationToken.None));
    }

    [Fact]
    public async Task CreateAsync_WhenProdutoNotFound_ThrowsNotFoundException()
    {
        _atendimentoRepoMock
            .Setup(r => r.GetByIdAsync(1, 1, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Atendimento { Id = 1 });

        _produtoRepoMock
            .Setup(r => r.GetByIdAsync(1, 5, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Produto?)null);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.CreateAsync(1, new ItemProdutoCreateRequest { AtendimentoId = 1, ProdutoId = 5, Quantidade = 1 }, CancellationToken.None));
    }

    [Fact]
    public async Task CreateAsync_WhenEstoqueInsuficiente_ThrowsEstoqueInsuficienteException()
    {
        _atendimentoRepoMock
            .Setup(r => r.GetByIdAsync(1, 1, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Atendimento { Id = 1 });

        _produtoRepoMock
            .Setup(r => r.GetByIdAsync(1, 5, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Produto { Id = 5, Nome = "Produto A", QuantidadeEstoque = 1, Preco = 10m });

        await Assert.ThrowsAsync<EstoqueInsuficienteException>(() =>
            _service.CreateAsync(1, new ItemProdutoCreateRequest { AtendimentoId = 1, ProdutoId = 5, Quantidade = 5 }, CancellationToken.None));
    }

    [Fact]
    public async Task CreateAsync_WhenControlaEstoqueFalse_DoesNotValidateNorDeductStock()
    {
        var atendimento = new Atendimento { Id = 1 };
        var produto = new Produto { Id = 5, Nome = "Produto A", QuantidadeEstoque = 1, Preco = 20m };

        _atendimentoRepoMock
            .Setup(r => r.GetByIdAsync(1, 1, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(atendimento);
        _produtoRepoMock
            .Setup(r => r.GetByIdAsync(1, 5, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(produto);
        _configuracaoRepoMock
            .Setup(r => r.GetByEmpresaAsync(1, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Configuracao { EmpresaId = 1, ControlaEstoque = false });
        _itemProdutoRepoMock
            .Setup(r => r.SumSubtotalByAtendimentoAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(100m);
        _itemServicoRepoMock
            .Setup(r => r.SumSubtotalByAtendimentoAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(0m);

        // Quantidade (5) > estoque (1): sem controle de estoque, nao valida nem baixa.
        var result = await _service.CreateAsync(1, new ItemProdutoCreateRequest { AtendimentoId = 1, ProdutoId = 5, Quantidade = 5 }, CancellationToken.None);

        Assert.Equal(1, produto.QuantidadeEstoque); // inalterado
        Assert.Equal(20m, result.PrecoUnitario);    // ainda usa o preco do catalogo
        _itemProdutoRepoMock.Verify(r => r.AddAsync(It.IsAny<ItemProduto>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateAsync_WhenValid_DeductsStockAndSaves()
    {
        var atendimento = new Atendimento { Id = 1 };
        var produto = new Produto { Id = 5, Nome = "Produto A", QuantidadeEstoque = 10, Preco = 20m };

        _atendimentoRepoMock
            .Setup(r => r.GetByIdAsync(1, 1, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(atendimento);

        _produtoRepoMock
            .Setup(r => r.GetByIdAsync(1, 5, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(produto);

        _itemProdutoRepoMock
            .Setup(r => r.SumSubtotalByAtendimentoAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(60m);

        _itemServicoRepoMock
            .Setup(r => r.SumSubtotalByAtendimentoAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(0m);

        var result = await _service.CreateAsync(1, new ItemProdutoCreateRequest { AtendimentoId = 1, ProdutoId = 5, Quantidade = 3 }, CancellationToken.None);

        Assert.Equal(7, produto.QuantidadeEstoque); // 10 - 3
        Assert.Equal(60m, result.Subtotal);
        _itemProdutoRepoMock.Verify(r => r.AddAsync(It.IsAny<ItemProduto>(), It.IsAny<CancellationToken>()), Times.Once);
        _itemProdutoRepoMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteAsync_WhenNotFound_ThrowsNotFoundException()
    {
        _itemProdutoRepoMock
            .Setup(r => r.GetByIdAsync(1, 99, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync((ItemProduto?)null);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.DeleteAsync(1, 99, CancellationToken.None));
    }

    [Fact]
    public async Task DeleteAsync_WhenFound_SetsDeletedAtAndRestoresStock()
    {
        var produto = new Produto { Id = 5, QuantidadeEstoque = 3 };
        var item = new ItemProduto { Id = 1, AtendimentoId = 1, ProdutoId = 5, Quantidade = 2, EstoqueBaixado = true };

        _itemProdutoRepoMock
            .Setup(r => r.GetByIdAsync(1, 1, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(item);

        _produtoRepoMock
            .Setup(r => r.GetByIdAsync(1, 5, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(produto);

        _itemProdutoRepoMock
            .Setup(r => r.SumSubtotalByAtendimentoAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(0m);

        _itemServicoRepoMock
            .Setup(r => r.SumSubtotalByAtendimentoAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(0m);

        _atendimentoRepoMock
            .Setup(r => r.GetByIdAsync(1, 1, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Atendimento { Id = 1 });

        await _service.DeleteAsync(1, 1, CancellationToken.None);

        Assert.NotNull(item.DeletedAt);
        Assert.Equal(5, produto.QuantidadeEstoque); // 3 + 2
    }

    [Fact]
    public async Task CreateAsync_ItemAvulso_NaoBaixaEstoqueEUsaValorInformado()
    {
        _atendimentoRepoMock
            .Setup(r => r.GetByIdAsync(1, 1, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Atendimento { Id = 1 });

        _itemProdutoRepoMock
            .Setup(r => r.SumSubtotalByAtendimentoAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(80m);
        _itemServicoRepoMock
            .Setup(r => r.SumSubtotalByAtendimentoAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(0m);

        var result = await _service.CreateAsync(1, new ItemProdutoCreateRequest
        {
            AtendimentoId = 1,
            ProdutoId = null,
            Descricao = "Suporte universal",
            PrecoUnitario = 40m,
            Custo = 32m,
            Quantidade = 2
        }, CancellationToken.None);

        Assert.Null(result.ProdutoId);
        Assert.Equal("Suporte universal", result.Descricao);
        Assert.Equal(40m, result.PrecoUnitario);
        Assert.Equal(80m, result.Subtotal); // 2 * 40
        Assert.Equal(32m, result.Custo);
        // Item avulso nunca consulta/baixa estoque.
        _produtoRepoMock.Verify(r => r.GetByIdAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CreateAsync_ItemAvulsoSemDescricao_ThrowsArgumentException()
    {
        _atendimentoRepoMock
            .Setup(r => r.GetByIdAsync(1, 1, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Atendimento { Id = 1 });

        await Assert.ThrowsAsync<ArgumentException>(() =>
            _service.CreateAsync(1, new ItemProdutoCreateRequest { AtendimentoId = 1, ProdutoId = null, Quantidade = 1 }, CancellationToken.None));
    }

    [Fact]
    public async Task CreateAsync_CatalogoComValorInformado_SobrescreveCatalogo()
    {
        var produto = new Produto { Id = 5, Nome = "Produto A", QuantidadeEstoque = 10, Preco = 20m };

        _atendimentoRepoMock
            .Setup(r => r.GetByIdAsync(1, 1, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Atendimento { Id = 1 });
        _produtoRepoMock
            .Setup(r => r.GetByIdAsync(1, 5, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(produto);
        _itemProdutoRepoMock
            .Setup(r => r.SumSubtotalByAtendimentoAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(0m);
        _itemServicoRepoMock
            .Setup(r => r.SumSubtotalByAtendimentoAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(0m);

        var result = await _service.CreateAsync(1, new ItemProdutoCreateRequest
        {
            AtendimentoId = 1,
            ProdutoId = 5,
            PrecoUnitario = 15m, // sobrescreve o preco de catalogo (20)
            Quantidade = 2
        }, CancellationToken.None);

        Assert.Equal(15m, result.PrecoUnitario);
        Assert.Equal(30m, result.Subtotal); // 2 * 15
        Assert.Equal(8, produto.QuantidadeEstoque); // 10 - 2, ainda baixa estoque
    }
}
