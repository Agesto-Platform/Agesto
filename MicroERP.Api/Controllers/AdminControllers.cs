using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using MicroERP.Api.Authorization;
using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace MicroERP.Api.Controllers;

// Base da área de superadmin: o id vem do token de admin (esquema próprio),
// nunca do corpo da requisição.
public abstract class AdminControllerBase : ControllerBase
{
    protected bool TryGetAdminId(out long adminId)
    {
        adminId = 0;
        var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return long.TryParse(sub, out adminId);
    }

    protected string? Ip => HttpContext.Connection.RemoteIpAddress?.ToString();

    protected ObjectResult Erro(int status, string message) =>
        StatusCode(status, new ApiResponse { Success = false, Message = message });
}

[ApiController]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
[Route("api/admin/auth")]
public sealed class AdminAuthController : AdminControllerBase
{
    private readonly IAdminAuthService _service;
    private readonly IRedefinicaoSenhaService _senhas;

    public AdminAuthController(IAdminAuthService service, IRedefinicaoSenhaService senhas)
    {
        _service = service;
        _senhas = senhas;
    }

    // Senha de quem foi convidado para a equipe, pelo link do email (DEC-55).
    [HttpPost("criar-senha")]
    [EnableRateLimiting(RateLimits.Login)]
    public async Task<ActionResult<ApiResponse>> CriarSenha([FromBody] AdminCriarSenhaRequest request, CancellationToken cancellationToken)
    {
        try
        {
            await _senhas.CriarSenhaAdminAsync(request, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Senha criada. Entre na área de administração." });
        }
        catch (TokenRedefinicaoInvalidoException ex)
        {
            return Erro(StatusCodes.Status400BadRequest, ex.Message);
        }
    }

    [HttpPost("login")]
    [EnableRateLimiting(RateLimits.Login)]
    public async Task<ActionResult<ApiResponse>> Login([FromBody] AdminLoginRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var resposta = await _service.LoginAsync(request, Ip, cancellationToken);
            if (resposta is null) return Erro(StatusCodes.Status401Unauthorized, "Credenciais inválidas.");
            var mensagem = resposta.ExigeCodigo
                ? "Enviamos um código para o seu email."
                : "Login realizado com sucesso.";
            return Ok(new ApiResponse { Success = true, Message = mensagem, Data = resposta });
        }
        catch (ContaBloqueadaException ex)
        {
            return Erro(StatusCodes.Status423Locked, ex.Message);
        }
    }

    // Segunda etapa do login (DEC-52): o código de 6 dígitos enviado por email.
    [HttpPost("login/codigo")]
    [EnableRateLimiting(RateLimits.Login)]
    public async Task<ActionResult<ApiResponse>> ConfirmarCodigo([FromBody] AdminCodigoRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var resposta = await _service.ConfirmarCodigoAsync(request, Ip, cancellationToken);
            return resposta is null
                ? Erro(StatusCodes.Status401Unauthorized, "Código inválido ou expirado. Confira o email ou entre de novo.")
                : Ok(new ApiResponse { Success = true, Message = "Login realizado com sucesso.", Data = resposta });
        }
        catch (ContaBloqueadaException ex)
        {
            return Erro(StatusCodes.Status423Locked, ex.Message);
        }
    }

    // Cria o primeiro admin. Só funciona com Admin:SetupKey configurada, a chave
    // certa em X-Admin-Setup-Key e nenhum admin cadastrado ainda.
    [HttpPost("setup")]
    [EnableRateLimiting(RateLimits.Register)]
    public async Task<ActionResult<ApiResponse>> Setup(
        [FromBody] AdminCriarRequest request,
        [FromHeader(Name = "X-Admin-Setup-Key")] string? chave,
        CancellationToken cancellationToken)
    {
        try
        {
            var admin = await _service.SetupAsync(request, chave, Ip, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Primeiro administrador criado.", Data = admin });
        }
        catch (AdminSetupException ex)
        {
            return Erro(ex.StatusCode, ex.Message);
        }
    }

    [HttpGet("eu")]
    [Authorize(Policy = Policies.AdminPlataforma)]
    public async Task<ActionResult<ApiResponse>> Eu(CancellationToken cancellationToken)
    {
        if (!TryGetAdminId(out var adminId)) return Erro(StatusCodes.Status401Unauthorized, "Token inválido.");
        var admin = await _service.ObterAsync(adminId, cancellationToken);
        return Ok(new ApiResponse { Success = true, Message = "Administrador.", Data = admin });
    }
}

