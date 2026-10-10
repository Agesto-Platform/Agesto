using System.ComponentModel.DataAnnotations;
using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

public sealed class OrcamentoCreateRequest
{
    [Required(ErrorMessage = "Cliente obrigatorio.")]
    [Range(1, long.MaxValue, ErrorMessage = "Cliente invalido.")]
    public long ClienteId { get; set; }

    [EnumDataType(typeof(StatusOrcamento), ErrorMessage = "Status invalido.")]
    public StatusOrcamento Status { get; set; } = StatusOrcamento.Rascunho;

    [MinLength(1, ErrorMessage = "Informe ao menos um item.")]
    public List<ItemOrcamentoRequest> Itens { get; set; } = new();
}

public sealed class ItemOrcamentoRequest
{
    // Catalogo (ProdutoId ou ServicoId) ou avulso (ambos nulos + Descricao).
    [Range(1, long.MaxValue, ErrorMessage = "Produto invalido.")]
    public long? ProdutoId { get; set; }

    [Range(1, long.MaxValue, ErrorMessage = "Servico invalido.")]
    public long? ServicoId { get; set; }

    [MaxLength(200, ErrorMessage = "Descricao deve ter no maximo 200 caracteres.")]
    public string? Descricao { get; set; }

    [Range(1, 9999, ErrorMessage = "Quantidade invalida.")]
    public int Quantidade { get; set; }

    [Range(0, 999999.99, ErrorMessage = "Valor unitario invalido.")]
    public decimal PrecoUnitario { get; set; }

    [Range(0, 999999.99, ErrorMessage = "Custo invalido.")]
    public decimal? Custo { get; set; }
}
