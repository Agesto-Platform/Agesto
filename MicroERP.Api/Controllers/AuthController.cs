using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MicroERP.Api.Authorization;
using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class AuthController : ApiControllerBase
{
    private readonly IAuthService _authService;
    private readonly IConfiguration _configuration;

    public AuthController(IAuthService authService, IConfiguration configuration)
    {
        _authService = authService;
        _configuration = configuration;
    }

    // Cadastro fechado: só funciona com Auth:RegistrationKey configurada e enviada
    // no header X-Registration-Key. Sem a chave configurada, a rota não existe.
    [HttpPost("register")]
    [EnableRateLimiting(RateLimits.Register)]
    public async Task<IActionResult> Register(
        [FromBody] AuthRegisterRequest request,
        [FromHeader(Name = "X-Registration-Key")] string? registrationKey,
        CancellationToken cancellationToken)
    {
        var chaveEsperada = _configuration["Auth:RegistrationKey"];
        if (string.IsNullOrWhiteSpace(chaveEsperada))
        {
            return NotFound();
        }

        if (string.IsNullOrEmpty(registrationKey) || !CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(registrationKey), Encoding.UTF8.GetBytes(chaveEsperada)))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ApiResponse
            {
                Success = false,
                Message = "Cadastro não autorizado."
            });
        }

        try
        {
            await _authService.RegisterAsync(request, cancellationToken);
            return Ok(new ApiResponse
            {
                Success = true,
                Message = "Usuário cadastrado com sucesso."
            });
        }
        catch (EmailAlreadyExistsException ex)
        {
            return Conflict(new ApiResponse
            {
                Success = false,
                Message = ex.Message
            });
        }
    }

    [HttpPost("login")]
    [EnableRateLimiting(RateLimits.Login)]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] AuthLoginRequest request, CancellationToken cancellationToken)
    {
        AuthResponse? response;
        try
        {
            response = await _authService.LoginAsync(request, cancellationToken);
        }
        catch (UsuarioInativoException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ApiResponse
            {
                Success = false,
                Message = ex.Message
            });
        }

        if (response is null)
        {
            return Unauthorized(new ApiResponse
            {
                Success = false,
                Message = "Credenciais inválidas."
            });
        }

        return Ok(new ApiResponse
        {
            Success = true,
            Message = "Login realizado com sucesso.",
            Data = response
        });
    }

    // Qualquer perfil troca a própria senha; obrigatório no primeiro acesso de
    // quem recebeu senha provisória do Dono.
    [HttpPost("trocar-senha")]
    [Authorize]
    [EnableRateLimiting(RateLimits.Login)]
    public async Task<ActionResult<ApiResponse>> TrocarSenha([FromBody] TrocarSenhaRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetUsuarioId(out var usuarioId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Token invalido." });

        try
        {
            await _authService.TrocarSenhaAsync(usuarioId, request, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Senha alterada com sucesso." });
        }
        catch (SenhaAtualInvalidaException ex)
        {
            return BadRequest(new ApiResponse { Success = false, Message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new ApiResponse { Success = false, Message = ex.Message });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
    }
}