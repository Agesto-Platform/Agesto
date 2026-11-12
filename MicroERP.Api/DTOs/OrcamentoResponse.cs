using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

public sealed class OrcamentoResponse
{
    public long Id { get; set; }
    public string Uuid { get; set; } = string.Empty;
    public long ClienteId { get; set; }
    // PAG-01: o web deixa de baixar todos os clientes para os nomes.
    public string? ClienteNome { get; set; }
    // Envio do orçamento por WhatsApp (link wa.me) direto da tela.
    public string? ClienteTelefone { get; set; }
    public StatusOrcamento Status { get; set; }
    public decimal ValorTotal { get; set; }
    public DateTime DataRegistro { get; set; }
    public long? AtendimentoConvertidoId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public IReadOnlyList<ItemOrcamentoResponse> Itens { get; set; } = Array.Empty<ItemOrcamentoResponse>();
}

// PAG-01: card de funil da tela de Orçamentos, sem baixar a lista inteira.
public sealed class OrcamentoResumoResponse
{
    public StatusOrcamento Status { get; set; }
    public int Quantidade { get; set; }
    public decimal ValorTotal { get; set; }
}

public sealed class ItemOrcamentoResponse
{
    public long Id { get; set; }
    public long? ProdutoId { get; set; }
    public long? ServicoId { get; set; }
    // PAG-01: rótulos do catálogo, mesmo de produto/serviço já excluído; o web não
    // precisa mais baixar os catálogos inteiros só para nomear os itens.
    public string? ProdutoNome { get; set; }
    public string? ServicoDescricao { get; set; }
    public TipoCobranca? TipoCobranca { get; set; }
    public string? Descricao { get; set; }
    public int Quantidade { get; set; }
    public decimal PrecoUnitario { get; set; }
    public decimal Subtotal { get; set; }
    public decimal? Custo { get; set; }
}
