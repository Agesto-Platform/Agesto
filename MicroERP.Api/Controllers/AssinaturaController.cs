using MicroERP.Api.Authorization;
using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MicroERP.Api.Controllers;

// Assinatura da empresa do token, para o Dono ver no painel (DEC-58): situação,
// vencimento, licenças e valor. Os pagamentos ficam só no superadmin.
[ApiController]
[Authorize(Policy = Policies.Dono)]
[Route("api/assinatura")]
public sealed class AssinaturaController : ApiControllerBase
{
    private readonly IAssinaturaService _assinaturas;

    public AssinaturaController(IAssinaturaService assinaturas)
    {
        _assinaturas = assinaturas;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse>> Obter(CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        var assinatura = await _assinaturas.ObterAsync(empresaId, comPagamentos: false, cancellationToken);
        return Ok(new ApiResponse { Success = true, Message = "Assinatura.", Data = assinatura });
    }
}
