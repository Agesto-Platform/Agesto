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
    public async Task<ActionResult<ApiResponse>> GetAll([FromQuery] PaginacaoQuery paginacao, [FromQuery] AtendimentoFiltroQuery filtro, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        // PAG-01 fase 3: a lista é sempre paginada (sem parâmetros, página 1 com 20).
        var pagina = await _atendimentoService.GetPaginaAsync(empresaId, paginacao, filtro, cancellationToken);
        return Ok(new ApiResponse { Success = true, Message = "Atendimentos encontrados.", Data = pagina });
    }

    // PAG-01: os números das abas da tela de Atendimentos, sem baixar a lista inteira.
    [HttpGet("contagem")]
    [Authorize(Policy = Policies.Dono)]
    public async Task<ActionResult<ApiResponse>> Contagem(CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        var contagem = await _atendimentoService.ContarPorStatusAsync(empresaId, cancellationToken);
        return Ok(new ApiResponse { Success = true, Message = "Contagem encontrada.", Data = contagem });
    }

    // historico=true: o atendimento sem agendamento entra no dia em que foi registrado
    // (a Agenda do web mostra o histórico desde a criação da empresa).
    [HttpGet("agenda")]
    public async Task<ActionResult<ApiResponse>> GetAgenda([FromQuery] DateTime? de, [FromQuery] DateTime? ate, [FromQuery] long? agenteId, [FromQuery] bool historico, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        // Fail-safe: sem perfil identificavel no token, nao libera a agenda.
        if (!TryGetPerfil(out var perfil))
            return Unauthorized(new ApiResponse { Success = false, Message = "Perfil não identificado no token." });

        // Agente ve apenas a propria agenda; Dono ve todos ou filtra por agente.
        var filtroAgente = agenteId;
        if (perfil == PerfilUsuario.Agente)
        {
            if (!TryGetUsuarioId(out var usuarioId))
                return Unauthorized(new ApiResponse { Success = false, Message = "Token inválido." });
            filtroAgente = usuarioId;
        }

        try
        {
            var agenda = await _atendimentoService.GetAgendaAsync(empresaId, de, ate, filtroAgente, historico, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Agenda encontrada.", Data = agenda });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ApiResponse { Success = false, Message = ex.Message });
        }
    }

    // Sino do web (só o Dono entra no painel): pendentes de hoje e atrasados da empresa.
    // O app avisa o agente com a agenda que já está no aparelho, sem este endpoint.
    [HttpGet("avisos")]
    [Authorize(Policy = Policies.Dono)]
    public async Task<ActionResult<ApiResponse>> GetAvisos(CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        var avisos = await _atendimentoService.GetAvisosAsync(empresaId, agenteId: null, cancellationToken);
        return Ok(new ApiResponse { Success = true, Message = "Avisos encontrados.", Data = avisos });
    }

    [HttpGet("{id:long}")]
    [Authorize(Policy = Policies.Dono)]
    public async Task<ActionResult<ApiResponse>> GetById(long id, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

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
            return Unauthorized(new ApiResponse { Success = false, Message = "Token inválido." });

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
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        try
        {
            var atendimento = await _atendimentoService.UpdateAsync(empresaId, id, request, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Atendimento atualizado com sucesso.", Data = atendimento });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
        catch (EstoqueInsuficienteException ex)
        {
            return BadRequest(new ApiResponse { Success = false, Message = ex.Message });
        }
        catch (EstoqueAlteradoException ex)
        {
            return Conflict(new ApiResponse { Success = false, Message = ex.Message });
        }
    }

    // Cobrança mínima (TASKS L5): quando e como o cliente pagou o atendimento.
    [HttpPut("{id:long}/recebimento")]
    [Authorize(Policy = Policies.Dono)]
    public async Task<ActionResult<ApiResponse>> Recebimento(long id, [FromBody] AtendimentoRecebimentoRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        try
        {
            var atendimento = await _atendimentoService.RegistrarRecebimentoAsync(empresaId, id, request, cancellationToken);
            var mensagem = atendimento.PagoEm is null ? "Atendimento de volta para a receber." : "Recebimento registrado.";
            return Ok(new ApiResponse { Success = true, Message = mensagem, Data = atendimento });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ApiResponse { Success = false, Message = ex.Message });
        }
    }

    [HttpDelete("{id:long}")]
    [Authorize(Policy = Policies.Dono)]
    public async Task<ActionResult<ApiResponse>> Delete(long id, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        try
        {
            await _atendimentoService.DeleteAsync(empresaId, id, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Atendimento removido com sucesso." });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
        catch (EstoqueAlteradoException ex)
        {
            return Conflict(new ApiResponse { Success = false, Message = ex.Message });
        }
    }
}
