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
public sealed class ItemProdutoController : ApiControllerBase
{
    private readonly IItemProdutoService _itemProdutoService;

    public ItemProdutoController(IItemProdutoService itemProdutoService)
    {
        _itemProdutoService = itemProdutoService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse>> GetAll([FromQuery] long atendimentoId, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa nao identificada no token." });

        var itens = await _itemProdutoService.GetAllByAtendimentoAsync(empresaId, atendimentoId, cancellationToken);
        return Ok(new ApiResponse { Success = true, Message = "Itens de produto encontrados.", Data = itens });
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiResponse>> GetById(long id, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa nao identificada no token." });

        try
        {
            var item = await _itemProdutoService.GetByIdAsync(empresaId, id, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Item de produto encontrado.", Data = item });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse>> Create([FromBody] ItemProdutoCreateRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa nao identificada no token." });

        try
        {
            var item = await _itemProdutoService.CreateAsync(empresaId, request, cancellationToken);
            return CreatedAtAction(nameof(GetById), new { id = item.Id }, new ApiResponse
            {
                Success = true,
                Message = "Item de produto criado com sucesso.",
                Data = item
            });
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

    [HttpPut("{id:long}")]
    public async Task<ActionResult<ApiResponse>> Update(long id, [FromBody] ItemProdutoUpdateRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa nao identificada no token." });

        try
        {
            var item = await _itemProdutoService.UpdateAsync(empresaId, id, request, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Item de produto atualizado com sucesso.", Data = item });
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

    [HttpDelete("{id:long}")]
    public async Task<ActionResult<ApiResponse>> Delete(long id, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa nao identificada no token." });

        try
        {
            await _itemProdutoService.DeleteAsync(empresaId, id, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Item de produto removido com sucesso." });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
    }
}
