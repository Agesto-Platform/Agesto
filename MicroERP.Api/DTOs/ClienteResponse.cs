namespace MicroERP.Api.DTOs;

public sealed class ClienteResponse
{
    public long Id { get; set; }
    public string Uuid { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public string? Telefone { get; set; }
    public string Cpf { get; set; } = string.Empty;
    public string? Logradouro { get; set; }
    public string? Numero { get; set; }
    public string? Bairro { get; set; }
    public string? Cidade { get; set; }
    public string? Cep { get; set; }
    // Só na lista paginada (PAG-01): atendimentos vivos do cliente e a data do mais
    // recente (agendada, senão a de registro).
    public int? TotalAtendimentos { get; set; }
    public DateTime? UltimoAtendimento { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
