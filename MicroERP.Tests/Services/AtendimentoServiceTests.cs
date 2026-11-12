using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;
using MicroERP.Api.Services;
using MicroERP.Api.Services.Exceptions;
using Moq;

namespace MicroERP.Tests.Services;

public sealed class AtendimentoServiceTests
{
    private readonly Mock<IAtendimentoRepository> _atendimentoRepoMock = new();
    private readonly Mock<IClienteRepository> _clienteRepoMock = new();
    private readonly Mock<IItemProdutoRepository> _itemProdutoRepoMock = new();
    private readonly Mock<IItemServicoRepository> _itemServicoRepoMock = new();
    private readonly Mock<IProdutoRepository> _produtoRepoMock = new();
    private readonly Mock<IConfiguracaoRepository> _configuracaoRepoMock = new();
    private readonly Mock<IUsuarioRepository> _usuarioRepoMock = new();
    private readonly AtendimentoService _service;

    public AtendimentoServiceTests()
    {
        _service = new AtendimentoService(
            _atendimentoRepoMock.Object,
            _clienteRepoMock.Object,
            _itemProdutoRepoMock.Object,
            _itemServicoRepoMock.Object,
            _produtoRepoMock.Object,
            _configuracaoRepoMock.Object,
            _usuarioRepoMock.Object);
    }

