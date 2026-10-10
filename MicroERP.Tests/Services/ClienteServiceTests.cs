using MicroERP.Api.DTOs;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;
using MicroERP.Api.Services;
using MicroERP.Api.Services.Exceptions;
using Moq;

namespace MicroERP.Tests.Services;

public sealed class ClienteServiceTests
{
    private readonly Mock<IClienteRepository> _repositoryMock = new();
    private readonly ClienteService _service;

    public ClienteServiceTests()
    {
        _service = new ClienteService(_repositoryMock.Object);
    }

    [Fact]
    public async Task CreateAsync_WhenCpfAlreadyExists_ThrowsCpfAlreadyExistsException()
    {
        var request = new ClienteCreateRequest
        {
            Nome = "Cliente Teste",
            Telefone = "11999999999",
            Cpf = "529.982.247-25"
        };

        _repositoryMock
            .Setup(r => r.GetByCpfAsync(1, "52998224725", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Cliente { Id = 10, Cpf = "52998224725" });

        await Assert.ThrowsAsync<CpfAlreadyExistsException>(() =>
            _service.CreateAsync(1, request, CancellationToken.None));

        _repositoryMock.Verify(r => r.AddAsync(It.IsAny<Cliente>(), It.IsAny<CancellationToken>()), Times.Never);
        _repositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CreateAsync_WhenCpfIsNew_CreatesClienteWithNormalizedCpf()
    {
        var request = new ClienteCreateRequest
        {
            Nome = "Cliente Novo",
            Telefone = "11999999999",
            Cpf = "529.982.247-25"
        };

        Cliente? addedCliente = null;
        _repositoryMock
            .Setup(r => r.GetByCpfAsync(1, "52998224725", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Cliente?)null);
        _repositoryMock
            .Setup(r => r.AddAsync(It.IsAny<Cliente>(), It.IsAny<CancellationToken>()))
            .Callback<Cliente, CancellationToken>((cliente, _) => addedCliente = cliente)
            .Returns(Task.CompletedTask);
        _repositoryMock
            .Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var response = await _service.CreateAsync(1, request, CancellationToken.None);

        Assert.NotNull(addedCliente);
        Assert.Equal("52998224725", addedCliente!.Cpf);
        Assert.Equal("Cliente Novo", response.Nome);
        Assert.Equal("52998224725", response.Cpf);
        _repositoryMock.Verify(r => r.AddAsync(It.IsAny<Cliente>(), It.IsAny<CancellationToken>()), Times.Once);
        _repositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteAsync_WhenClienteExists_SetsDeletedAtAndReturnsTrue()
    {
        var cliente = new Cliente
        {
            Id = 3,
            Nome = "Cliente",
            Cpf = "12345678910",
            Telefone = "11999999999",
            Logradouro = "Rua A",
            Cidade = "Cidade",
            EmpresaId = 1
        };

        _repositoryMock
            .Setup(r => r.GetByIdAsync(1, 3, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(cliente);
        _repositoryMock
            .Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        await _service.DeleteAsync(1, 3, CancellationToken.None);

        Assert.NotNull(cliente.DeletedAt);
        // LGPD: a linha fica para o histórico, sem dados que identifiquem a pessoa.
        Assert.Equal("Cliente removido", cliente.Nome);
        Assert.Equal("ANON3", cliente.Cpf);
        Assert.Null(cliente.Telefone);
        Assert.Null(cliente.Logradouro);
        Assert.Null(cliente.Cidade);
        _repositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateAsync_WhenClienteNotFound_ThrowsNotFoundException()
    {
        var request = new ClienteUpdateRequest
        {
            Nome = "Atualizado",
            Telefone = "11911111111",
            Cpf = "987.654.321-00"
        };

        _repositoryMock
            .Setup(r => r.GetByIdAsync(1, 99, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Cliente?)null);

        await Assert.ThrowsAsync<MicroERP.Api.Services.Exceptions.NotFoundException>(
            () => _service.UpdateAsync(1, 99, request, CancellationToken.None));

        _repositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateAsync_WhenCpfChangesAndAlreadyExists_ThrowsCpfAlreadyExistsException()
    {
        var existingCliente = new Cliente
        {
            Id = 7,
            Nome = "Cliente 7",
            Telefone = "11988888888",
            Cpf = "12345678910",
            EmpresaId = 1
        };
        var request = new ClienteUpdateRequest
        {
            Nome = "Cliente Novo Nome",
            Telefone = "11977777777",
            Cpf = "111.444.777-35"
        };

        _repositoryMock
            .Setup(r => r.GetByIdAsync(1, 7, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingCliente);
        _repositoryMock
            .Setup(r => r.GetByCpfAsync(1, "11144477735", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Cliente { Id = 8, Cpf = "11144477735", EmpresaId = 1 });

        await Assert.ThrowsAsync<CpfAlreadyExistsException>(() =>
            _service.UpdateAsync(1, 7, request, CancellationToken.None));

        _repositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateAsync_WhenCpfChangesAndIsAvailable_UpdatesAndPersists()
    {
        var cliente = new Cliente
        {
            Id = 5,
            Nome = "Nome Antigo",
            Telefone = "11900000000",
            Cpf = "12345678910",
            EmpresaId = 1
        };
        var request = new ClienteUpdateRequest
        {
            Nome = "Nome Novo",
            Telefone = "11911111111",
            Cpf = "123.456.789-09"
        };

        _repositoryMock
            .Setup(r => r.GetByIdAsync(1, 5, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(cliente);
        _repositoryMock
            .Setup(r => r.GetByCpfAsync(1, "12345678909", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Cliente?)null);
        _repositoryMock
            .Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var response = await _service.UpdateAsync(1, 5, request, CancellationToken.None);

        Assert.NotNull(response);
        Assert.Equal("Nome Novo", response!.Nome);
        Assert.Equal("12345678909", response.Cpf);
        _repositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteAsync_WhenClienteNotFound_ThrowsNotFoundException()
    {
        _repositoryMock
            .Setup(r => r.GetByIdAsync(1, 77, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Cliente?)null);

        await Assert.ThrowsAsync<MicroERP.Api.Services.Exceptions.NotFoundException>(
            () => _service.DeleteAsync(1, 77, CancellationToken.None));

        _repositoryMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CreateAsync_PersisteERetornaEndereco()
    {
        var request = new ClienteCreateRequest
        {
            Nome = "Cliente Endereco",
            Cpf = "529.982.247-25",
            Logradouro = "Rua das Flores",
            Numero = "123",
            Bairro = "Centro",
            Cidade = "Uberaba",
            Cep = "38000-000"
        };

        Cliente? added = null;
        _repositoryMock
            .Setup(r => r.GetByCpfAsync(1, "52998224725", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Cliente?)null);
        _repositoryMock
            .Setup(r => r.AddAsync(It.IsAny<Cliente>(), It.IsAny<CancellationToken>()))
            .Callback<Cliente, CancellationToken>((c, _) => added = c)
            .Returns(Task.CompletedTask);
        _repositoryMock
            .Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var response = await _service.CreateAsync(1, request, CancellationToken.None);

        Assert.Equal("Rua das Flores", added!.Logradouro);
        Assert.Equal("123", added.Numero);
        Assert.Equal("Uberaba", added.Cidade);
        Assert.Equal("38000-000", added.Cep);
        Assert.Equal("Rua das Flores", response.Logradouro);
        Assert.Equal("Centro", response.Bairro);
    }
}
