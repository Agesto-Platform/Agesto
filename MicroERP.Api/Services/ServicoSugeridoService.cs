using MicroERP.Api.DTOs;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Services;

public sealed class ServicoSugeridoService : IServicoSugeridoService
{
    private readonly IServicoSugeridoRepository _sugeridoRepository;
    private readonly IServicoRepository _servicoRepository;
    private readonly IProdutoRepository _produtoRepository;

    public ServicoSugeridoService(
        IServicoSugeridoRepository sugeridoRepository,
        IServicoRepository servicoRepository,
        IProdutoRepository produtoRepository)
    {
        _sugeridoRepository = sugeridoRepository;
        _servicoRepository = servicoRepository;
        _produtoRepository = produtoRepository;
    }

    public async Task<IReadOnlyList<ServicoSugeridoResponse>> GetByServicoAsync(long empresaId, long servicoId, CancellationToken cancellationToken)
    {
        await EnsureServicoAsync(empresaId, servicoId, cancellationToken);

        var itens = await _sugeridoRepository.GetByServicoAsync(empresaId, servicoId, cancellationToken);
        return itens.Select(i => new ServicoSugeridoResponse
        {
            ProdutoId = i.ProdutoId,
            ProdutoNome = i.Produto?.Nome ?? string.Empty,
            QuantidadePadrao = i.QuantidadePadrao,
        }).ToList();
    }

    public async Task<IReadOnlyList<ServicoSugeridoResponse>> ReplaceAsync(long empresaId, long servicoId, IReadOnlyList<ServicoSugeridoRequest> itens, CancellationToken cancellationToken)
    {
        await EnsureServicoAsync(empresaId, servicoId, cancellationToken);

        // Dedup por ProdutoId (respeita o índice único; última quantidade vence).
        var dedup = itens.GroupBy(i => i.ProdutoId).Select(g => g.Last()).ToList();

        var now = DateTime.UtcNow;
        var novos = new List<ServicoItemSugerido>();
        var responses = new List<ServicoSugeridoResponse>();

        foreach (var item in dedup)
        {
            var produto = await _produtoRepository.GetByIdAsync(empresaId, item.ProdutoId, false, cancellationToken);
            if (produto is null)
                throw new NotFoundException($"Produto {item.ProdutoId} não encontrado.");

            novos.Add(new ServicoItemSugerido
            {
                EmpresaId = empresaId,
                ServicoId = servicoId,
                ProdutoId = item.ProdutoId,
                QuantidadePadrao = item.QuantidadePadrao,
                CreatedAt = now,
                UpdatedAt = now,
            });
            responses.Add(new ServicoSugeridoResponse
            {
                ProdutoId = produto.Id,
                ProdutoNome = produto.Nome,
                QuantidadePadrao = item.QuantidadePadrao,
            });
        }

        await _sugeridoRepository.ReplaceForServicoAsync(empresaId, servicoId, novos, cancellationToken);
        return responses;
    }

    private async Task EnsureServicoAsync(long empresaId, long servicoId, CancellationToken cancellationToken)
    {
        var servico = await _servicoRepository.GetByIdAsync(empresaId, servicoId, false, cancellationToken);
        if (servico is null)
            throw new NotFoundException("Serviço não encontrado.");
    }
}
