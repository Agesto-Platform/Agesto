using MicroERP.Api.Authorization;
using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services;
using MicroERP.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MicroERP.Api.Controllers;

// Aba Suporte do painel (DEC-60): só o Dono abre e acompanha os chamados da
// própria empresa. Empresa e autor vêm do token.
[ApiController]
[Authorize(Policy = Policies.Dono)]
[Route("api/suporte")]
public sealed class SuporteController : ApiControllerBase
{
    private const long LimiteRequisicao = 16 * 1024 * 1024;
    private readonly ISuporteService _suporte;

    public SuporteController(ISuporteService suporte)
    {
        _suporte = suporte;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse>> Listar(CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        var tickets = await _suporte.ListarDaEmpresaAsync(empresaId, cancellationToken);
        return Ok(new ApiResponse { Success = true, Message = "Chamados.", Data = tickets });
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiResponse>> Obter(long id, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Empresa não identificada no token." });

        try
        {
            var ticket = await _suporte.ObterDaEmpresaAsync(empresaId, id, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Chamado.", Data = ticket });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
    }

    // Formulário (multipart): assunto, mensagem e até 3 anexos de 5 MB (imagem ou PDF).
    // O limite da requisição sobe só aqui; no resto da API continua 2 MB.
    [HttpPost]
    [RequestSizeLimit(LimiteRequisicao)]
    [RequestFormLimits(MultipartBodyLengthLimit = LimiteRequisicao)]
    public async Task<ActionResult<ApiResponse>> Criar(
        [FromForm] TicketCriarRequest request, [FromForm] List<IFormFile>? anexos, CancellationToken cancellationToken)
    {
        if (!TryGetEmpresaId(out var empresaId) || !TryGetUsuarioId(out var usuarioId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Token inválido." });

        var arquivos = new List<ArquivoRecebido>();
        foreach (var arquivo in anexos ?? [])
        {
            if (arquivos.Count >= SuporteService.MaxAnexos)
                return BadRequest(new ApiResponse { Success = false, Message = $"Anexe no máximo {SuporteService.MaxAnexos} arquivos." });
            if (arquivo.Length > SuporteService.MaxBytesAnexo)
                return BadRequest(new ApiResponse { Success = false, Message = $"O arquivo {arquivo.FileName} passa de 5 MB." });
            using var memoria = new MemoryStream((int)arquivo.Length);
            await arquivo.CopyToAsync(memoria, cancellationToken);
            arquivos.Add(new ArquivoRecebido(arquivo.FileName, memoria.ToArray()));
        }

        try
        {
            var ticket = await _suporte.CriarAsync(empresaId, usuarioId, request, arquivos, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, new ApiResponse
            {
                Success = true,
                Message = "Chamado aberto. Enviamos uma cópia para o seu email.",
                Data = ticket
            });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(StatusCodes.Status429TooManyRequests, new ApiResponse { Success = false, Message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ApiResponse { Success = false, Message = ex.Message });
        }
    }
}
