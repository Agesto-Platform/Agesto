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
public sealed class ProdutoController : ApiControllerBase
{
    private readonly IProdutoService _produtoService;

    public ProdutoController(IProdutoService produtoService)
    {
        _produtoService = produtoService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse>> GetAll(CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa nao identificada no token." });

        var produtos = await _produtoService.GetAllAsync(empresaId, cancellationToken);
        return Ok(new ApiResponse { Success = true, Message = "Produtos encontrados.", Data = produtos });
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiResponse>> GetById(long id, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa nao identificada no token." });

        try
        {
            var produto = await _produtoService.GetByIdAsync(empresaId, id, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Produto encontrado.", Data = produto });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse>> Create([FromBody] ProdutoCreateRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa nao identificada no token." });

        var produto = await _produtoService.CreateAsync(empresaId, request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = produto.Id }, new ApiResponse
        {
            Success = true,
            Message = "Produto criado com sucesso.",
            Data = produto
        });
    }

    [HttpPut("{id:long}")]
    public async Task<ActionResult<ApiResponse>> Update(long id, [FromBody] ProdutoUpdateRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa nao identificada no token." });

        try
        {
            var produto = await _produtoService.UpdateAsync(empresaId, id, request, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Produto atualizado com sucesso.", Data = produto });
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
            await _produtoService.DeleteAsync(empresaId, id, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Produto removido com sucesso." });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
    }
}
