using Microsoft.AspNetCore.Mvc;
using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] AuthRegisterRequest request, CancellationToken cancellationToken)
    {
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
    public async Task<ActionResult<AuthResponse>> Login([FromBody] AuthLoginRequest request, CancellationToken cancellationToken)
    {
        var response = await _authService.LoginAsync(request, cancellationToken);
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
}
