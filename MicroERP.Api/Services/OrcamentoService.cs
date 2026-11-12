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

    public async Task<PaginaResponse<OrcamentoResponse>> GetPaginaAsync(long empresaId, PaginacaoQuery paginacao, OrcamentoFiltroQuery? filtro, CancellationToken cancellationToken)
    {
        var (itens, total) = await _orcamentoRepository.GetPaginaAsync(
            empresaId, paginacao.PaginaOuPadrao, paginacao.TamanhoOuPadrao, filtro?.Busca, filtro?.Status, cancellationToken);
        var rotulos = await _orcamentoRepository.GetRotulosDosItensAsync(
            empresaId, itens.SelectMany(o => o.Itens), cancellationToken);
        return new PaginaResponse<OrcamentoResponse>
        {
            Itens = itens.Select(o => MapResponse(o, rotulos)).ToList(),
            Pagina = paginacao.PaginaOuPadrao,
            Tamanho = paginacao.TamanhoOuPadrao,
            Total = total
        };
    }

    public async Task<OrcamentoResponse> GetByIdAsync(long empresaId, long id, CancellationToken cancellationToken)
    {
        var orcamento = await _orcamentoRepository.GetByIdAsync(empresaId, id, false, cancellationToken);
        if (orcamento is null) throw new NotFoundException("Orçamento não encontrado.");
        return await MapComRotulosAsync(empresaId, orcamento, cancellationToken);
    }

    // PAG-01: as quatro situações sempre presentes (zeradas quando não há nenhum).
    public async Task<IReadOnlyList<OrcamentoResumoResponse>> ResumirPorStatusAsync(long empresaId, CancellationToken cancellationToken)
    {
        var porStatus = await _orcamentoRepository.ResumirPorStatusAsync(empresaId, cancellationToken);
        return Enum.GetValues<StatusOrcamento>()
            .Select(status =>
            {
                var (quantidade, valorTotal) = porStatus.GetValueOrDefault(status);
                return new OrcamentoResumoResponse { Status = status, Quantidade = quantidade, ValorTotal = valorTotal };
            })
            .ToList();
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

            // Sem FK nessas colunas: garante que o item aponta para o catalogo da propria empresa.
            if (itemRequest.ProdutoId is { } produtoId && !await _dbContext.Produtos.AnyAsync(
                    p => p.Id == produtoId && p.EmpresaId == empresaId && p.DeletedAt == null, cancellationToken))
            {
                throw new NotFoundException($"Produto {produtoId} não encontrado.");
            }

            if (itemRequest.ServicoId is { } servicoId)
            {
                var tipoCobranca = await _dbContext.Servicos
                    .Where(s => s.Id == servicoId && s.EmpresaId == empresaId && s.DeletedAt == null)
                    .Select(s => (TipoCobranca?)s.TipoCobranca)
                    .FirstOrDefaultAsync(cancellationToken);
                if (tipoCobranca is null)
                    throw new NotFoundException($"Serviço {servicoId} não encontrado.");

                // E2E-02: no atendimento a empreitada não multiplica pela quantidade (DEC-04),
                // então o orçamento trava em 1 para cobrar o mesmo valor depois de convertido.
                // Para cobrar duas vezes, adiciona-se outra linha.
                if (tipoCobranca == TipoCobranca.Empreitada && itemRequest.Quantidade != 1)
                    throw new ArgumentException("Na empreitada, a quantidade é 1. Para cobrar de novo, adicione outra linha.");
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

        return await MapComRotulosAsync(empresaId, orcamento, cancellationToken, cliente);
    }

    public async Task<OrcamentoResponse> UpdateStatusAsync(long empresaId, long id, OrcamentoUpdateRequest request, CancellationToken cancellationToken)
    {
        var orcamento = await _orcamentoRepository.GetByIdAsync(empresaId, id, true, cancellationToken);
        if (orcamento is null) throw new NotFoundException("Orçamento não encontrado.");

        orcamento.Status = request.Status;
        orcamento.UpdatedAt = DateTime.UtcNow;

        await _orcamentoRepository.SaveChangesAsync(cancellationToken);

        return await MapComRotulosAsync(empresaId, orcamento, cancellationToken);
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
            // A checagem acima sozinha deixa duas conversões simultâneas passarem
            // (atendimento duplicado e estoque baixado duas vezes); a reserva trava o
            // orçamento até o commit e só a primeira segue.
            if (!await _orcamentoRepository.ReservarParaConversaoAsync(empresaId, id, cancellationToken))
                throw new ArgumentException("Orçamento já foi convertido.");

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

    private async Task<OrcamentoResponse> MapComRotulosAsync(long empresaId, Orcamento orcamento, CancellationToken cancellationToken, Cliente? cliente = null)
    {
        var rotulos = await _orcamentoRepository.GetRotulosDosItensAsync(empresaId, orcamento.Itens, cancellationToken);
        var resposta = MapResponse(orcamento, rotulos);
        if (cliente is not null)
        {
            resposta.ClienteNome = cliente.Nome;
            resposta.ClienteTelefone = cliente.Telefone;
        }
        return resposta;
    }

    // Também usado pela Carga do sync (ocultarCusto para o Agente).
    internal static OrcamentoResponse MapResponse(Orcamento orcamento, RotulosItensOrcamento rotulos, bool ocultarCusto = false)
    {
        return new OrcamentoResponse
        {
            Id = orcamento.Id,
            Uuid = orcamento.Uuid.ToString(),
            ClienteId = orcamento.ClienteId,
            ClienteNome = orcamento.Cliente?.Nome,
            ClienteTelefone = orcamento.Cliente?.Telefone,
            Status = orcamento.Status,
            ValorTotal = orcamento.ValorTotal,
            DataRegistro = orcamento.DataRegistro,
            AtendimentoConvertidoId = orcamento.AtendimentoConvertidoId,
            CreatedAt = orcamento.CreatedAt,
            UpdatedAt = orcamento.UpdatedAt,
            Itens = orcamento.Itens
                .Where(i => i.DeletedAt == null)
                .Select(i =>
                {
                    (string Descricao, TipoCobranca TipoCobranca)? servico =
                        i.ServicoId is { } servicoId && rotulos.Servicos.TryGetValue(servicoId, out var s) ? s : null;
                    return new ItemOrcamentoResponse
                    {
                        Id = i.Id,
                        ProdutoId = i.ProdutoId,
                        ServicoId = i.ServicoId,
                        ProdutoNome = i.ProdutoId is { } produtoId ? rotulos.Produtos.GetValueOrDefault(produtoId) : null,
                        ServicoDescricao = servico?.Descricao,
                        TipoCobranca = servico?.TipoCobranca,
                        Descricao = i.Descricao,
                        Quantidade = i.Quantidade,
                        PrecoUnitario = i.PrecoUnitario,
                        Subtotal = i.Subtotal,
                        Custo = ocultarCusto ? null : i.Custo
                    };
                })
                .ToList()
        };
    }
}
