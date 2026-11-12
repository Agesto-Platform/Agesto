using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories;
using MicroERP.Api.Repositories.Interfaces;
using MicroERP.Api.Services;
using Moq;

namespace MicroERP.Tests.Services;

public sealed class ConfiguracaoServiceTests
{
    private readonly Mock<IConfiguracaoRepository> _repositoryMock = new();
    private readonly ConfiguracaoService _service;

    public ConfiguracaoServiceTests()
    {
        _service = new ConfiguracaoService(_repositoryMock.Object);
    }

    private static Configuracao NovaConfiguracao() => new()
    {
        Id = 1,
        EmpresaId = 1,
        TipoOperacao = TipoOperacao.Servico,
        ModoAgendaAgente = ModoAgendaAgente.Flexivel,
        ControlaEstoque = true,
    };

    [Fact]
    public async Task GetByEmpresaAsync_MapsNewFields()
    {
        var configuracao = NovaConfiguracao();
        configuracao.ModoAgendaAgente = ModoAgendaAgente.Fixa;
        configuracao.ControlaEstoque = false;
        _repositoryMock
            .Setup(r => r.GetByEmpresaAsync(1, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(configuracao);

        var result = await _service.GetByEmpresaAsync(1, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(ModoAgendaAgente.Fixa, result!.ModoAgendaAgente);
        Assert.False(result.ControlaEstoque);
    }

    [Fact]
    public async Task GetByEmpresaAsync_TrazNomeEDocumentoDaEmpresa()
    {
        // DEC-56: o nome vai no cabeçalho do PDF do orçamento e na conta do web.
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.Empresas.AddRange(
            new Empresa { Id = 1, Nome = "Clima Bom", Documento = "12.345.678/0001-90" },
            new Empresa { Id = 2, Nome = "Outra Empresa" });
        db.Configuracoes.AddRange(
            new Configuracao { Id = 1, EmpresaId = 1 },
            new Configuracao { Id = 2, EmpresaId = 2 });
        await db.SaveChangesAsync();

        var result = await new ConfiguracaoService(new ConfiguracaoRepository(db)).GetByEmpresaAsync(1, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("Clima Bom", result!.EmpresaNome);
        Assert.Equal("12.345.678/0001-90", result.EmpresaDocumento);
    }

    [Fact]
    public async Task UpdateAsync_WhenNotFound_ReturnsNull()
    {
        _repositoryMock
            .Setup(r => r.GetByEmpresaAsync(1, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Configuracao?)null);

        var result = await _service.UpdateAsync(1, new ConfiguracaoUpdateRequest { TipoOperacao = TipoOperacao.Servico }, CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task UpdateAsync_AppliesNewFieldsWhenProvided()
    {
        var configuracao = NovaConfiguracao();
        _repositoryMock
            .Setup(r => r.GetByEmpresaAsync(1, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(configuracao);

        var request = new ConfiguracaoUpdateRequest
        {
            TipoOperacao = TipoOperacao.Servico,
            ModoAgendaAgente = ModoAgendaAgente.Fixa,
            ControlaEstoque = false,
        };

        var result = await _service.UpdateAsync(1, request, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(ModoAgendaAgente.Fixa, configuracao.ModoAgendaAgente);
        Assert.False(configuracao.ControlaEstoque);
        _repositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateAsync_LeavesNewFieldsUnchangedWhenNull()
    {
        var configuracao = NovaConfiguracao(); // Flexivel + ControlaEstoque true
        _repositoryMock
            .Setup(r => r.GetByEmpresaAsync(1, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(configuracao);

        // Só TipoOperacao no request — os novos campos ficam nulos.
        var request = new ConfiguracaoUpdateRequest { TipoOperacao = TipoOperacao.Hibrido };

        await _service.UpdateAsync(1, request, CancellationToken.None);

        Assert.Equal(ModoAgendaAgente.Flexivel, configuracao.ModoAgendaAgente);
        Assert.True(configuracao.ControlaEstoque);
    }
}
