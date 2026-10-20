using MicroERP.Api.DTOs;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;
using MicroERP.Api.Services.Interfaces;
using MicroERP.Api.Services.Exceptions;

namespace MicroERP.Api.Services;

public sealed class ItemProdutoService : IItemProdutoService
{
    private readonly IItemProdutoRepository _itemProdutoRepository;
    private readonly IAtendimentoRepository _atendimentoRepository;
    private readonly IProdutoRepository _produtoRepository;
    private readonly IItemServicoRepository _itemServicoRepository;
    private readonly IConfiguracaoRepository _configuracaoRepository;

    public ItemProdutoService(
        IItemProdutoRepository itemProdutoRepository,
        IAtendimentoRepository atendimentoRepository,
        IProdutoRepository produtoRepository,
        IItemServicoRepository itemServicoRepository,
        IConfiguracaoRepository configuracaoRepository)
    {
        _itemProdutoRepository = itemProdutoRepository;
        _atendimentoRepository = atendimentoRepository;
        _produtoRepository = produtoRepository;
        _itemServicoRepository = itemServicoRepository;
        _configuracaoRepository = configuracaoRepository;
    }

    // Se a empresa controla estoque (default seguro: sim). Quando false, itens
    // de catalogo nao baixam/devolvem estoque nem validam saldo (DEC-parametrizacao).
    private async Task<bool> ControlaEstoqueAsync(long empresaId, CancellationToken cancellationToken)
    {
        var config = await _configuracaoRepository.GetByEmpresaAsync(empresaId, false, cancellationToken);
        return config?.ControlaEstoque ?? true;
    }

    public async Task<IReadOnlyList<ItemProdutoResponse>> GetAllByAtendimentoAsync(long empresaId, long atendimentoId, CancellationToken cancellationToken)
    {
        var itens = await _itemProdutoRepository.GetAllByAtendimentoAsync(empresaId, atendimentoId, cancellationToken);
        return itens.Select(MapResponse).ToList();
    }

    public async Task<ItemProdutoResponse> GetByIdAsync(long empresaId, long id, CancellationToken cancellationToken)
    {
        var item = await _itemProdutoRepository.GetByIdAsync(empresaId, id, false, cancellationToken);
        if (item is null) throw new NotFoundException("Item de produto não encontrado.");
        return MapResponse(item);
    }

