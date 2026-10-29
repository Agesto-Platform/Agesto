using MicroERP.Api.Models;

namespace MicroERP.Api.Repositories.Interfaces;

public interface IServicoRepository
{
    Task<List<Servico>> GetAllAsync(long empresaId, CancellationToken cancellationToken);
    Task<(List<Servico> Itens, int Total)> GetPaginaAsync(long empresaId, int pagina, int tamanho, CancellationToken cancellationToken);
    Task<Servico?> GetByIdAsync(long empresaId, long id, bool track, CancellationToken cancellationToken);
    // Serviço ativo com a mesma descrição (sem diferenciar caixa), para o app não duplicar o catálogo.
    Task<Servico?> GetByDescricaoAsync(long empresaId, string descricao, CancellationToken cancellationToken);
    Task AddAsync(Servico servico, CancellationToken cancellationToken);
    Task SaveChangesAsync(CancellationToken cancellationToken);
}