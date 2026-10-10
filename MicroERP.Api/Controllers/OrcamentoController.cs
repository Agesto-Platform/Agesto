using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MicroERP.Api.Authorization;

namespace MicroERP.Api.Controllers;

[ApiController]
[Authorize(Policy = Policies.Dono)]
[Route("api/[controller]")]
public sealed class OrcamentoController : ApiControllerBase
{
    private readonly IOrcamentoService _orcamentoService;

    public OrcamentoController(IOrcamentoService orcamentoService)
    {
        _orcamentoService = orcamentoService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse>> GetAll(CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa nao identificada no token." });

        var orcamentos = await _orcamentoService.GetAllAsync(empresaId, cancellationToken);
        return Ok(new ApiResponse { Success = true, Message = "Orcamentos encontrados.", Data = orcamentos });
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiResponse>> GetById(long id, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa nao identificada no token." });

        try
        {
            var orcamento = await _orcamentoService.GetByIdAsync(empresaId, id, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Orcamento encontrado.", Data = orcamento });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse>> Create([FromBody] OrcamentoCreateRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId) || !TryGetUsuarioId(out var usuarioId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Token invalido." });

        try
        {
            var orcamento = await _orcamentoService.CreateAsync(empresaId, usuarioId, request, cancellationToken);
            return CreatedAtAction(nameof(GetById), new { id = orcamento.Id }, new ApiResponse
            {
                Success = true,
                Message = "Orcamento criado com sucesso.",
                Data = orcamento
            });
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

    [HttpPut("{id:long}")]
    public async Task<ActionResult<ApiResponse>> Update(long id, [FromBody] OrcamentoUpdateRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa nao identificada no token." });

        try
        {
            var orcamento = await _orcamentoService.UpdateStatusAsync(empresaId, id, request, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Orcamento atualizado com sucesso.", Data = orcamento });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
    }

    [HttpDelete("{id:long}")]
    public async Task<ActionResult<ApiResponse>> Delete(long id, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa nao identificada no token." });

        try
        {
            await _orcamentoService.DeleteAsync(empresaId, id, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Orcamento removido com sucesso." });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("{id:long}/converter")]
    public async Task<ActionResult<ApiResponse>> Converter(long id, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId) || !TryGetUsuarioId(out var usuarioId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Token invalido." });

        try
        {
            var atendimento = await _orcamentoService.ConverterAsync(empresaId, usuarioId, id, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Orcamento convertido em atendimento.", Data = atendimento });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
        catch (EstoqueInsuficienteException ex)
        {
            return BadRequest(new ApiResponse { Success = false, Message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ApiResponse { Success = false, Message = ex.Message });
        }
    }
}