    public async Task<ItemProdutoResponse> CreateAsync(long empresaId, ItemProdutoCreateRequest request, CancellationToken cancellationToken)
    {
        var atendimento = await _atendimentoRepository.GetByIdAsync(empresaId, request.AtendimentoId, true, cancellationToken);
        if (atendimento is null) throw new NotFoundException("Atendimento não encontrado.");

        decimal precoUnitario;
        string? descricao;

        if (request.ProdutoId.HasValue)
        {
            // Item de catalogo: baixa estoque; catalogo sugere o valor (editavel).
            var produto = await _produtoRepository.GetByIdAsync(empresaId, request.ProdutoId.Value, true, cancellationToken);
            if (produto is null) throw new NotFoundException("Produto não encontrado.");

            if (await ControlaEstoqueAsync(empresaId, cancellationToken))
            {
                if (produto.QuantidadeEstoque < request.Quantidade)
                {
                    throw new EstoqueInsuficienteException(produto.Nome);
                }

                produto.QuantidadeEstoque -= request.Quantidade;
                produto.UpdatedAt = DateTime.UtcNow;
            }

            precoUnitario = request.PrecoUnitario ?? produto.Preco;
            descricao = string.IsNullOrWhiteSpace(request.Descricao) ? produto.Nome : request.Descricao;
        }
        else
        {
            // Item avulso (ex: material comprado na loja): nao baixa estoque, exige descricao.
            if (string.IsNullOrWhiteSpace(request.Descricao))
                throw new ArgumentException("Descrição obrigatória para item avulso.");

            precoUnitario = request.PrecoUnitario ?? 0m;
            descricao = request.Descricao;
        }

        var item = new ItemProduto
        {
            Uuid = Guid.NewGuid(),
            AtendimentoId = request.AtendimentoId,
            ProdutoId = request.ProdutoId,
            Descricao = descricao,
            Custo = request.Custo,
            Quantidade = request.Quantidade,
            PrecoUnitario = precoUnitario,
            Subtotal = request.Quantidade * precoUnitario,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _itemProdutoRepository.AddAsync(item, cancellationToken);
        await _itemProdutoRepository.SaveChangesAsync(cancellationToken);

        await RecalculateTotalAsync(atendimento, cancellationToken);

        return MapResponse(item);
    }

    public async Task<ItemProdutoResponse> UpdateAsync(long empresaId, long id, ItemProdutoUpdateRequest request, CancellationToken cancellationToken)
    {
        var item = await _itemProdutoRepository.GetByIdAsync(empresaId, id, true, cancellationToken);
        if (item is null) throw new NotFoundException("Item de produto não encontrado.");

        // Ajuste de estoque apenas para itens de catalogo (com ProdutoId) quando a empresa controla estoque.
        if (item.ProdutoId.HasValue && await ControlaEstoqueAsync(empresaId, cancellationToken))
        {
            var produto = await _produtoRepository.GetByIdAsync(empresaId, item.ProdutoId.Value, true, cancellationToken);
            if (produto is null) throw new NotFoundException("Produto não encontrado.");

            var diferenca = request.Quantidade - item.Quantidade;
            if (diferenca > 0 && produto.QuantidadeEstoque < diferenca)
            {
                throw new EstoqueInsuficienteException(produto.Nome);
            }

            produto.QuantidadeEstoque -= diferenca;
            produto.UpdatedAt = DateTime.UtcNow;
        }

        // Valor editavel (DEC-23): sobrescreve se informado, senao mantem o snapshot atual.
        var precoUnitario = request.PrecoUnitario ?? item.PrecoUnitario;

        item.Quantidade = request.Quantidade;
        item.PrecoUnitario = precoUnitario;
        item.Subtotal = request.Quantidade * precoUnitario;
        if (request.Custo.HasValue) item.Custo = request.Custo;
        if (!string.IsNullOrWhiteSpace(request.Descricao)) item.Descricao = request.Descricao;
        item.UpdatedAt = DateTime.UtcNow;

        await _itemProdutoRepository.SaveChangesAsync(cancellationToken);

        var atendimento = await _atendimentoRepository.GetByIdAsync(empresaId, item.AtendimentoId, true, cancellationToken);
        if (atendimento is not null)
        {
            await RecalculateTotalAsync(atendimento, cancellationToken);
        }

        return MapResponse(item);
    }

    public async Task DeleteAsync(long empresaId, long id, CancellationToken cancellationToken)
    {
        var item = await _itemProdutoRepository.GetByIdAsync(empresaId, id, true, cancellationToken);
        if (item is null) throw new NotFoundException("Item de produto não encontrado.");

        // Devolve estoque apenas para itens de catalogo (avulso nao movimentou
        // estoque) e apenas quando a empresa controla estoque.
        if (item.ProdutoId.HasValue && await ControlaEstoqueAsync(empresaId, cancellationToken))
        {
            var produto = await _produtoRepository.GetByIdAsync(empresaId, item.ProdutoId.Value, true, cancellationToken);
            if (produto is not null)
            {
                produto.QuantidadeEstoque += item.Quantidade;
                produto.UpdatedAt = DateTime.UtcNow;
            }
        }

        item.DeletedAt = DateTime.UtcNow;
        item.UpdatedAt = DateTime.UtcNow;

        await _itemProdutoRepository.SaveChangesAsync(cancellationToken);

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

    private static ItemProdutoResponse MapResponse(ItemProduto item)
    {
        return new ItemProdutoResponse
        {
            Id = item.Id,
            Uuid = item.Uuid.ToString(),
            Quantidade = item.Quantidade,
            PrecoUnitario = item.PrecoUnitario,
            Subtotal = item.Subtotal,
            Custo = item.Custo,
            Descricao = item.Descricao,
            AtendimentoId = item.AtendimentoId,
            ProdutoId = item.ProdutoId,
            CreatedAt = item.CreatedAt,
            UpdatedAt = item.UpdatedAt
        };
    }
}