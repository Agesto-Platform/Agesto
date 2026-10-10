using MicroERP.Api.DTOs;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Services;

public sealed class ProdutoService : IProdutoService
{
    private readonly IProdutoRepository _produtoRepository;

    public ProdutoService(IProdutoRepository produtoRepository)
    {
        _produtoRepository = produtoRepository;
    }

    public async Task<IReadOnlyList<ProdutoResponse>> GetAllAsync(long empresaId, CancellationToken cancellationToken)
    {
        var produtos = await _produtoRepository.GetAllAsync(empresaId, cancellationToken);
        return produtos.Select(MapResponse).ToList();
    }

    public async Task<ProdutoResponse> GetByIdAsync(long empresaId, long id, CancellationToken cancellationToken)
    {
        var produto = await _produtoRepository.GetByIdAsync(empresaId, id, false, cancellationToken);
        if (produto is null) throw new NotFoundException("Produto não encontrado.");
        return MapResponse(produto);
    }

    public async Task<ProdutoResponse> CreateAsync(long empresaId, ProdutoCreateRequest request, CancellationToken cancellationToken)
    {
        var produto = new Produto
        {
            Uuid = Guid.NewGuid(),
            Nome = request.Nome,
            Preco = request.Preco,
            QuantidadeEstoque = request.QuantidadeEstoque,
            EmpresaId = empresaId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _produtoRepository.AddAsync(produto, cancellationToken);
        await _produtoRepository.SaveChangesAsync(cancellationToken);

        return MapResponse(produto);
    }

    public async Task<ProdutoResponse> UpdateAsync(long empresaId, long id, ProdutoUpdateRequest request, CancellationToken cancellationToken)
    {
        var produto = await _produtoRepository.GetByIdAsync(empresaId, id, true, cancellationToken);
        if (produto is null) throw new NotFoundException("Produto não encontrado.");

        produto.Nome = request.Nome;
        produto.Preco = request.Preco;
        produto.QuantidadeEstoque = request.QuantidadeEstoque;
        produto.UpdatedAt = DateTime.UtcNow;

        await _produtoRepository.SaveChangesAsync(cancellationToken);

        return MapResponse(produto);
    }

    public async Task DeleteAsync(long empresaId, long id, CancellationToken cancellationToken)
    {
        var produto = await _produtoRepository.GetByIdAsync(empresaId, id, true, cancellationToken);
        if (produto is null) throw new NotFoundException("Produto não encontrado.");

        produto.DeletedAt = DateTime.UtcNow;
        produto.UpdatedAt = DateTime.UtcNow;

        await _produtoRepository.SaveChangesAsync(cancellationToken);
    }

    private static ProdutoResponse MapResponse(Produto produto)
    {
        return new ProdutoResponse
        {
            Id = produto.Id,
            Uuid = produto.Uuid.ToString(),
            Nome = produto.Nome,
            Preco = produto.Preco,
            QuantidadeEstoque = produto.QuantidadeEstoque,
            CreatedAt = produto.CreatedAt,
            UpdatedAt = produto.UpdatedAt
        };
    }
}
