using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MicroERP.Api.Authorization;

namespace MicroERP.Api.Controllers;

[ApiController]
[Authorize]
[EnableRateLimiting(RateLimits.Sync)]
[Route("api/[controller]")]
public sealed class SyncController : ApiControllerBase
{
    private readonly ISyncService _syncService;

    public SyncController(ISyncService syncService)
    {
        _syncService = syncService;
    }

    [HttpGet("carga")]
    public async Task<ActionResult<ApiResponse>> Carga([FromQuery] DateTime? ultimaSincronizacao, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
        {
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa nao identificada no token." });
        }

        // Sem perfil identificável, trata como Agente (o mais restrito).
        var restringir = !TryGetPerfil(out var perfil) || perfil != PerfilUsuario.Dono;
        var resultado = await _syncService.CargaAsync(empresaId, ultimaSincronizacao, cancellationToken, restringir);
        return Ok(new ApiResponse
        {
            Success = true,
            Message = "Carga concluida.",
            Data = resultado
        });
    }

    [HttpPost("descarga")]
    [RequestSizeLimit(1024 * 1024)]
    public async Task<ActionResult<ApiResponse>> Descarga([FromBody] SyncDescargaRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId) || !TryGetUsuarioId(out var usuarioId))
        {
            return Unauthorized(new ApiResponse { Success = false, Message = "Token invalido." });
        }

        var resultado = await _syncService.DescargaAsync(empresaId, usuarioId, request, cancellationToken);
        return Ok(new ApiResponse
        {
            Success = true,
            Message = "Descarga concluida.",
            Data = resultado
        });
    }

}