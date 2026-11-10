using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;

namespace MicroERP.Api.Authorization;

// O JWT vale por 30 dias (DEC-50); sem esta checagem, um usuário excluído, desativado ou
// com perfil alterado continuaria com acesso até o token expirar. O mesmo vale para a
// empresa suspensa na área de superadmin. Custa uma consulta por requisição autenticada.
public static class TokenRevalidator
{
    public static async Task<bool> IsValidAsync(AppDbContext db, ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        var sub = principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? principal.FindFirstValue("sub");
        if (!long.TryParse(sub, out var usuarioId)
            || !long.TryParse(principal.FindFirstValue("empresaId"), out var empresaId))
        {
            return false;
        }

        var perfil = principal.FindFirstValue("perfil");
        var usuario = await db.Usuarios
            .AsNoTracking()
            .Where(u => u.Id == usuarioId)
            .Select(u => new
            {
                u.EmpresaId,
                u.Perfil,
                u.Ativo,
                EmpresaSuspensa = db.Empresas.Any(e => e.Id == u.EmpresaId && !e.Ativa),
            })
            .FirstOrDefaultAsync(cancellationToken);

        return usuario is not null
            && usuario.Ativo
            && !usuario.EmpresaSuspensa
            && usuario.EmpresaId == empresaId
            && usuario.Perfil.ToString() == perfil;
    }

    // Token da área de superadmin: o admin precisa existir e estar ativo.
    public static async Task<bool> IsAdminValidAsync(AppDbContext db, ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        var sub = principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? principal.FindFirstValue("sub");
        if (!long.TryParse(sub, out var adminId)
            || principal.FindFirstValue(AdminAuth.ClaimEscopo) != AdminAuth.EscopoPlataforma)
        {
            return false;
        }

        return await db.AdminsPlataforma
            .AsNoTracking()
            .AnyAsync(a => a.Id == adminId && a.Ativo, cancellationToken);
    }
}
