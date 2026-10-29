namespace MicroERP.Api.DTOs;

public sealed class PaginaResponse<T>
{
    public IReadOnlyList<T> Itens { get; set; } = Array.Empty<T>();
    public int Pagina { get; set; }
    public int Tamanho { get; set; }
    public int Total { get; set; }
}
