using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;
using MicroERP.Api.Services;
using MicroERP.Api.Services.Exceptions;
using Moq;

namespace MicroERP.Tests.Services;

public sealed class ServicoServiceTests
{
    private readonly Mock<IServicoRepository> _repositoryMock = new();
    private readonly ServicoService _service;

    public ServicoServiceTests()
    {
        _service = new ServicoService(_repositoryMock.Object);
    }

    [Fact]
    public async Task GetByIdAsync_WhenNotFound_ThrowsNotFoundException()
    {
        _repositoryMock
            .Setup(r => r.GetByIdAsync(1, 99, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Servico?)null);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.GetByIdAsync(1, 99, CancellationToken.None));
    }

    [Fact]
    public async Task CreateAsync_Empreitada_WithoutValorEmpreitada_ThrowsArgumentException()
    {
        var request = new ServicoCreateRequest
        {
            Descricao = "Servico X",
            TipoCobranca = TipoCobranca.Empreitada,
            ValorEmpreitada = null
        };

        await Assert.ThrowsAsync<ArgumentException>(() =>
            _service.CreateAsync(1, request, CancellationToken.None));
    }

    [Fact]
    public async Task CreateAsync_PorHora_WithoutValorHora_ThrowsArgumentException()
    {
        var request = new ServicoCreateRequest
        {
            Descricao = "Servico Y",
            TipoCobranca = TipoCobranca.PorHora,
            ValorHora = null
        };

        await Assert.ThrowsAsync<ArgumentException>(() =>
            _service.CreateAsync(1, request, CancellationToken.None));
    }

    [Fact]
    public async Task CreateAsync_PorHora_WithValorHora_SavesAndReturnsResponse()
    {
        var request = new ServicoCreateRequest
        {
            Descricao = "Corte",
            TipoCobranca = TipoCobranca.PorHora,
            ValorHora = 80m
        };

        var result = await _service.CreateAsync(1, request, CancellationToken.None);

        _repositoryMock.Verify(r => r.AddAsync(It.IsAny<Servico>(), It.IsAny<CancellationToken>()), Times.Once);
        _repositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        Assert.Equal("Corte", result.Descricao);
        Assert.Equal(TipoCobranca.PorHora, result.TipoCobranca);
    }

    [Fact]
    public async Task UpdateAsync_WhenNotFound_ThrowsNotFoundException()
    {
        _repositoryMock
            .Setup(r => r.GetByIdAsync(1, 99, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Servico?)null);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.UpdateAsync(1, 99, new ServicoUpdateRequest { Descricao = "X", TipoCobranca = TipoCobranca.PorHora, ValorHora = 10m }, CancellationToken.None));
    }

    [Fact]
    public async Task DeleteAsync_WhenNotFound_ThrowsNotFoundException()
    {
        _repositoryMock
            .Setup(r => r.GetByIdAsync(1, 99, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Servico?)null);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.DeleteAsync(1, 99, CancellationToken.None));
    }

    [Fact]
    public async Task DeleteAsync_WhenFound_SetsDeletedAt()
    {
        var servico = new Servico { Id = 1, Uuid = Guid.NewGuid(), Descricao = "Polimento", TipoCobranca = TipoCobranca.PorHora, ValorHora = 50m };

        _repositoryMock
            .Setup(r => r.GetByIdAsync(1, 1, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(servico);

        await _service.DeleteAsync(1, 1, CancellationToken.None);

        Assert.NotNull(servico.DeletedAt);
        _repositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateAsync_ServicoCriadoPeloAgente_FicaRevisado()
    {
        var servico = new Servico { Id = 1, Uuid = Guid.NewGuid(), Descricao = "Dreno", TipoCobranca = TipoCobranca.PorHora, ValorHora = 50m, Revisado = false, CriadoPorUsuarioId = 2 };
        _repositoryMock
            .Setup(r => r.GetByIdAsync(1, 1, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(servico);

        var res = await _service.UpdateAsync(1, 1, new ServicoUpdateRequest { Descricao = "Limpeza de dreno", TipoCobranca = TipoCobranca.PorHora, ValorHora = 70m }, CancellationToken.None);

        Assert.True(res.Revisado);
        Assert.Equal(2, res.CriadoPorUsuarioId);
    }

    [Fact]
    public async Task MarcarRevisadoAsync_TiraOSeloSemMudarPreco()
    {
        var servico = new Servico { Id = 1, Uuid = Guid.NewGuid(), Descricao = "Dreno", TipoCobranca = TipoCobranca.PorHora, ValorHora = 50m, Revisado = false };
        _repositoryMock
            .Setup(r => r.GetByIdAsync(1, 1, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(servico);

        var res = await _service.MarcarRevisadoAsync(1, 1, CancellationToken.None);

        Assert.True(res.Revisado);
        Assert.Equal(50m, res.ValorHora);
        _repositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
