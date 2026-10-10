using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MicroERP.Api.Authorization;
using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class AuthController : ControllerBase
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
                Message = "Usuario cadastrado com sucesso."
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
        var response = await _authService.LoginAsync(request, cancellationToken);
        if (response is null)
        {
            return Unauthorized(new ApiResponse
            {
                Success = false,
                Message = "Credenciais invalidas."
            });
        }

        return Ok(new ApiResponse
        {
            Success = true,
            Message = "Login realizado com sucesso.",
            Data = response
        });
    }
}
