using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

// Item de agenda enriquecido para o mobile: evita N+1 trazendo nome/endereco do
// cliente e um resumo do servico junto do atendimento agendado.
public sealed class AgendaItemResponse
{
    public long Id { get; set; }
    public string Uuid { get; set; } = string.Empty;
    public DateTime? DataAgendada { get; set; }
    public StatusAtendimento Status { get; set; }
    public decimal ValorTotal { get; set; }
    public long UsuarioId { get; set; }

    public long ClienteId { get; set; }
    public string ClienteNome { get; set; } = string.Empty;
    public string? ClienteTelefone { get; set; }
    public string? EnderecoResumo { get; set; }

    // Titulo curto do atendimento (primeiro servico; senao primeiro produto).
    public string Resumo { get; set; } = string.Empty;
}
