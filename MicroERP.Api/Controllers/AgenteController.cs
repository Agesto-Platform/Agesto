using MicroERP.Api.Authorization;
using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Insights;
using MicroERP.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace MicroERP.Api.Controllers;

// Chat do painel Agente do web (DEC-21). Cada pergunta gasta tokens pagos
// pelo operador, por isso o limite por empresa.
[ApiController]
[Authorize(Policy = Policies.Dono)]
[Route("api/agente")]
public sealed class AgenteController : ApiControllerBase
{
    private readonly IAgenteService _agenteService;

    public AgenteController(IAgenteService agenteService)
    {
        _agenteService = agenteService;
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
    }
}
