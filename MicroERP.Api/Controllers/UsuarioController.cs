using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MicroERP.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class UsuarioController : ApiControllerBase
{
    private readonly IUsuarioService _usuarioService;

    public UsuarioController(IUsuarioService usuarioService)
    {
        _usuarioService = usuarioService;
    }

    [HttpDelete]
    public async Task<ActionResult<ApiResponse>> Delete(CancellationToken cancellationToken)
    {
        if (!TryGetUsuarioId(out var usuarioId) || !TryGetEmpresaId(out var empresaId))
        {
            return Unauthorized(new ApiResponse { Success = false, Message = "Token inválido." });
        }

        try
        {
            var deleted = await _usuarioService.DeleteAsync(usuarioId, empresaId, cancellationToken);
            if (!deleted)
            {
                return NotFound(new ApiResponse { Success = false, Message = "Usuário não encontrado." });
            }

            return Ok(new ApiResponse
            {
                Success = true,
                Message = "Conta removida com sucesso."
            });
        }
        catch (UltimoDonoDaEmpresaException ex)
        {
            return Conflict(new ApiResponse { Success = false, Message = ex.Message });
        }
    }

}