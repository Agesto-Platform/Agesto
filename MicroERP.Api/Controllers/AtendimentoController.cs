using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MicroERP.Api.Authorization;
using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
// A agenda é liberada ao Agente (só a própria); o restante é gestão do Dono.
public sealed class AtendimentoController : ApiControllerBase
{
    private readonly IAtendimentoService _atendimentoService;

    public AtendimentoController(IAtendimentoService atendimentoService)
    {
        _atendimentoService = atendimentoService;
    }

    [HttpGet]
    [Authorize(Policy = Policies.Dono)]
    public async Task<ActionResult<ApiResponse>> GetAll(CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa nao identificada no token." });

        var atendimentos = await _atendimentoService.GetAllAsync(empresaId, cancellationToken);
        return Ok(new ApiResponse { Success = true, Message = "Atendimentos encontrados.", Data = atendimentos });
    }

    [HttpGet("agenda")]
    public async Task<ActionResult<ApiResponse>> GetAgenda([FromQuery] DateTime? de, [FromQuery] DateTime? ate, [FromQuery] long? agenteId, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa nao identificada no token." });

        // Fail-safe: sem perfil identificavel no token, nao libera a agenda.
        if (!TryGetPerfil(out var perfil))
            return Unauthorized(new ApiResponse { Success = false, Message = "Perfil nao identificado no token." });

        // Agente ve apenas a propria agenda; Dono ve todos ou filtra por agente.
        var filtroAgente = agenteId;
        if (perfil == PerfilUsuario.Agente)
        {
            if (!TryGetUsuarioId(out var usuarioId))
                return Unauthorized(new ApiResponse { Success = false, Message = "Token invalido." });
            filtroAgente = usuarioId;
        }

        var agenda = await _atendimentoService.GetAgendaAsync(empresaId, de, ate, filtroAgente, cancellationToken);
        return Ok(new ApiResponse { Success = true, Message = "Agenda encontrada.", Data = agenda });
    }

    [HttpGet("{id:long}")]
    [Authorize(Policy = Policies.Dono)]
    public async Task<ActionResult<ApiResponse>> GetById(long id, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa nao identificada no token." });

        try
        {
            var atendimento = await _atendimentoService.GetByIdAsync(empresaId, id, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Atendimento encontrado.", Data = atendimento });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
    }

    [HttpPost]
    [Authorize(Policy = Policies.Dono)]
    public async Task<ActionResult<ApiResponse>> Create([FromBody] AtendimentoCreateRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId) || !TryGetUsuarioId(out var usuarioId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Token invalido." });

        try
        {
            var atendimento = await _atendimentoService.CreateAsync(empresaId, usuarioId, request, cancellationToken);
            return CreatedAtAction(nameof(GetById), new { id = atendimento.Id }, new ApiResponse
            {
                Success = true,
                Message = "Atendimento criado com sucesso.",
                Data = atendimento
            });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
    }

    [HttpPut("{id:long}")]
    [Authorize(Policy = Policies.Dono)]
    public async Task<ActionResult<ApiResponse>> Update(long id, [FromBody] AtendimentoUpdateRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa nao identificada no token." });

        try
        {
            var atendimento = await _atendimentoService.UpdateAsync(empresaId, id, request, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Atendimento atualizado com sucesso.", Data = atendimento });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
    }

    [HttpDelete("{id:long}")]
    [Authorize(Policy = Policies.Dono)]
    public async Task<ActionResult<ApiResponse>> Delete(long id, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa nao identificada no token." });

        try
        {
            await _atendimentoService.DeleteAsync(empresaId, id, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Atendimento removido com sucesso." });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
    }
}
