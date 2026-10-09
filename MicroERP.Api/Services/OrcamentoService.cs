using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Services;

public sealed class OrcamentoService : IOrcamentoService
{
    private readonly AppDbContext _dbContext;
    private readonly IOrcamentoRepository _orcamentoRepository;
    private readonly IClienteRepository _clienteRepository;
    private readonly IAtendimentoService _atendimentoService;
    private readonly IItemProdutoService _itemProdutoService;
    private readonly IItemServicoService _itemServicoService;

    public OrcamentoService(
        AppDbContext dbContext,
        IOrcamentoRepository orcamentoRepository,
        IClienteRepository clienteRepository,
        IAtendimentoService atendimentoService,
        IItemProdutoService itemProdutoService,
        IItemServicoService itemServicoService)
    {
        _dbContext = dbContext;
        _orcamentoRepository = orcamentoRepository;
        _clienteRepository = clienteRepository;
        _atendimentoService = atendimentoService;
        _itemProdutoService = itemProdutoService;
        _itemServicoService = itemServicoService;
    }

    public async Task<IReadOnlyList<OrcamentoResponse>> GetAllAsync(long empresaId, CancellationToken cancellationToken)
    {
        var orcamentos = await _orcamentoRepository.GetAllAsync(empresaId, cancellationToken);
        return orcamentos.Select(MapResponse).ToList();
    }

    public async Task<OrcamentoResponse> GetByIdAsync(long empresaId, long id, CancellationToken cancellationToken)
    {
        var orcamento = await _orcamentoRepository.GetByIdAsync(empresaId, id, false, cancellationToken);
        if (orcamento is null) throw new NotFoundException("Orçamento não encontrado.");
        return MapResponse(orcamento);
    }

