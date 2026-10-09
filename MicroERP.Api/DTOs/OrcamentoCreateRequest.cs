using System.ComponentModel.DataAnnotations;
using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

public sealed class OrcamentoCreateRequest
{
    [Required(ErrorMessage = "Cliente obrigatório.")]
    [Range(1, long.MaxValue, ErrorMessage = "Cliente inválido.")]
    public long ClienteId { get; set; }

    public StatusOrcamento Status { get; set; } = StatusOrcamento.Rascunho;

    [MinLength(1, ErrorMessage = "Informe ao menos um item.")]
    public List<ItemOrcamentoRequest> Itens { get; set; } = new();
}

public sealed class ItemOrcamentoRequest
{
    // Catalogo (ProdutoId ou ServicoId) ou avulso (ambos nulos + Descricao).
    [Range(1, long.MaxValue, ErrorMessage = "Produto inválido.")]
    public long? ProdutoId { get; set; }

    [Range(1, long.MaxValue, ErrorMessage = "Serviço inválido.")]
    public long? ServicoId { get; set; }

    [MaxLength(200, ErrorMessage = "Descrição deve ter no máximo 200 caracteres.")]
    public string? Descricao { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "Quantidade inválida.")]
    public int Quantidade { get; set; }

    [Range(0, double.MaxValue, ErrorMessage = "Valor unitário inválido.")]
    public decimal PrecoUnitario { get; set; }

    [Range(0, double.MaxValue, ErrorMessage = "Custo inválido.")]
    public decimal? Custo { get; set; }
}
