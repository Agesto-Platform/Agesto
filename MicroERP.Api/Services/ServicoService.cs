using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Services;

public sealed class ServicoService : IServicoService
{
    private readonly IServicoRepository _servicoRepository;

    public ServicoService(IServicoRepository servicoRepository)
    {
        _servicoRepository = servicoRepository;
    }

    public async Task<IReadOnlyList<ServicoResponse>> GetAllAsync(long empresaId, CancellationToken cancellationToken)
    {
        var servicos = await _servicoRepository.GetAllAsync(empresaId, cancellationToken);
        return servicos.Select(MapResponse).ToList();
    }

    public async Task<ServicoResponse> GetByIdAsync(long empresaId, long id, CancellationToken cancellationToken)
    {
        var servico = await _servicoRepository.GetByIdAsync(empresaId, id, false, cancellationToken);
        if (servico is null) throw new NotFoundException("Serviço não encontrado.");
        return MapResponse(servico);
    }

    public async Task<ServicoResponse> CreateAsync(long empresaId, ServicoCreateRequest request, CancellationToken cancellationToken)
    {

        if (request.TipoCobranca == TipoCobranca.Empreitada && request.ValorEmpreitada is null)
            throw new ArgumentException("ValorEmpreitada é obrigatório para TipoCobranca Empreitada.");

        if (request.TipoCobranca == TipoCobranca.PorHora && request.ValorHora is null)
            throw new ArgumentException("ValorHora obrigatório para cobrança por Hora.");

        var servico = new Servico
        {
            Uuid = Guid.NewGuid(),
            Descricao = request.Descricao,
            TipoCobranca = request.TipoCobranca,
            ValorHora = request.ValorHora,
            ValorEmpreitada = request.ValorEmpreitada,
            EmpresaId = empresaId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };


        await _servicoRepository.AddAsync(servico, cancellationToken);
        await _servicoRepository.SaveChangesAsync(cancellationToken);

        return MapResponse(servico);
    }

    public async Task<ServicoResponse> UpdateAsync(long empresaId, long id, ServicoUpdateRequest request, CancellationToken cancellationToken)
    {
        var servico = await _servicoRepository.GetByIdAsync(empresaId, id, true, cancellationToken);
        if (servico is null) throw new NotFoundException("Serviço não encontrado.");

        servico.Descricao = request.Descricao;
        servico.TipoCobranca = request.TipoCobranca;
        servico.ValorEmpreitada = request.ValorEmpreitada;
        servico.ValorHora = request.ValorHora;
        servico.UpdatedAt = DateTime.UtcNow;

        await _servicoRepository.SaveChangesAsync(cancellationToken);

        return MapResponse(servico);
    }

    public async Task DeleteAsync(long empresaId, long id, CancellationToken cancellationToken)
    {
        var servico = await _servicoRepository.GetByIdAsync(empresaId, id, true, cancellationToken);
        if (servico is null) throw new NotFoundException("Serviço não encontrado.");

        servico.DeletedAt = DateTime.UtcNow;
        servico.UpdatedAt = DateTime.UtcNow;

        await _servicoRepository.SaveChangesAsync(cancellationToken);
    }

    private static ServicoResponse MapResponse(Servico servico)
    {
        return new ServicoResponse
        {
            Id = servico.Id,
            Uuid = servico.Uuid.ToString(),
            Descricao = servico.Descricao,
            TipoCobranca = servico.TipoCobranca,
            ValorHora = servico.ValorHora,
            ValorEmpreitada = servico.ValorEmpreitada,
            CreatedAt = servico.CreatedAt,
            UpdatedAt = servico.UpdatedAt
        };
    }
}
