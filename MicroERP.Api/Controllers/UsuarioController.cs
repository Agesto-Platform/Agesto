using MicroERP.Api.Authorization;
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

    [HttpGet]
    [Authorize(Policy = Policies.Dono)]
    public async Task<ActionResult<ApiResponse>> GetAll(CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa nao identificada no token." });

        var usuarios = await _usuarioService.GetAllAsync(empresaId, cancellationToken);
        return Ok(new ApiResponse { Success = true, Message = "Usuarios encontrados.", Data = usuarios });
    }

    [HttpPost]
    [Authorize(Policy = Policies.Dono)]
    public async Task<ActionResult<ApiResponse>> Create([FromBody] UsuarioCreateRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa nao identificada no token." });

        try
        {
            var criado = await _usuarioService.CreateAsync(empresaId, request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, new ApiResponse
            {
                Success = true,
                Message = "Usuario criado com sucesso.",
                Data = criado
            });
        }
        catch (EmailAlreadyExistsException ex)
        {
            return Conflict(new ApiResponse { Success = false, Message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ApiResponse { Success = false, Message = ex.Message });
        }
    }

    [HttpPut("{id:long}")]
    [Authorize(Policy = Policies.Dono)]
    public async Task<ActionResult<ApiResponse>> Update(long id, [FromBody] UsuarioUpdateRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId) || !TryGetUsuarioId(out var donoId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Token invalido." });

        return await Executar(
            () => _usuarioService.UpdateAsync(empresaId, donoId, id, request, cancellationToken),
            "Usuario atualizado com sucesso.");
    }

    [HttpPost("{id:long}/desativar")]
    [Authorize(Policy = Policies.Dono)]
    public async Task<ActionResult<ApiResponse>> Desativar(long id, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId) || !TryGetUsuarioId(out var donoId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Token invalido." });

        return await Executar(
            () => _usuarioService.SetAtivoAsync(empresaId, donoId, id, false, cancellationToken),
            "Usuario desativado.");
    }

    [HttpPost("{id:long}/reativar")]
    [Authorize(Policy = Policies.Dono)]
    public async Task<ActionResult<ApiResponse>> Reativar(long id, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId) || !TryGetUsuarioId(out var donoId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Token invalido." });

        return await Executar(
            () => _usuarioService.SetAtivoAsync(empresaId, donoId, id, true, cancellationToken),
            "Usuario reativado.");
    }

    [HttpPost("{id:long}/redefinir-senha")]
    [Authorize(Policy = Policies.Dono)]
    public async Task<ActionResult<ApiResponse>> RedefinirSenha(long id, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa nao identificada no token." });

        return await Executar(
            () => _usuarioService.RedefinirSenhaAsync(empresaId, id, cancellationToken),
            "Senha provisoria gerada.");
    }

    // Exclusão da própria conta (LGPD). Liberada para qualquer perfil.
    [HttpDelete]
    public async Task<ActionResult<ApiResponse>> Delete(CancellationToken cancellationToken)
    {
        if (!TryGetUsuarioId(out var usuarioId) || !TryGetEmpresaId(out var empresaId))
        {
            return Unauthorized(new ApiResponse { Success = false, Message = "Token invalido." });
        }

        try
        {
            var deleted = await _usuarioService.DeleteAsync(usuarioId, empresaId, cancellationToken);
            if (!deleted)
            {
                return NotFound(new ApiResponse { Success = false, Message = "Usuario nao encontrado." });
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

    private async Task<ActionResult<ApiResponse>> Executar<T>(Func<Task<T>> acao, string mensagem)
    {
        try
        {
            var data = await acao();
            return Ok(new ApiResponse { Success = true, Message = mensagem, Data = data });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
        catch (RegraUsuarioException ex)
        {
            return Conflict(new ApiResponse { Success = false, Message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ApiResponse { Success = false, Message = ex.Message });
        }
    }
}
