using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MicroERP.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class ServicoController : ApiControllerBase
{
    private readonly IServicoService _servicoService;
    private readonly IServicoSugeridoService _servicoSugeridoService;

    public ServicoController(IServicoService servicoService, IServicoSugeridoService servicoSugeridoService)
    {
        _servicoService = servicoService;
        _servicoSugeridoService = servicoSugeridoService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse>> GetAll(CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        var servicos = await _servicoService.GetAllAsync(empresaId, cancellationToken);
        return Ok(new ApiResponse { Success = true, Message = "Serviços encontrados.", Data = servicos });
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiResponse>> GetById(long id, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        try
        {
            var servico = await _servicoService.GetByIdAsync(empresaId, id, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Serviço encontrado.", Data = servico });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse>> Create([FromBody] ServicoCreateRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        var servico = await _servicoService.CreateAsync(empresaId, request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = servico.Id }, new ApiResponse
        {
            Success = true,
            Message = "Serviço criado com sucesso.",
            Data = servico
        });
    }

    [HttpPut("{id:long}")]
    public async Task<ActionResult<ApiResponse>> Update(long id, [FromBody] ServicoUpdateRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        try
        {
            var servico = await _servicoService.UpdateAsync(empresaId, id, request, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Serviço atualizado com sucesso.", Data = servico });
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
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        try
        {
            await _servicoService.DeleteAsync(empresaId, id, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Serviço removido com sucesso." });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
    }

    // ---- Materiais sugeridos (kit) do serviço ----

    [HttpGet("{id:long}/sugeridos")]
    public async Task<ActionResult<ApiResponse>> GetSugeridos(long id, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        try
        {
            var sugeridos = await _servicoSugeridoService.GetByServicoAsync(empresaId, id, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Materiais sugeridos encontrados.", Data = sugeridos });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
    }

    [HttpPut("{id:long}/sugeridos")]
    public async Task<ActionResult<ApiResponse>> PutSugeridos(long id, [FromBody] List<ServicoSugeridoRequest> request, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        try
        {
            var sugeridos = await _servicoSugeridoService.ReplaceAsync(empresaId, id, request, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Materiais sugeridos atualizados.", Data = sugeridos });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
    }
}
