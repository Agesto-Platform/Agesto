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
    private readonly IRedefinicaoSenhaService _redefinicaoSenha;
    private readonly IConfiguration _configuration;

    public AuthController(IAuthService authService, IRedefinicaoSenhaService redefinicaoSenha, IConfiguration configuration)
    {
        _authService = authService;
        _redefinicaoSenha = redefinicaoSenha;
        _configuration = configuration;
    }

    // "Esqueci a senha" do Dono e do Agente (DEC-54 e DEC-55). A resposta é sempre a
    // mesma, exista o email ou não, para a rota não servir para descobrir quem tem conta.
    [HttpPost("esqueci-senha")]
    [EnableRateLimiting(RateLimits.Login)]
    public async Task<ActionResult<ApiResponse>> EsqueciSenha([FromBody] EsqueciSenhaRequest request, CancellationToken cancellationToken)
    {
        await _redefinicaoSenha.SolicitarAsync(request, cancellationToken);
        return Ok(new ApiResponse
        {
            Success = true,
            Message = "Se este email tiver acesso ao Agesto, enviamos um link para criar uma senha nova. Confira também o spam."
        });
    }

    [HttpPost("redefinir-senha")]
    [EnableRateLimiting(RateLimits.Login)]
    public async Task<ActionResult<ApiResponse>> RedefinirSenha([FromBody] RedefinirSenhaRequest request, CancellationToken cancellationToken)
    {
        try
        {
            // Também cria a primeira senha de quem recebeu convite (DEC-55).
            var perfil = await _redefinicaoSenha.RedefinirAsync(request, cancellationToken);
            return Ok(new ApiResponse
            {
                Success = true,
                Message = "Senha criada. Entre com a senha nova.",
                Data = new RedefinirSenhaResponse { Perfil = perfil }
            });
        }
        catch (TokenRedefinicaoInvalidoException ex)
        {
            return BadRequest(new ApiResponse { Success = false, Message = ex.Message });
        }
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
        catch (ContaBloqueadaException ex)
        {
            return StatusCode(StatusCodes.Status423Locked, new ApiResponse
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
            return Unauthorized(new ApiResponse { Success = false, Message = "Token inválido." });

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

    // Qualquer perfil aceita os termos de uso e a política de privacidade no
    // primeiro acesso e quando a versão muda (B6).
    [HttpPost("aceitar-termos")]
    [Authorize]
    public async Task<ActionResult<ApiResponse>> AceitarTermos([FromBody] AceitarTermosRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetUsuarioId(out var usuarioId))
            return Unauthorized(new ApiResponse { Success = false, Message = "Token inválido." });

        try
        {
            await _authService.AceitarTermosAsync(usuarioId, request, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Termos aceitos." });
        }
        catch (ArgumentException ex)
        {
            return Conflict(new ApiResponse { Success = false, Message = ex.Message });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new ApiResponse { Success = false, Message = ex.Message });
        }
    }
}