    [Fact]
    public async Task GetByIdAsync_WhenNotFound_ThrowsNotFoundException()
    {
        _atendimentoRepoMock
            .Setup(r => r.GetByIdAsync(1, 99, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Atendimento?)null);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.GetByIdAsync(1, 99, CancellationToken.None));
    }

    [Fact]
    public async Task CreateAsync_WhenClienteNotFound_ThrowsNotFoundException()
    {
        _clienteRepoMock
            .Setup(r => r.GetByIdAsync(1, 5, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Cliente?)null);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.CreateAsync(1, 10, new AtendimentoCreateRequest { ClienteId = 5, Status = StatusAtendimento.Pendente }, CancellationToken.None));
    }

    [Fact]
    public async Task CreateAsync_WhenClienteFound_SavesAndReturnsResponse()
    {
        _clienteRepoMock
            .Setup(r => r.GetByIdAsync(1, 5, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Cliente { Id = 5, Nome = "João" });

        var result = await _service.CreateAsync(1, 10, new AtendimentoCreateRequest { ClienteId = 5, Status = StatusAtendimento.Pendente }, CancellationToken.None);

        _atendimentoRepoMock.Verify(r => r.AddAsync(It.IsAny<Atendimento>(), It.IsAny<CancellationToken>()), Times.Once);
        _atendimentoRepoMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        Assert.Equal(StatusAtendimento.Pendente, result.Status);
        Assert.Equal(0m, result.ValorTotal);
    }

    [Fact]
    public async Task CreateAsync_ComAgenteResponsavel_AtribuiAoAgente()
    {
        _clienteRepoMock
            .Setup(r => r.GetByIdAsync(1, 5, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Cliente { Id = 5, Nome = "João" });
        _usuarioRepoMock
            .Setup(r => r.GetByIdAsync(1, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Usuario { Id = 20, EmpresaId = 1, Perfil = PerfilUsuario.Agente, Ativo = true });

        var result = await _service.CreateAsync(1, 10, new AtendimentoCreateRequest { ClienteId = 5, Status = StatusAtendimento.Pendente, ResponsavelId = 20 }, CancellationToken.None);

        Assert.Equal(20, result.UsuarioId);
    }

    [Theory]
    [InlineData(false)] // agente desativado
    [InlineData(null)]  // agente de outra empresa (não encontrado no escopo)
    public async Task CreateAsync_ComAgenteInvalido_ThrowsNotFound(bool? ativo)
    {
        _clienteRepoMock
            .Setup(r => r.GetByIdAsync(1, 5, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Cliente { Id = 5, Nome = "João" });
        _usuarioRepoMock
            .Setup(r => r.GetByIdAsync(1, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ativo is null ? null : new Usuario { Id = 20, EmpresaId = 1, Ativo = ativo.Value });

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.CreateAsync(1, 10, new AtendimentoCreateRequest { ClienteId = 5, Status = StatusAtendimento.Pendente, ResponsavelId = 20 }, CancellationToken.None));
        _atendimentoRepoMock.Verify(r => r.AddAsync(It.IsAny<Atendimento>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateAsync_ComNovoAgente_Reatribui()
    {
        var atendimento = new Atendimento { Id = 7, EmpresaId = 1, UsuarioId = 10, Status = StatusAtendimento.Pendente };
        _atendimentoRepoMock
            .Setup(r => r.GetByIdAsync(1, 7, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(atendimento);
        _usuarioRepoMock
            .Setup(r => r.GetByIdAsync(1, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Usuario { Id = 20, EmpresaId = 1, Ativo = true });

        var result = await _service.UpdateAsync(1, 7, new AtendimentoUpdateRequest { Status = StatusAtendimento.Pendente, ResponsavelId = 20 }, CancellationToken.None);

        Assert.Equal(20, result.UsuarioId);
    }

    [Fact]
    public async Task UpdateAsync_SemAgente_MantemOAtual()
    {
        var atendimento = new Atendimento { Id = 7, EmpresaId = 1, UsuarioId = 10, Status = StatusAtendimento.Pendente };
        _atendimentoRepoMock
            .Setup(r => r.GetByIdAsync(1, 7, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(atendimento);

        var result = await _service.UpdateAsync(1, 7, new AtendimentoUpdateRequest { Status = StatusAtendimento.Concluido }, CancellationToken.None);

        Assert.Equal(10, result.UsuarioId);
        _usuarioRepoMock.Verify(r => r.GetByIdAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateAsync_WhenNotFound_ThrowsNotFoundException()
    {
        _atendimentoRepoMock
            .Setup(r => r.GetByIdAsync(1, 99, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Atendimento?)null);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.UpdateAsync(1, 99, new AtendimentoUpdateRequest { Status = StatusAtendimento.Concluido }, CancellationToken.None));
    }

    [Fact]
    public async Task DeleteAsync_WhenNotFound_ThrowsNotFoundException()
    {
        _atendimentoRepoMock
            .Setup(r => r.GetByIdAsync(1, 99, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Atendimento?)null);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.DeleteAsync(1, 99, CancellationToken.None));
    }

    [Fact]
    public async Task DeleteAsync_WhenFound_CascadeSoftDeletesItemsAndRestoresStock()
    {
        var atendimento = new Atendimento { Id = 1, Uuid = Guid.NewGuid(), EmpresaId = 1, ClienteId = 1, Status = StatusAtendimento.Pendente };
        var produto = new Produto { Id = 10, QuantidadeEstoque = 3 };
        var itemProduto = new ItemProduto { Id = 1, AtendimentoId = 1, ProdutoId = 10, Quantidade = 2, EstoqueBaixado = true };
        var itemServico = new ItemServico { Id = 1, AtendimentoId = 1, ServicoId = 5 };

        _atendimentoRepoMock
            .Setup(r => r.GetByIdAsync(1, 1, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(atendimento);

        _itemProdutoRepoMock
            .Setup(r => r.GetAllByAtendimentoTrackedAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync([itemProduto]);

        _produtoRepoMock
            .Setup(r => r.GetByIdAsync(1, 10, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(produto);

        _itemServicoRepoMock
            .Setup(r => r.GetAllByAtendimentoTrackedAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync([itemServico]);

        // Explícito: empresa controla estoque, então o cancelamento devolve o saldo.
        _configuracaoRepoMock
            .Setup(r => r.GetByEmpresaAsync(1, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Configuracao { EmpresaId = 1, ControlaEstoque = true });

        await _service.DeleteAsync(1, 1, CancellationToken.None);

        Assert.NotNull(atendimento.DeletedAt);
        Assert.NotNull(itemProduto.DeletedAt);
        Assert.NotNull(itemServico.DeletedAt);
        Assert.Equal(5, produto.QuantidadeEstoque); // 3 + 2 devolvidos
        _atendimentoRepoMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetByIdAsync_ComputaMargem()
    {
        _atendimentoRepoMock
            .Setup(r => r.GetByIdAsync(1, 1, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Atendimento { Id = 1, ValorTotal = 100m, CustoTotal = 30m });

        var result = await _service.GetByIdAsync(1, 1, CancellationToken.None);

        Assert.Equal(100m, result.ValorTotal);
        Assert.Equal(30m, result.CustoTotal);
        Assert.Equal(70m, result.Margem); // 100 - 30
    }

    [Fact]
    public async Task GetByIdAsync_SemCusto_MargemIgualValorTotal()
    {
        _atendimentoRepoMock
            .Setup(r => r.GetByIdAsync(1, 1, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Atendimento { Id = 1, ValorTotal = 100m, CustoTotal = 0m });

        var result = await _service.GetByIdAsync(1, 1, CancellationToken.None);

        Assert.Equal(0m, result.CustoTotal);
        Assert.Equal(100m, result.Margem);
    }

    [Fact]
    public async Task GetAgendaAsync_MapeiaResultadosDoRepositorio()
    {
        var de = new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc);
        var ate = new DateTime(2026, 7, 31, 0, 0, 0, DateTimeKind.Utc);

        _atendimentoRepoMock
            .Setup(r => r.GetAgendaAsync(1, de, ate, 5L, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Atendimento>
            {
                new()
                {
                    Id = 1,
                    DataAgendada = new DateTime(2026, 7, 10, 9, 0, 0, DateTimeKind.Utc),
                    Cliente = new Cliente { Nome = "Vo Joana", Telefone = "34999990000", Logradouro = "R. das Acacias", Numero = "120", Bairro = "Centro" },
                    ItensServico = new List<ItemServico> { new() { Servico = new Servico { Descricao = "Instalacao de AC" } } }
                },
                // Cliente soft-deletado deve ser tratado como ausente.
                new() { Id = 2, DataAgendada = new DateTime(2026, 7, 15, 14, 0, 0, DateTimeKind.Utc), Cliente = new Cliente { Nome = "Removido", DeletedAt = DateTime.UtcNow } }
            });

        var result = await _service.GetAgendaAsync(1, de, ate, 5L, CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.Equal(new DateTime(2026, 7, 10, 9, 0, 0, DateTimeKind.Utc), result[0].DataAgendada);
        // Enriquecimento (fim do N+1): nome, endereco e resumo do servico.
        Assert.Equal("Vo Joana", result[0].ClienteNome);
        Assert.Equal("R. das Acacias, 120 — Centro", result[0].EnderecoResumo);
        Assert.Equal("Instalacao de AC", result[0].Resumo);
        // Sem itens + cliente soft-deletado -> fallback seguro / cliente ausente.
        Assert.Equal("Atendimento", result[1].Resumo);
        Assert.Equal(string.Empty, result[1].ClienteNome);
        Assert.Null(result[1].EnderecoResumo);
    }

    // PAG-02: a agenda não pagina; o teto do período limita o tamanho da resposta.
    [Theory]
    [InlineData(62, true)]
    [InlineData(63, false)]
    [InlineData(365, false)]
    public async Task GetAgendaAsync_LimitaOPeriodoA62Dias(int dias, bool aceita)
    {
        var de = new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc);
        var ate = de.AddDays(dias);
        _atendimentoRepoMock
            .Setup(r => r.GetAgendaAsync(1, de, ate, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Atendimento>());

        if (aceita)
        {
            Assert.Empty(await _service.GetAgendaAsync(1, de, ate, null, CancellationToken.None));
        }
        else
        {
            var ex = await Assert.ThrowsAsync<ArgumentException>(() => _service.GetAgendaAsync(1, de, ate, null, CancellationToken.None));
            Assert.Contains("62 dias", ex.Message);
            _atendimentoRepoMock.Verify(r => r.GetAgendaAsync(It.IsAny<long>(), It.IsAny<DateTime>(), It.IsAny<DateTime>(),
                It.IsAny<long?>(), It.IsAny<CancellationToken>()), Times.Never);
        }
    }

    [Fact]
    public async Task GetAgendaAsync_FimAntesDoInicio_ThrowsArgumentException()
    {
        var de = new DateTime(2026, 7, 10, 0, 0, 0, DateTimeKind.Utc);
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _service.GetAgendaAsync(1, de, de.AddDays(-1), null, CancellationToken.None));
    }

    // PAG-02: a listagem traz o resumo, para o web não pedir a agenda do ano só por ele.
    [Fact]
    public async Task GetAllAsync_PreencheOResumo()
    {
        _atendimentoRepoMock
            .Setup(r => r.GetAllAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Atendimento> { new() { Id = 1 }, new() { Id = 2 }, new() { Id = 3 } });
        _atendimentoRepoMock
            .Setup(r => r.GetResumosAsync(1, It.Is<IReadOnlyCollection<long>>(ids => ids.SequenceEqual(new long[] { 1, 2, 3 })), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<long, string?> { [1] = "Instalação de AC", [2] = "Filtro", [3] = null });

        var result = await _service.GetAllAsync(1, CancellationToken.None);

        Assert.Equal(["Instalação de AC", "Filtro", null], result.Select(a => a.Resumo).ToArray());
    }

    // PAG-01: a página traz nome, telefone e endereço do cliente (o web não baixa mais
    // todos os clientes) e repassa os filtros ao repositório.
    [Fact]
    public async Task GetPaginaAsync_TrazOClienteERepassaOsFiltros()
    {
        _atendimentoRepoMock
            .Setup(r => r.GetPaginaAsync(1, 2, 50, "joao", StatusAtendimento.Pendente, 7L, It.IsAny<CancellationToken>()))
            .ReturnsAsync((new List<Atendimento>
            {
                new() { Id = 1, Cliente = new Cliente { Nome = "João", Telefone = "(34) 9999", Logradouro = "R. A", Numero = "1", Bairro = "Centro" } },
                new() { Id = 2, Cliente = new Cliente { Nome = "Removido", DeletedAt = DateTime.UtcNow } }
            }, 51));
        _atendimentoRepoMock
            .Setup(r => r.GetResumosAsync(1, It.IsAny<IReadOnlyCollection<long>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<long, string?>());

        var pagina = await _service.GetPaginaAsync(1, new PaginacaoQuery { Pagina = 2, Tamanho = 50 },
            new AtendimentoFiltroQuery { Busca = "joao", Status = StatusAtendimento.Pendente, ClienteId = 7 }, CancellationToken.None);

        Assert.Equal(51, pagina.Total);
        Assert.Equal("João", pagina.Itens[0].ClienteNome);
        Assert.Equal("(34) 9999", pagina.Itens[0].ClienteTelefone);
        Assert.Equal("R. A, 1 — Centro", pagina.Itens[0].EnderecoResumo);
        Assert.Null(pagina.Itens[1].ClienteNome); // cliente excluído = ausente
    }

    [Fact]
    public async Task ContarPorStatusAsync_SomaAsAbas()
    {
        _atendimentoRepoMock
            .Setup(r => r.ContarPorStatusAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<StatusAtendimento, int> { [StatusAtendimento.Pendente] = 3, [StatusAtendimento.Concluido] = 5 });

        var contagem = await _service.ContarPorStatusAsync(1, CancellationToken.None);

        Assert.Equal((8, 3, 5, 0), (contagem.Todos, contagem.Pendente, contagem.Concluido, contagem.Cancelado));
    }
}
