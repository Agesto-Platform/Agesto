using MicroERP.Api.Models;

namespace MicroERP.Api.Repositories.Interfaces;

public interface IAtendimentoRepository
{
    Task<List<Atendimento>> GetAllAsync(long empresaId, CancellationToken cancellationToken);
    Task<(List<Atendimento> Itens, int Total)> GetPaginaAsync(long empresaId, int pagina, int tamanho, CancellationToken cancellationToken);
    Task<List<Atendimento>> GetAgendaAsync(long empresaId, DateTime de, DateTime ate, long? usuarioId, CancellationToken cancellationToken);
    Task<Atendimento?> GetByIdAsync(long empresaId, long id, bool track, CancellationToken cancellationToken);
    Task AddAsync(Atendimento atendimento, CancellationToken cancellationToken);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}