    public async Task<OrcamentoResponse> CreateAsync(long empresaId, long usuarioId, OrcamentoCreateRequest request, CancellationToken cancellationToken)
    {
        var cliente = await _clienteRepository.GetByIdAsync(empresaId, request.ClienteId, false, cancellationToken);
        if (cliente is null) throw new NotFoundException("Cliente não encontrado.");

        var itens = new List<ItemOrcamento>();
        foreach (var itemRequest in request.Itens)
        {
            // Item generico e mutuamente exclusivo: produto OU servico, nunca os dois.
            if (itemRequest.ProdutoId.HasValue && itemRequest.ServicoId.HasValue)
            {
                throw new ArgumentException("Item não pode ter produto e serviço ao mesmo tempo.");
            }

            // Item avulso (sem catalogo) exige descricao.
            if (!itemRequest.ProdutoId.HasValue && !itemRequest.ServicoId.HasValue
                && string.IsNullOrWhiteSpace(itemRequest.Descricao))
            {
                throw new ArgumentException("Item sem produto/serviço exige descrição.");
            }

            itens.Add(new ItemOrcamento
            {
                Uuid = Guid.NewGuid(),
                ProdutoId = itemRequest.ProdutoId,
                ServicoId = itemRequest.ServicoId,
                Descricao = itemRequest.Descricao,
                Quantidade = itemRequest.Quantidade,
                PrecoUnitario = itemRequest.PrecoUnitario,
                Subtotal = itemRequest.Quantidade * itemRequest.PrecoUnitario,
                Custo = itemRequest.Custo,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }

        var orcamento = new Orcamento
        {
            Uuid = Guid.NewGuid(),
            EmpresaId = empresaId,
            UsuarioId = usuarioId,
            ClienteId = request.ClienteId,
            Status = request.Status,
            DataRegistro = DateTime.UtcNow,
            ValorTotal = itens.Sum(i => i.Subtotal),
            Itens = itens,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _orcamentoRepository.AddAsync(orcamento, cancellationToken);
        await _orcamentoRepository.SaveChangesAsync(cancellationToken);

        return MapResponse(orcamento);
    }

    public async Task<OrcamentoResponse> UpdateStatusAsync(long empresaId, long id, OrcamentoUpdateRequest request, CancellationToken cancellationToken)
    {
        var orcamento = await _orcamentoRepository.GetByIdAsync(empresaId, id, true, cancellationToken);
        if (orcamento is null) throw new NotFoundException("Orçamento não encontrado.");

        orcamento.Status = request.Status;
        orcamento.UpdatedAt = DateTime.UtcNow;

        await _orcamentoRepository.SaveChangesAsync(cancellationToken);

        return MapResponse(orcamento);
    }

    public async Task DeleteAsync(long empresaId, long id, CancellationToken cancellationToken)
    {
        var orcamento = await _orcamentoRepository.GetByIdAsync(empresaId, id, true, cancellationToken);
        if (orcamento is null) throw new NotFoundException("Orçamento não encontrado.");

        var now = DateTime.UtcNow;
        orcamento.DeletedAt = now;
        orcamento.UpdatedAt = now;
        foreach (var item in orcamento.Itens)
            item.DeletedAt = now;

        await _orcamentoRepository.SaveChangesAsync(cancellationToken);
    }

    public async Task<AtendimentoResponse> ConverterAsync(long empresaId, long usuarioId, long id, CancellationToken cancellationToken)
    {
        var orcamento = await _orcamentoRepository.GetByIdAsync(empresaId, id, true, cancellationToken);
        if (orcamento is null) throw new NotFoundException("Orçamento não encontrado.");

        if (orcamento.Status != StatusOrcamento.Aprovado)
            throw new ArgumentException("Somente orçamentos aprovados podem ser convertidos.");
        if (orcamento.AtendimentoConvertidoId is not null)
            throw new ArgumentException("Orçamento já foi convertido.");

        // Transacional: se qualquer item falhar (ex: estoque), desfaz tudo. Estoque so
        // baixa aqui, na conversao (DEC-16), reaproveitando os item-services.
        await using var tx = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var atendimento = await _atendimentoService.CreateAsync(empresaId, usuarioId,
                new AtendimentoCreateRequest { ClienteId = orcamento.ClienteId, Status = StatusAtendimento.Pendente },
                cancellationToken);

            foreach (var item in orcamento.Itens)
            {
                if (item.ServicoId.HasValue)
                {
                    await _itemServicoService.CreateAsync(empresaId, new ItemServicoCreateRequest
                    {
                        AtendimentoId = atendimento.Id,
                        ServicoId = item.ServicoId.Value,
                        PrecoUnitario = item.PrecoUnitario,
                        Quantidade = item.Quantidade
                    }, cancellationToken);
                }
                else
                {
                    await _itemProdutoService.CreateAsync(empresaId, new ItemProdutoCreateRequest
                    {
                        AtendimentoId = atendimento.Id,
                        ProdutoId = item.ProdutoId,
                        Descricao = item.Descricao,
                        PrecoUnitario = item.PrecoUnitario,
                        Custo = item.Custo,
                        Quantidade = item.Quantidade
                    }, cancellationToken);
                }
            }

            orcamento.AtendimentoConvertidoId = atendimento.Id;
            orcamento.UpdatedAt = DateTime.UtcNow;
            await _orcamentoRepository.SaveChangesAsync(cancellationToken);

            await tx.CommitAsync(cancellationToken);

            // Retorna o atendimento ja com os totais recalculados pelos item-services.
            return await _atendimentoService.GetByIdAsync(empresaId, atendimento.Id, cancellationToken);
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private static OrcamentoResponse MapResponse(Orcamento orcamento)
    {
        return new OrcamentoResponse
        {
            Id = orcamento.Id,
            Uuid = orcamento.Uuid.ToString(),
            ClienteId = orcamento.ClienteId,
            Status = orcamento.Status,
            ValorTotal = orcamento.ValorTotal,
            DataRegistro = orcamento.DataRegistro,
            AtendimentoConvertidoId = orcamento.AtendimentoConvertidoId,
            CreatedAt = orcamento.CreatedAt,
            UpdatedAt = orcamento.UpdatedAt,
            Itens = orcamento.Itens
                .Where(i => i.DeletedAt == null)
                .Select(i => new ItemOrcamentoResponse
                {
                    Id = i.Id,
                    ProdutoId = i.ProdutoId,
                    ServicoId = i.ServicoId,
                    Descricao = i.Descricao,
                    Quantidade = i.Quantidade,
                    PrecoUnitario = i.PrecoUnitario,
                    Subtotal = i.Subtotal,
                    Custo = i.Custo
                })
                .ToList()
        };
    }
}
