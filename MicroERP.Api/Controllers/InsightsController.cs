using MicroERP.Api.Authorization;
using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Insights;
using MicroERP.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace MicroERP.Api.Controllers;

// POST, não GET: cada chamada gasta tokens pagos pelo operador (DEC-21) e
// não deve ser disparada por prefetch ou cache do navegador.
[ApiController]
[Authorize(Policy = Policies.Dono)]
[Route("api/insights")]
public sealed class InsightsController : ApiControllerBase
{
    private readonly IInsightsService _insightsService;

    public InsightsController(IInsightsService insightsService)
    {
        _insightsService = insightsService;
    }

    [HttpPost]
    [EnableRateLimiting(RateLimits.Insights)]
    public async Task<ActionResult<ApiResponse>> Gerar([FromQuery] DateTime? de, [FromQuery] DateTime? ate, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        try
        {
            var insights = await _insightsService.GerarAsync(empresaId, de, ate, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Insights gerados.", Data = insights });
        }
        catch (InsightsIndisponivelException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new ApiResponse { Success = false, Message = ex.Message });
        }
    }
}
