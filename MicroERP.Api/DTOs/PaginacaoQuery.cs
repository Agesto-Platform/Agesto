using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

/// <summary>
/// Paginação opcional das listas (?pagina=&amp;tamanho=). Sem nenhum dos dois a lista
/// vem inteira, como antes; com qualquer um deles vem uma <see cref="PaginaResponse{T}"/>.
/// </summary>
public sealed class PaginacaoQuery
{
    public const int TamanhoPadrao = 20;
    public const int TamanhoMaximo = 100;

    [Range(1, int.MaxValue, ErrorMessage = "Página inválida.")]
    public int? Pagina { get; set; }

    [Range(1, TamanhoMaximo, ErrorMessage = "O tamanho da página deve ficar entre 1 e 100.")]
    public int? Tamanho { get; set; }

    public bool Informada => Pagina.HasValue || Tamanho.HasValue;
    public int PaginaOuPadrao => Pagina ?? 1;
    public int TamanhoOuPadrao => Tamanho ?? TamanhoPadrao;
}
