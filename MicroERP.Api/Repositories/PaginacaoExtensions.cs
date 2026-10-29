using Microsoft.EntityFrameworkCore;

namespace MicroERP.Api.Repositories;

public static class PaginacaoExtensions
{
    /// <summary>Conta o total e traz só a página pedida (a consulta já deve vir ordenada).</summary>
    public static async Task<(List<T> Itens, int Total)> ToPaginaAsync<T>(
        this IQueryable<T> query, int pagina, int tamanho, CancellationToken cancellationToken)
    {
        var total = await query.CountAsync(cancellationToken);
        var itens = await query.Skip((pagina - 1) * tamanho).Take(tamanho).ToListAsync(cancellationToken);
        return (itens, total);
    }
}
