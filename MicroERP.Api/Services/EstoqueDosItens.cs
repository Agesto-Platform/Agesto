using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;
using MicroERP.Api.Services.Exceptions;

namespace MicroERP.Api.Services;

// Baixa e devolução do estoque dos itens de produto de um atendimento, guiadas pela
// marca EstoqueBaixado de cada item. Usado ao cancelar, ao sair de Cancelado e na
// conclusão vinda do app. Só mexe nas entidades rastreadas; quem chama salva.
internal static class EstoqueDosItens
{
    public static async Task DevolverAsync(IEnumerable<ItemProduto> itens, long empresaId,
        IProdutoRepository produtoRepository, CancellationToken cancellationToken)
    {
        foreach (var item in itens.Where(i => i.EstoqueBaixado && i.ProdutoId.HasValue && i.DeletedAt == null))
        {
            var produto = await produtoRepository.GetByIdAsync(empresaId, item.ProdutoId!.Value, true, cancellationToken);
            if (produto is not null)
            {
                produto.QuantidadeEstoque += item.Quantidade;
                produto.UpdatedAt = DateTime.UtcNow;
            }
            item.EstoqueBaixado = false;
        }
    }

    // Tudo ou nada: confere o saldo de cada produto (somando as linhas) antes de baixar.
    public static async Task BaixarAsync(IEnumerable<ItemProduto> itens, long empresaId,
        IProdutoRepository produtoRepository, CancellationToken cancellationToken)
    {
        var pendentes = itens.Where(i => !i.EstoqueBaixado && i.ProdutoId.HasValue && i.DeletedAt == null).ToList();
        var produtos = new Dictionary<long, Produto>();
        foreach (var grupo in pendentes.GroupBy(i => i.ProdutoId!.Value))
        {
            var produto = await produtoRepository.GetByIdAsync(empresaId, grupo.Key, true, cancellationToken);
            if (produto is null) continue; // produto excluído: não há o que baixar
            if (produto.QuantidadeEstoque < grupo.Sum(i => i.Quantidade))
                throw new EstoqueInsuficienteException(produto.Nome);
            produtos[produto.Id] = produto;
        }

        foreach (var item in pendentes.Where(i => produtos.ContainsKey(i.ProdutoId!.Value)))
        {
            var produto = produtos[item.ProdutoId!.Value];
            produto.QuantidadeEstoque -= item.Quantidade;
            produto.UpdatedAt = DateTime.UtcNow;
            item.EstoqueBaixado = true;
        }
    }
}
