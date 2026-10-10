using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MicroERP.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/metrics")]
public sealed class MetricasController : ApiControllerBase
{
    private readonly IMetricasService _metricasService;

    public MetricasController(IMetricasService metricasService)
    {
        _metricasService = metricasService;
    }

    [HttpGet("rentabilidade")]
    public async Task<ActionResult<ApiResponse>> GetRentabilidade([FromQuery] DateTime? de, [FromQuery] DateTime? ate, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        var rentabilidade = await _metricasService.GetRentabilidadeAsync(empresaId, de, ate, cancellationToken);
        return Ok(new ApiResponse { Success = true, Message = "Rentabilidade calculada.", Data = rentabilidade });
    }

    [HttpGet("vendas")]
    public async Task<ActionResult<ApiResponse>> GetVendas([FromQuery] DateTime? de, [FromQuery] DateTime? ate, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        var vendas = await _metricasService.GetVendasAsync(empresaId, de, ate, cancellationToken);
        return Ok(new ApiResponse { Success = true, Message = "Métricas de vendas calculadas.", Data = vendas });
    }

    [HttpGet("servicos")]
    public async Task<ActionResult<ApiResponse>> GetServicos([FromQuery] DateTime? de, [FromQuery] DateTime? ate, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        var servicos = await _metricasService.GetServicosAsync(empresaId, de, ate, cancellationToken);
        return Ok(new ApiResponse { Success = true, Message = "Métricas de serviços calculadas.", Data = servicos });
    }

    [HttpGet("estoque")]
    public async Task<ActionResult<ApiResponse>> GetEstoque([FromQuery] DateTime? de, [FromQuery] DateTime? ate, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        var estoque = await _metricasService.GetEstoqueAsync(empresaId, de, ate, cancellationToken);
        return Ok(new ApiResponse { Success = true, Message = "Métricas de estoque calculadas.", Data = estoque });
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult<ApiResponse>> GetDashboard([FromQuery] DateTime? de, [FromQuery] DateTime? ate, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        var dashboard = await _metricasService.GetDashboardAsync(empresaId, de, ate, cancellationToken);
        return Ok(new ApiResponse { Success = true, Message = "Dashboard consolidado.", Data = dashboard });
    }
}
