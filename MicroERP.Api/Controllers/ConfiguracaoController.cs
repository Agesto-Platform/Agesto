using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class ConfiguracaoController : ApiControllerBase
{
    private readonly IConfiguracaoService _configuracaoService;

    public ConfiguracaoController(IConfiguracaoService configuracaoService)
    {
        _configuracaoService = configuracaoService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse>> Get(CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
        {
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });
        }

        var configuracao = await _configuracaoService.GetByEmpresaAsync(empresaId, cancellationToken);
        if (configuracao is null)
        {
            return NotFound(new ApiResponse { Success = false, Message = "Configuração não encontrada." });
        }

        return Ok(new ApiResponse
        {
            Success = true,
            Message = "Configuração encontrada.",
            Data = configuracao
        });
    }

    [HttpPut]
    public async Task<ActionResult<ApiResponse>> Update([FromBody] ConfiguracaoUpdateRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
        {
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });
        }

        var configuracao = await _configuracaoService.UpdateAsync(empresaId, request, cancellationToken);
        if (configuracao is null)
        {
            return NotFound(new ApiResponse { Success = false, Message = "Configuração não encontrada." });
        }

        return Ok(new ApiResponse
        {
            Success = true,
            Message = "Configuração atualizada com sucesso.",
            Data = configuracao
        });
    }

}