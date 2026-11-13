using MicroERP.Api.Authorization;
using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Insights;
using MicroERP.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace MicroERP.Api.Controllers;

// Chat do painel Agente do web (DEC-21). Cada pergunta gasta tokens pagos
// pelo operador, por isso os limites por empresa: por hora (rate limiter) e
// por dia (UsosIa, 20 perguntas por padrão).
[ApiController]
[Authorize(Policy = Policies.Dono)]
[Route("api/agente")]
public sealed class AgenteController : ApiControllerBase
{
    private readonly IAgenteService _agenteService;

    private readonly IUsoIaService _usoIa;

    public AgenteController(IAgenteService agenteService, IUsoIaService usoIa)
    {
        _agenteService = agenteService;
        _usoIa = usoIa;
    }

    // Quantas perguntas a empresa ainda tem hoje (o painel mostra ao abrir).
    [HttpGet("uso")]
    public async Task<ActionResult<ApiResponse>> Uso(CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        var uso = await _usoIa.ObterHojeAsync(empresaId, cancellationToken);
        return Ok(new ApiResponse { Success = true, Message = "Uso do Agente hoje.", Data = uso });
    }

    [HttpPost("perguntar")]
    [EnableRateLimiting(RateLimits.Agente)]
    public async Task<ActionResult<ApiResponse>> Perguntar([FromBody] AgentePerguntaRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        if (string.IsNullOrWhiteSpace(request.Pergunta))
            return BadRequest(new ApiResponse { Success = false, Message = "Pergunta obrigatória." });

        try
        {
            var resposta = await _agenteService.PerguntarAsync(empresaId, request, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Resposta do Agente.", Data = resposta });
        }
        catch (InsightsIndisponivelException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new ApiResponse { Success = false, Message = ex.Message });
        }
        catch (LimiteIaExcedidoException ex)
        {
            return StatusCode(StatusCodes.Status429TooManyRequests,
                new ApiResponse { Success = false, Message = ex.Message });
        }
    }
}
