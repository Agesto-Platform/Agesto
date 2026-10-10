using MicroERP.Api.DTOs;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Services;

public sealed class ClienteService : IClienteService
{
    private readonly IClienteRepository _clienteRepository;

    public ClienteService(IClienteRepository clienteRepository)
    {
        _clienteRepository = clienteRepository;
    }

    public async Task<IReadOnlyList<ClienteResponse>> GetAllAsync(long empresaId, CancellationToken cancellationToken)
    {
        var clientes = await _clienteRepository.GetAllAsync(empresaId, cancellationToken);
        return clientes.Select(MapResponse).ToList();
    }

    public async Task<ClienteResponse> GetByIdAsync(long empresaId, long id, CancellationToken cancellationToken)
    {
        var cliente = await _clienteRepository.GetByIdAsync(empresaId, id, false, cancellationToken);
        if (cliente is null) throw new NotFoundException("Cliente nao encontrado.");
        return MapResponse(cliente);
    }

    public async Task<ClienteResponse> CreateAsync(long empresaId, ClienteCreateRequest request, CancellationToken cancellationToken)
    {
        var cpf = NormalizeCpf(request.Cpf);
        var existing = await _clienteRepository.GetByCpfAsync(empresaId, cpf, cancellationToken);
        if (existing is not null)
        {
            throw new CpfAlreadyExistsException("CPF ja cadastrado.");
        }

        var cliente = new Cliente
        {
            Uuid = request.Uuid ?? Guid.NewGuid(),
            Nome = request.Nome,
            Telefone = request.Telefone,
            Cpf = cpf,
            Logradouro = request.Logradouro,
            Numero = request.Numero,
            Bairro = request.Bairro,
            Cidade = request.Cidade,
            Cep = request.Cep,
            EmpresaId = empresaId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _clienteRepository.AddAsync(cliente, cancellationToken);
        await _clienteRepository.SaveChangesAsync(cancellationToken);

        return MapResponse(cliente);
    }

    public async Task<ClienteResponse> UpdateAsync(long empresaId, long id, ClienteUpdateRequest request, CancellationToken cancellationToken)
    {
        var cliente = await _clienteRepository.GetByIdAsync(empresaId, id, true, cancellationToken);
        if (cliente is null) throw new NotFoundException("Cliente nao encontrado.");

        var cpf = NormalizeCpf(request.Cpf);
        if (!string.Equals(cliente.Cpf, cpf, StringComparison.Ordinal))
        {
            var existing = await _clienteRepository.GetByCpfAsync(empresaId, cpf, cancellationToken);
            if (existing is not null)
            {
                throw new CpfAlreadyExistsException("CPF ja cadastrado.");
            }
        }

        cliente.Nome = request.Nome;
        cliente.Telefone = request.Telefone;
        cliente.Cpf = cpf;
        cliente.Logradouro = request.Logradouro;
        cliente.Numero = request.Numero;
        cliente.Bairro = request.Bairro;
        cliente.Cidade = request.Cidade;
        cliente.Cep = request.Cep;
        cliente.UpdatedAt = DateTime.UtcNow;

        await _clienteRepository.SaveChangesAsync(cancellationToken);

        return MapResponse(cliente);
    }

    public async Task DeleteAsync(long empresaId, long id, CancellationToken cancellationToken)
    {
        var cliente = await _clienteRepository.GetByIdAsync(empresaId, id, true, cancellationToken);
        if (cliente is null) throw new NotFoundException("Cliente nao encontrado.");

        DadosPessoais.Anonimizar(cliente);
        cliente.DeletedAt = DateTime.UtcNow;
        cliente.UpdatedAt = DateTime.UtcNow;

        await _clienteRepository.SaveChangesAsync(cancellationToken);
    }

    private static string NormalizeCpf(string cpf)
    {
        var digits = cpf.Where(char.IsDigit).ToArray();
        if (digits.Length != 11)
            throw new ArgumentException("CPF deve conter 11 digitos.");

        var normalized = new string(digits);

        // Rejeita sequências triviais (ex: 111.111.111-11)
        if (digits.Distinct().Count() == 1)
            throw new ArgumentException("CPF invalido.");

        // Primeiro dígito verificador
        var sum = 0;
        for (var i = 0; i < 9; i++) sum += (digits[i] - '0') * (10 - i);
        var remainder = (sum * 10) % 11;
        if (remainder == 10) remainder = 0;
        if (remainder != digits[9] - '0')
            throw new ArgumentException("CPF invalido.");

        // Segundo dígito verificador
        sum = 0;
        for (var i = 0; i < 10; i++) sum += (digits[i] - '0') * (11 - i);
        remainder = (sum * 10) % 11;
        if (remainder == 10) remainder = 0;
        if (remainder != digits[10] - '0')
            throw new ArgumentException("CPF invalido.");

        return normalized;
    }

    private static ClienteResponse MapResponse(Cliente cliente)
    {
        return new ClienteResponse
        {
            Id = cliente.Id,
            Uuid = cliente.Uuid.ToString(),
            Nome = cliente.Nome,
            Telefone = cliente.Telefone,
            Cpf = cliente.Cpf,
            Logradouro = cliente.Logradouro,
            Numero = cliente.Numero,
            Bairro = cliente.Bairro,
            Cidade = cliente.Cidade,
            Cep = cliente.Cep,
            CreatedAt = cliente.CreatedAt,
            UpdatedAt = cliente.UpdatedAt
        };
    }
}
