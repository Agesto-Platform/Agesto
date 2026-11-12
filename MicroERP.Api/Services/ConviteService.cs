using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MicroERP.Api.Data;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Services.Email;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Services;

// Convites por email (DEC-55): acesso novo criado pelo Dono ou pela equipe do
// Agesto, "enviar link de senha" do superadmin e convite de admin. O link vale
// 72 horas e leva à tela de criar senha do web.
public sealed class ConviteService : IConviteService
{
    private readonly AppDbContext _db;
    private readonly IFilaDeEmails _fila;
    private readonly EmailOptions _options;
    private readonly ILogger<ConviteService> _logger;
    private readonly IHostEnvironment _ambiente;

    public ConviteService(
        AppDbContext db, IFilaDeEmails fila, IOptions<EmailOptions> options,
        ILogger<ConviteService> logger, IHostEnvironment ambiente)
    {
        _db = db;
        _fila = fila;
        _options = options.Value;
        _logger = logger;
        _ambiente = ambiente;
    }

    public bool EnvioHabilitado => _options.EnvioHabilitado;

    public async Task EnviarParaUsuarioAsync(Usuario usuario, CancellationToken cancellationToken)
    {
        var nomeEmpresa = await _db.Empresas
            .Where(e => e.Id == usuario.EmpresaId)
            .Select(e => e.Nome)
            .FirstOrDefaultAsync(cancellationToken) ?? "Agesto";
        var token = await LinksDeSenha.EmitirAsync(_db, usuario.Id, null, TipoTokenSenha.Convite, DateTime.UtcNow, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        var link = LinksDeSenha.Link(_options.UrlWeb, "/criar-senha", token);
        var mensagem = usuario.EmailConfirmadoEm is null
            ? EmailsDeSenha.ConviteUsuario(usuario.Email, usuario.Nome, nomeEmpresa, usuario.Perfil, link, _options.UrlWeb)
            : EmailsDeSenha.LinkPelaEquipe(usuario.Email, usuario.Nome, link);
        Enfileirar(mensagem, link);
    }

    public async Task EnviarParaAdminAsync(AdminPlataforma admin, CancellationToken cancellationToken)
    {
        var token = await LinksDeSenha.EmitirAsync(_db, null, admin.Id, TipoTokenSenha.Convite, DateTime.UtcNow, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);

        var link = LinksDeSenha.Link(_options.UrlWeb, "/admin/criar-senha", token);
        Enfileirar(EmailsDeSenha.ConviteAdmin(admin.Email, admin.Nome, link), link);
    }

    private void Enfileirar(EmailMensagem mensagem, string link)
    {
        if (!_fila.Enfileirar(mensagem))
            _logger.LogWarning("Fila de emails cheia: o convite não foi enviado.");
        // Só na máquina de desenvolvimento, para testar sem o Brevo. Nunca em produção.
        if (_ambiente.IsDevelopment())
            _logger.LogInformation("Link de convite (só em desenvolvimento): {Link}", link);
    }
}
