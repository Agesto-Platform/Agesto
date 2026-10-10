using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MicroERP.Api.Controllers;

[ApiController]
[Authorize]
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
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });
        }

        var resultado = await _syncService.CargaAsync(empresaId, ultimaSincronizacao, cancellationToken);
        return Ok(new ApiResponse
        {
            Success = true,
            Message = "Carga concluída.",
            Data = resultado
        });
    }

    [HttpPost("descarga")]
    public async Task<ActionResult<ApiResponse>> Descarga([FromBody] SyncDescargaRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId) || !TryGetUsuarioId(out var usuarioId))
        {
            return Unauthorized(new ApiResponse { Success = false, Message = "Token inválido." });
        }

        var resultado = await _syncService.DescargaAsync(empresaId, usuarioId, request, cancellationToken);
        return Ok(new ApiResponse
        {
            Success = true,
            Message = "Descarga concluída.",
            Data = resultado
        });
    }

}