using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

public sealed class AtendimentoResponse
{
    public long Id { get; set; }
    public string Uuid { get; set; } = string.Empty;
    public DateTime DataRegistro { get; set; }
    public DateTime? DataAgendada { get; set; }
    public StatusAtendimento Status { get; set; }
    public decimal ValorTotal { get; set; }
    public decimal CustoTotal { get; set; }
    public decimal Margem { get; set; }
    public long ClienteId { get; set; }
    public long UsuarioId { get; set; }
    // Primeiro serviço, senão o primeiro produto; nulo sem itens. Vem preenchido na listagem.
    public string? Resumo { get; set; }
    // Só na lista paginada (PAG-01): o web deixa de baixar todos os clientes para os nomes.
    public string? ClienteNome { get; set; }
    public string? ClienteTelefone { get; set; }
    public string? EnderecoResumo { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}