[ApiController]
[Authorize(Policy = Policies.AdminPlataforma)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
[Route("api/admin/equipe")]
public sealed class AdminEquipeController : AdminControllerBase
{
    private readonly IAdminAuthService _service;

    public AdminEquipeController(IAdminAuthService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse>> Listar(CancellationToken cancellationToken)
    {
        var admins = await _service.ListarAsync(cancellationToken);
        return Ok(new ApiResponse { Success = true, Message = "Equipe.", Data = admins });
    }

    // Convida alguém para a equipe: o email leva o link para criar a senha (DEC-55).
    [HttpPost]
    public async Task<ActionResult<ApiResponse>> Convidar([FromBody] AdminConvidarRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetAdminId(out var adminId)) return Erro(StatusCodes.Status401Unauthorized, "Token inválido.");
        try
        {
            var convite = await _service.ConvidarAsync(adminId, request, Ip, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Convite enviado.", Data = convite });
        }
        catch (EmailAlreadyExistsException ex)
        {
            return Erro(StatusCodes.Status409Conflict, ex.Message);
        }
    }

    [HttpPost("{id:long}/reenviar-convite")]
    public async Task<ActionResult<ApiResponse>> ReenviarConvite(long id, CancellationToken cancellationToken)
    {
        if (!TryGetAdminId(out var adminId)) return Erro(StatusCodes.Status401Unauthorized, "Token inválido.");
        try
        {
            var convite = await _service.ReenviarConviteAsync(adminId, id, Ip, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Convite reenviado.", Data = convite });
        }
        catch (NotFoundException ex)
        {
            return Erro(StatusCodes.Status404NotFound, ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return Erro(StatusCodes.Status409Conflict, ex.Message);
        }
    }

    [HttpPost("{id:long}/desativar")]
    public Task<ActionResult<ApiResponse>> Desativar(long id, CancellationToken cancellationToken) =>
        DefinirAtivo(id, false, "Administrador desativado.", cancellationToken);

    [HttpPost("{id:long}/reativar")]
    public Task<ActionResult<ApiResponse>> Reativar(long id, CancellationToken cancellationToken) =>
        DefinirAtivo(id, true, "Administrador reativado.", cancellationToken);

    private async Task<ActionResult<ApiResponse>> DefinirAtivo(long id, bool ativo, string mensagem, CancellationToken cancellationToken)
    {
        if (!TryGetAdminId(out var adminId)) return Erro(StatusCodes.Status401Unauthorized, "Token inválido.");
        try
        {
            await _service.DefinirAtivoAsync(adminId, id, ativo, Ip, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = mensagem });
        }
        catch (NotFoundException ex)
        {
            return Erro(StatusCodes.Status404NotFound, ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return Erro(StatusCodes.Status409Conflict, ex.Message);
        }
    }
}

[ApiController]
[Authorize(Policy = Policies.AdminPlataforma)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
[Route("api/admin/empresas")]
public sealed class AdminEmpresasController : AdminControllerBase
{
    private readonly IAdminEmpresaService _service;
    private readonly IAssinaturaService _assinaturas;

    public AdminEmpresasController(IAdminEmpresaService service, IAssinaturaService assinaturas)
    {
        _service = service;
        _assinaturas = assinaturas;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse>> Listar([FromQuery] string? busca, CancellationToken cancellationToken)
    {
        var empresas = await _service.ListarAsync(busca, cancellationToken);
        return Ok(new ApiResponse { Success = true, Message = "Empresas.", Data = empresas });
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiResponse>> Obter(long id, CancellationToken cancellationToken)
    {
        try
        {
            var empresa = await _service.ObterAsync(id, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Empresa.", Data = empresa });
        }
        catch (NotFoundException ex)
        {
            return Erro(StatusCodes.Status404NotFound, ex.Message);
        }
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse>> Criar([FromBody] EmpresaAdminCriarRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetAdminId(out var adminId)) return Erro(StatusCodes.Status401Unauthorized, "Token inválido.");
        try
        {
            var criada = await _service.CriarAsync(adminId, request, Ip, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Empresa criada.", Data = criada });
        }
        catch (EmailAlreadyExistsException ex)
        {
            return Erro(StatusCodes.Status409Conflict, ex.Message);
        }
    }

    [HttpPost("{id:long}/bloquear")]
    public Task<ActionResult<ApiResponse>> Bloquear(long id, [FromBody] EmpresaBloquearRequest request, CancellationToken cancellationToken) =>
        Executar(adminId => _service.BloquearAsync(adminId, id, request.Motivo, Ip, cancellationToken), "Empresa bloqueada.");

    [HttpPost("{id:long}/desbloquear")]
    public Task<ActionResult<ApiResponse>> Desbloquear(long id, CancellationToken cancellationToken) =>
        Executar(adminId => _service.DesbloquearAsync(adminId, id, Ip, cancellationToken), "Empresa desbloqueada.");

    [HttpPost("{id:long}/usuarios/{usuarioId:long}/desativar")]
    public Task<ActionResult<ApiResponse>> DesativarUsuario(long id, long usuarioId, CancellationToken cancellationToken) =>
        Executar(adminId => _service.DefinirUsuarioAtivoAsync(adminId, id, usuarioId, false, Ip, cancellationToken), "Usuário desativado.");

    [HttpPost("{id:long}/usuarios/{usuarioId:long}/reativar")]
    public Task<ActionResult<ApiResponse>> ReativarUsuario(long id, long usuarioId, CancellationToken cancellationToken) =>
        Executar(adminId => _service.DefinirUsuarioAtivoAsync(adminId, id, usuarioId, true, Ip, cancellationToken), "Usuário reativado.");

    // Acesso novo (Dono ou Agente) com convite por email: só a equipe cria usuários (DEC-55).
    [HttpPost("{id:long}/usuarios")]
    public async Task<ActionResult<ApiResponse>> CriarUsuario(long id, [FromBody] UsuarioCreateRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetAdminId(out var adminId)) return Erro(StatusCodes.Status401Unauthorized, "Token inválido.");
        try
        {
            var convite = await _service.CriarUsuarioAsync(adminId, id, request, Ip, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Acesso criado. Convite enviado.", Data = convite });
        }
        catch (NotFoundException ex)
        {
            return Erro(StatusCodes.Status404NotFound, ex.Message);
        }
        catch (EmailAlreadyExistsException ex)
        {
            return Erro(StatusCodes.Status409Conflict, ex.Message);
        }
        catch (RegraUsuarioException ex)
        {
            return Erro(StatusCodes.Status409Conflict, ex.Message);
        }
        catch (ArgumentException ex)
        {
            return Erro(StatusCodes.Status400BadRequest, ex.Message);
        }
    }

    // Assinatura (DEC-58): registra um pagamento combinado no contato.
    [HttpPost("{id:long}/pagamentos")]
    public async Task<ActionResult<ApiResponse>> RegistrarPagamento(long id, [FromBody] PagamentoAssinaturaRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetAdminId(out var adminId)) return Erro(StatusCodes.Status401Unauthorized, "Token inválido.");
        try
        {
            var assinatura = await _assinaturas.RegistrarPagamentoAsync(adminId, id, request, Ip, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Pagamento registrado.", Data = assinatura });
        }
        catch (NotFoundException ex)
        {
            return Erro(StatusCodes.Status404NotFound, ex.Message);
        }
    }

    // Assinatura (DEC-58): desfaz o último pagamento, registrado por engano.
    [HttpPost("{id:long}/pagamentos/{pagamentoId:long}/desfazer")]
    public async Task<ActionResult<ApiResponse>> DesfazerPagamento(long id, long pagamentoId, CancellationToken cancellationToken)
    {
        if (!TryGetAdminId(out var adminId)) return Erro(StatusCodes.Status401Unauthorized, "Token inválido.");
        try
        {
            var assinatura = await _assinaturas.DesfazerPagamentoAsync(adminId, id, pagamentoId, Ip, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Pagamento desfeito.", Data = assinatura });
        }
        catch (NotFoundException ex)
        {
            return Erro(StatusCodes.Status404NotFound, ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return Erro(StatusCodes.Status409Conflict, ex.Message);
        }
    }

    // Assinatura (DEC-58): licenças de funcionário e ajuste manual do "pago até".
    [HttpPut("{id:long}/assinatura")]
    public async Task<ActionResult<ApiResponse>> AtualizarAssinatura(long id, [FromBody] AssinaturaAtualizarRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetAdminId(out var adminId)) return Erro(StatusCodes.Status401Unauthorized, "Token inválido.");
        try
        {
            var assinatura = await _assinaturas.AtualizarAsync(adminId, id, request, Ip, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Assinatura atualizada.", Data = assinatura });
        }
        catch (NotFoundException ex)
        {
            return Erro(StatusCodes.Status404NotFound, ex.Message);
        }
    }

    // Reenvia o convite ou manda um link de senha nova, no lugar da senha provisória (DEC-55).
    [HttpPost("{id:long}/usuarios/{usuarioId:long}/enviar-link-senha")]
    public async Task<ActionResult<ApiResponse>> EnviarLinkSenha(long id, long usuarioId, CancellationToken cancellationToken)
    {
        if (!TryGetAdminId(out var adminId)) return Erro(StatusCodes.Status401Unauthorized, "Token inválido.");
        try
        {
            var envio = await _service.EnviarLinkSenhaAsync(adminId, id, usuarioId, Ip, cancellationToken);
            return Ok(new ApiResponse { Success = true, Message = "Link de senha enviado.", Data = envio });
        }
        catch (NotFoundException ex)
        {
            return Erro(StatusCodes.Status404NotFound, ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return Erro(StatusCodes.Status409Conflict, ex.Message);
        }
    }

    private async Task<ActionResult<ApiResponse>> Executar(Func<long, Task> acao, string mensagem)
    {
        if (!TryGetAdminId(out var adminId)) return Erro(StatusCodes.Status401Unauthorized, "Token inválido.");
        try
        {
            await acao(adminId);
            return Ok(new ApiResponse { Success = true, Message = mensagem });
        }
        catch (NotFoundException ex)
        {
            return Erro(StatusCodes.Status404NotFound, ex.Message);
        }
        catch (RegraUsuarioException ex)
        {
            return Erro(StatusCodes.Status409Conflict, ex.Message);
        }
    }
}

[ApiController]
[Authorize(Policy = Policies.AdminPlataforma)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
[Route("api/admin/auditoria")]
public sealed class AdminAuditoriaController : AdminControllerBase
{
    private readonly IAdminEmpresaService _service;

    public AdminAuditoriaController(IAdminEmpresaService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse>> Listar([FromQuery] long? empresaId, CancellationToken cancellationToken)
    {
        var registros = await _service.ListarAuditoriaAsync(empresaId, cancellationToken);
        return Ok(new ApiResponse { Success = true, Message = "Auditoria.", Data = registros });
    }
}
