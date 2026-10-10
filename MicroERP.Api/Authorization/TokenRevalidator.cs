using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;

namespace MicroERP.Api.Authorization;

// O JWT vale por horas; sem esta checagem, um usuário excluído ou com perfil
// alterado continuaria com acesso até o token expirar. Custa uma consulta por
// chave primária a cada requisição autenticada.
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
            .Select(u => new { u.EmpresaId, u.Perfil })
            .FirstOrDefaultAsync(cancellationToken);

        return usuario is not null
            && usuario.EmpresaId == empresaId
            && usuario.Perfil.ToString() == perfil;
    }
}
