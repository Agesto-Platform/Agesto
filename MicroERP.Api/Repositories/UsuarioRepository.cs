using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.Models;
using MicroERP.Api.Enums;
using MicroERP.Api.Repositories.Interfaces;

namespace MicroERP.Api.Repositories;

public sealed class UsuarioRepository : IUsuarioRepository
{
    private readonly AppDbContext _dbContext;

    public UsuarioRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<Usuario?> GetByIdAsync(long empresaId, long id, CancellationToken cancellationToken)
    {
        return await _dbContext.Usuarios
            .FirstOrDefaultAsync(u => u.Id == id && u.EmpresaId == empresaId && u.DeletedAt == null, cancellationToken);
    }

    public async Task<IReadOnlyList<Usuario>> GetAllAsync(long empresaId, CancellationToken cancellationToken)
    {
        return await _dbContext.Usuarios
            .AsNoTracking()
            .Where(u => u.EmpresaId == empresaId && u.DeletedAt == null)
            .OrderByDescending(u => u.Ativo)
            .ThenBy(u => u.Nome)
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken)
    {
        return await _dbContext.Usuarios.AnyAsync(u => u.Email == email, cancellationToken);
    }

    public async Task<int> CountDonosAtivos(long empresaId, CancellationToken cancellationToken)
    {
        return await _dbContext.Usuarios
            .CountAsync(u => u.EmpresaId == empresaId && u.Perfil == PerfilUsuario.Dono && u.Ativo, cancellationToken);
    }

    public async Task AddAsync(Usuario usuario, CancellationToken cancellationToken)
    {
        await _dbContext.Usuarios.AddAsync(usuario, cancellationToken);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}