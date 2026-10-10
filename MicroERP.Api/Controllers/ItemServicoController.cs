using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MicroERP.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class ItemServicoController : ApiControllerBase
{
    private readonly IItemServicoService _itemServicoService;

    public ItemServicoController(IItemServicoService itemServicoService)
    {
        _itemServicoService = itemServicoService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse>> GetAll([FromQuery] long atendimentoId, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        var itens = await _itemServicoService.GetAllByAtendimentoAsync(empresaId, atendimentoId, cancellationToken);
        return Ok(new ApiResponse { Success = true, Message = "Itens de serviço encontrados.", Data = itens });
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiResponse>> GetById(long id, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        try
        {
            var item = await _itemServicoService.GetByIdAsync(empresaId, id, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Item de serviço encontrado.", Data = item });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse>> Create([FromBody] ItemServicoCreateRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        try
        {
            var item = await _itemServicoService.CreateAsync(empresaId, request, cancellationToken);
            return CreatedAtAction(nameof(GetById), new { id = item.Id }, new ApiResponse
            {
                Success = true,
                Message = "Item de serviço criado com sucesso.",
                Data = item
            });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
    }

    [HttpPut("{id:long}")]
    public async Task<ActionResult<ApiResponse>> Update(long id, [FromBody] ItemServicoUpdateRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        try
        {
            var item = await _itemServicoService.UpdateAsync(empresaId, id, request, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Item de serviço atualizado com sucesso.", Data = item });
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
            await _itemServicoService.DeleteAsync(empresaId, id, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Item de serviço removido com sucesso." });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
    }
}
