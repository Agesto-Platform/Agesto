using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

/// <summary>
/// Paginação das listas (?pagina=&amp;tamanho=). PAG-01 fase 3: a lista vem sempre numa
/// <see cref="PaginaResponse{T}"/>; sem parâmetros, primeira página com 20 itens.
/// </summary>
public sealed class PaginacaoQuery
{
    public const int TamanhoPadrao = 20;
    public const int TamanhoMaximo = 100;

    [Range(1, int.MaxValue, ErrorMessage = "Página inválida.")]
    public int? Pagina { get; set; }

    [Range(1, TamanhoMaximo, ErrorMessage = "O tamanho da página deve ficar entre 1 e 100.")]
    public int? Tamanho { get; set; }

    public int PaginaOuPadrao => Pagina ?? 1;
    public int TamanhoOuPadrao => Tamanho ?? TamanhoPadrao;
}
