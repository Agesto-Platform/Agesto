using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Services;

public sealed class ItemServicoService : IItemServicoService
{
    private readonly IItemServicoRepository _itemServicoRepository;
    private readonly IAtendimentoRepository _atendimentoRepository;
    private readonly IServicoRepository _servicoRepository;
    private readonly IItemProdutoRepository _itemProdutoRepository;

    public ItemServicoService(
        IItemServicoRepository itemServicoRepository,
        IAtendimentoRepository atendimentoRepository,
        IServicoRepository servicoRepository,
        IItemProdutoRepository itemProdutoRepository)
    {
        _itemServicoRepository = itemServicoRepository;
        _atendimentoRepository = atendimentoRepository;
        _servicoRepository = servicoRepository;
        _itemProdutoRepository = itemProdutoRepository;
    }

    public async Task<IReadOnlyList<ItemServicoResponse>> GetAllByAtendimentoAsync(long empresaId, long atendimentoId, CancellationToken cancellationToken)
    {
        var itens = await _itemServicoRepository.GetAllByAtendimentoAsync(empresaId, atendimentoId, cancellationToken);
        return itens.Select(MapResponse).ToList();
    }

    public async Task<ItemServicoResponse> GetByIdAsync(long empresaId, long id, CancellationToken cancellationToken)
    {
        var item = await _itemServicoRepository.GetByIdAsync(empresaId, id, false, cancellationToken);
        if (item is null) throw new NotFoundException("Item de serviço não encontrado.");
        return MapResponse(item);
    }

    public async Task<ItemServicoResponse> CreateAsync(long empresaId, ItemServicoCreateRequest request, CancellationToken cancellationToken)
    {
        var atendimento = await _atendimentoRepository.GetByIdAsync(empresaId, request.AtendimentoId, true, cancellationToken);
        if (atendimento is null) throw new NotFoundException("Atendimento não encontrado.");

        var servico = await _servicoRepository.GetByIdAsync(empresaId, request.ServicoId, false, cancellationToken);
        if (servico is null) throw new NotFoundException("Serviço não encontrado.");

        // Valor editavel (DEC-23): o catalogo sugere o valor; o prestador pode sobrescrever.
        var precoUnitario = request.PrecoUnitario ?? DefaultValorCatalogo(servico);
        var item = new ItemServico
        {
            Uuid = Guid.NewGuid(),
            AtendimentoId = request.AtendimentoId,
            ServicoId = request.ServicoId,
            Quantidade = request.Quantidade,
            PrecoUnitario = precoUnitario,
            // Empreitada nao multiplica por quantidade (DEC-04).
            Subtotal = servico.TipoCobranca == TipoCobranca.Empreitada
                ? precoUnitario
                : request.Quantidade * precoUnitario,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _itemServicoRepository.AddAsync(item, cancellationToken);
        await _itemServicoRepository.SaveChangesAsync(cancellationToken);

        await RecalculateTotalAsync(atendimento, cancellationToken);

        return MapResponse(item);
    }

    public async Task<ItemServicoResponse> UpdateAsync(long empresaId, long id, ItemServicoUpdateRequest request, CancellationToken cancellationToken)
    {
        var item = await _itemServicoRepository.GetByIdAsync(empresaId, id, true, cancellationToken);
        if (item is null) throw new NotFoundException("Item de serviço não encontrado.");

        var servico = await _servicoRepository.GetByIdAsync(empresaId, item.ServicoId, false, cancellationToken);
        if (servico is null) throw new NotFoundException("Serviço não encontrado.");

        // Valor editavel (DEC-23): sobrescreve se informado, senao mantem o snapshot atual.
        var precoUnitario = request.PrecoUnitario ?? item.PrecoUnitario;
        item.Quantidade = request.Quantidade;
        item.PrecoUnitario = precoUnitario;
        item.Subtotal = servico.TipoCobranca == TipoCobranca.Empreitada
            ? precoUnitario
            : item.Quantidade * precoUnitario;
        item.UpdatedAt = DateTime.UtcNow;

        await _itemServicoRepository.SaveChangesAsync(cancellationToken);

        var atendimento = await _atendimentoRepository.GetByIdAsync(empresaId, item.AtendimentoId, true, cancellationToken);
        if (atendimento is not null)
        {
            await RecalculateTotalAsync(atendimento, cancellationToken);
        }

        return MapResponse(item);
    }

    public async Task DeleteAsync(long empresaId, long id, CancellationToken cancellationToken)
    {
        var item = await _itemServicoRepository.GetByIdAsync(empresaId, id, true, cancellationToken);
        if (item is null) throw new NotFoundException("Item de serviço não encontrado.");

        item.DeletedAt = DateTime.UtcNow;
        item.UpdatedAt = DateTime.UtcNow;

        await _itemServicoRepository.SaveChangesAsync(cancellationToken);

        var atendimento = await _atendimentoRepository.GetByIdAsync(empresaId, item.AtendimentoId, true, cancellationToken);
        if (atendimento is not null)
        {
            await RecalculateTotalAsync(atendimento, cancellationToken);
        }
    }

    private async Task RecalculateTotalAsync(Atendimento atendimento, CancellationToken cancellationToken)
    {
        var totalProdutos = await _itemProdutoRepository.SumSubtotalByAtendimentoAsync(atendimento.Id, cancellationToken);
        var totalServicos = await _itemServicoRepository.SumSubtotalByAtendimentoAsync(atendimento.Id, cancellationToken);

        atendimento.ValorTotal = totalProdutos + totalServicos;
        // Custo so existe em itens de produto (material); custo de servico entra como avulso (DEC-19).
        atendimento.CustoTotal = await _itemProdutoRepository.SumCustoByAtendimentoAsync(atendimento.Id, cancellationToken);
        atendimento.UpdatedAt = DateTime.UtcNow;

        await _atendimentoRepository.SaveChangesAsync(cancellationToken);
    }

    private static decimal DefaultValorCatalogo(Servico servico) =>
        servico.TipoCobranca == TipoCobranca.Empreitada
            ? servico.ValorEmpreitada ?? 0m
            : servico.ValorHora ?? 0m;

    private static ItemServicoResponse MapResponse(ItemServico item)
    {
        return new ItemServicoResponse
        {
            Id = item.Id,
            Uuid = item.Uuid.ToString(),
            Quantidade = item.Quantidade,
            PrecoUnitario = item.PrecoUnitario,
            Subtotal = item.Subtotal,
            AtendimentoId = item.AtendimentoId,
            ServicoId = item.ServicoId,
            CreatedAt = item.CreatedAt,
            UpdatedAt = item.UpdatedAt
        };
    }
}