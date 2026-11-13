using MicroERP.Api.Enums;
using MicroERP.Api.Models;

namespace MicroERP.Api.Repositories.Interfaces;

public interface IAtendimentoRepository
{
    Task<(List<Atendimento> Itens, int Total)> GetPaginaAsync(long empresaId, int pagina, int tamanho,
        string? busca, StatusAtendimento? status, long? clienteId, bool porRegistro, CancellationToken cancellationToken);
    Task<Dictionary<StatusAtendimento, int>> ContarPorStatusAsync(long empresaId, CancellationToken cancellationToken);
    Task<Dictionary<long, string?>> GetResumosAsync(long empresaId, IReadOnlyCollection<long> ids, CancellationToken cancellationToken);
    Task<List<Atendimento>> GetAgendaAsync(long empresaId, DateTime de, DateTime ate, long? usuarioId, CancellationToken cancellationToken);
    // Histórico do app: pela data agendada ou, sem ela, pela de registro; mais recentes primeiro.
    Task<List<Atendimento>> GetHistoricoAsync(long empresaId, DateTime de, DateTime ate, long? usuarioId, int limite, CancellationToken cancellationToken);
    Task<Atendimento?> GetByIdAsync(long empresaId, long id, bool track, CancellationToken cancellationToken);
    Task AddAsync(Atendimento atendimento, CancellationToken cancellationToken);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}