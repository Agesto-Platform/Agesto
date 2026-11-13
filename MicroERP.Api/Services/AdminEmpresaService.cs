using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Services;

// Gestão das empresas clientes pela equipe do Agesto. É o único lugar da API
// que consulta várias empresas de uma vez, por isso só é exposto pelos
// controllers da área de superadmin. Cada alteração vai para a auditoria.
public sealed class AdminEmpresaService : IAdminEmpresaService
{
    private const int MaxEmpresasNaLista = 200;
    private const int MaxRegistrosDeAuditoria = 200;

    private readonly AppDbContext _db;
    private readonly IAuthService _authService;
    private readonly IConviteService _convites;
    private readonly IAssinaturaService _assinaturas;
    private readonly TimeProvider _relogio;
    private readonly PasswordHasher<Usuario> _hasher = new();

    public AdminEmpresaService(AppDbContext db, IAuthService authService, IConviteService convites, IAssinaturaService assinaturas, TimeProvider relogio)
    {
        _db = db;
        _authService = authService;
        _convites = convites;
        _assinaturas = assinaturas;
        _relogio = relogio;
    }

    public async Task<IReadOnlyList<EmpresaAdminResumo>> ListarAsync(string? busca, CancellationToken cancellationToken)
    {
        var lista = await ListarSemSituacaoAsync(busca, cancellationToken);
        // Situação da assinatura (DEC-58), calculada pelo dia de Brasília.
        var hoje = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(_relogio.GetUtcNow().UtcDateTime, FusoBrasilia.Info));
        foreach (var e in lista)
        {
            var (situacao, paraVencer, atraso, _) = AssinaturaService.Calcular(e.PagoAte, hoje);
            e.SituacaoAssinatura = situacao;
            e.DiasParaVencer = paraVencer;
            e.DiasDeAtraso = atraso;
        }
        return lista;
    }

    private async Task<List<EmpresaAdminResumo>> ListarSemSituacaoAsync(string? busca, CancellationToken cancellationToken)
    {
        var query = _db.Empresas.AsNoTracking();

        var termo = busca?.Trim();
        if (!string.IsNullOrEmpty(termo))
        {
            var like = $"%{termo.Replace("%", "").Replace("_", "")}%";
            query = query.Where(e =>
                EF.Functions.ILike(e.Nome, like)
                || (e.Documento != null && EF.Functions.ILike(e.Documento, like))
                || e.Usuarios.Any(u => u.DeletedAt == null && EF.Functions.ILike(u.Email, like)));
        }

        return await query
            .OrderByDescending(e => e.CreatedAt)
            .Take(MaxEmpresasNaLista)
            .Select(e => new EmpresaAdminResumo
            {
                Id = e.Id,
                Nome = e.Nome,
                Documento = e.Documento,
                Ativa = e.Ativa,
                CreatedAt = e.CreatedAt,
                // Usuários que excluíram a conta (LGPD) ficam anonimizados e fora das contas.
                TotalUsuarios = e.Usuarios.Count(u => u.DeletedAt == null),
                UsuariosAtivos = e.Usuarios.Count(u => u.DeletedAt == null && u.Ativo),
                DonoNome = e.Usuarios.Where(u => u.DeletedAt == null && u.Perfil == PerfilUsuario.Dono).OrderBy(u => u.Id).Select(u => u.Nome).FirstOrDefault(),
                DonoEmail = e.Usuarios.Where(u => u.DeletedAt == null && u.Perfil == PerfilUsuario.Dono).OrderBy(u => u.Id).Select(u => u.Email).FirstOrDefault(),
                UltimoAcessoEm = e.Usuarios.Max(u => u.UltimoAcessoEm),
                PagoAte = e.PagoAte,
                LicencasFuncionarios = e.LicencasFuncionarios,
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<EmpresaAdminDetalhe> ObterAsync(long empresaId, CancellationToken cancellationToken)
    {
        var empresa = await _db.Empresas.AsNoTracking()
            .Where(e => e.Id == empresaId)
            .Select(e => new EmpresaAdminDetalhe
            {
                Id = e.Id,
                Nome = e.Nome,
                Documento = e.Documento,
                Ativa = e.Ativa,
                BloqueadaEm = e.BloqueadaEm,
                MotivoBloqueio = e.MotivoBloqueio,
                CreatedAt = e.CreatedAt,
                UltimoAcessoEm = e.Usuarios.Max(u => u.UltimoAcessoEm),
            })
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Empresa não encontrada.");

        empresa.TotalClientes = await _db.Clientes.CountAsync(c => c.EmpresaId == empresaId && c.DeletedAt == null, cancellationToken);
        empresa.TotalAtendimentos = await _db.Atendimentos.CountAsync(a => a.EmpresaId == empresaId && a.DeletedAt == null, cancellationToken);
        empresa.Usuarios = await _db.Usuarios.AsNoTracking()
            .Where(u => u.EmpresaId == empresaId && u.DeletedAt == null)
            .OrderBy(u => u.Perfil).ThenBy(u => u.Nome)
            .Select(u => new UsuarioAdminItem
            {
                Id = u.Id,
                Nome = u.Nome,
                Email = u.Email,
                Perfil = u.Perfil,
                Ativo = u.Ativo,
                DeveTrocarSenha = u.DeveTrocarSenha,
                ConvitePendente = u.EmailConfirmadoEm == null,
                BloqueadoAte = u.BloqueadoAte,
                UltimoAcessoEm = u.UltimoAcessoEm,
                CreatedAt = u.CreatedAt,
            })
            .ToListAsync(cancellationToken);
        empresa.Assinatura = await _assinaturas.ObterAsync(empresaId, comPagamentos: true, cancellationToken);

        return empresa;
    }

    // O Dono nasce com o convite pendente e recebe o link por email para criar a senha (DEC-55).
    public async Task<EmpresaAdminCriadaResponse> CriarAsync(long adminId, EmpresaAdminCriarRequest request, string? ip, CancellationToken cancellationToken)
    {
        var dono = await _authService.CriarEmpresaComDonoAsync(
            request.NomeEmpresa, request.Documento, request.NomeDono, request.EmailDono, senha: null, cancellationToken);

        AdminAuditoria.Registrar(_db, adminId, "criar-empresa", dono.EmpresaId, dono.Id,
            $"Empresa \"{request.NomeEmpresa.Trim()}\" com dono {dono.Email}", ip);
        await _db.SaveChangesAsync(cancellationToken);
        await _convites.EnviarParaUsuarioAsync(dono, cancellationToken);

        return new EmpresaAdminCriadaResponse
        {
            EmpresaId = dono.EmpresaId,
            EmailDono = dono.Email,
            EnvioHabilitado = _convites.EnvioHabilitado,
        };
    }

    // Acesso novo numa empresa (Dono ou Agente), só pela equipe do Agesto (DEC-55).
    public async Task<ConviteEnviadoResponse> CriarUsuarioAsync(
        long adminId, long empresaId, UsuarioCreateRequest request, string? ip, CancellationToken cancellationToken)
    {
        if (request.Perfil is not (PerfilUsuario.Dono or PerfilUsuario.Agente))
            throw new ArgumentException("Perfil inválido.");

        _ = await ObterEmpresaAsync(empresaId, cancellationToken);
        var email = AuthService.NormalizeEmail(request.Email);
        if (await _db.Usuarios.AnyAsync(u => u.Email == email, cancellationToken))
            throw new EmailAlreadyExistsException("Email já cadastrado.");
        // Licenças da assinatura (DEC-58): a equipe aumenta na assinatura antes de criar.
        await _assinaturas.GarantirLicencaAsync(empresaId, cancellationToken);

        var agora = DateTime.UtcNow;
        var usuario = new Usuario
        {
            Nome = request.Nome.Trim(),
            Email = email,
            EmpresaId = empresaId,
            Perfil = request.Perfil,
            Ativo = true,
            CreatedAt = agora,
            UpdatedAt = agora,
        };
        usuario.Senha = _hasher.HashPassword(usuario, AuthService.SenhaDesconhecida());
        _db.Usuarios.Add(usuario);
        await _db.SaveChangesAsync(cancellationToken);

        AdminAuditoria.Registrar(_db, adminId, "criar-usuario", empresaId, usuario.Id,
            $"{usuario.Email} ({usuario.Perfil})", ip);
        await _db.SaveChangesAsync(cancellationToken);
        await _convites.EnviarParaUsuarioAsync(usuario, cancellationToken);

        return new ConviteEnviadoResponse { Email = usuario.Email, EnvioHabilitado = _convites.EnvioHabilitado };
    }

    public async Task BloquearAsync(long adminId, long empresaId, string motivo, string? ip, CancellationToken cancellationToken)
    {
        var empresa = await ObterEmpresaAsync(empresaId, cancellationToken);
        empresa.Ativa = false;
        empresa.BloqueadaEm = DateTime.UtcNow;
        empresa.MotivoBloqueio = motivo.Trim();
        // Bloqueio manual: só a equipe tira, nem o pagamento (DEC-58).
        empresa.BloqueioAutomatico = false;

        AdminAuditoria.Registrar(_db, adminId, "bloquear-empresa", empresaId, detalhes: empresa.MotivoBloqueio, ip: ip);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task DesbloquearAsync(long adminId, long empresaId, string? ip, CancellationToken cancellationToken)
    {
        var empresa = await ObterEmpresaAsync(empresaId, cancellationToken);
        empresa.Ativa = true;
        empresa.BloqueadaEm = null;
        empresa.MotivoBloqueio = null;
        // Se era o bloqueio por atraso, a rotina não bloqueia de novo neste período (DEC-58).
        empresa.BloqueioAutomatico = false;

        AdminAuditoria.Registrar(_db, adminId, "desbloquear-empresa", empresaId, ip: ip);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task DefinirUsuarioAtivoAsync(long adminId, long empresaId, long usuarioId, bool ativo, string? ip, CancellationToken cancellationToken)
    {
        var usuario = await ObterUsuarioAsync(empresaId, usuarioId, cancellationToken);
        if (ativo && !usuario.Ativo)
            await _assinaturas.GarantirLicencaAsync(empresaId, cancellationToken);
        usuario.Ativo = ativo;

        AdminAuditoria.Registrar(_db, adminId, ativo ? "reativar-usuario" : "desativar-usuario", empresaId, usuarioId, usuario.Email, ip);
        await _db.SaveChangesAsync(cancellationToken);
    }

    // Reenvia o convite (pendente) ou manda um link de senha nova (quem já tem
    // acesso). A senha atual continua valendo até a pessoa usar o link; ao usar,
    // o bloqueio por senhas erradas também sai (DEC-55, no lugar da senha provisória).
    public async Task<ConviteEnviadoResponse> EnviarLinkSenhaAsync(long adminId, long empresaId, long usuarioId, string? ip, CancellationToken cancellationToken)
    {
        var usuario = await ObterUsuarioAsync(empresaId, usuarioId, cancellationToken);
        if (!usuario.Ativo)
            throw new InvalidOperationException("Reative o acesso antes de enviar o link de senha.");
        _ = await ObterEmpresaAsync(empresaId, cancellationToken);

        AdminAuditoria.Registrar(_db, adminId,
            usuario.EmailConfirmadoEm is null ? "reenviar-convite" : "enviar-link-senha", empresaId, usuarioId, usuario.Email, ip);
        await _db.SaveChangesAsync(cancellationToken);
        await _convites.EnviarParaUsuarioAsync(usuario, cancellationToken);

        return new ConviteEnviadoResponse { Email = usuario.Email, EnvioHabilitado = _convites.EnvioHabilitado };
    }

    public async Task<IReadOnlyList<AuditoriaAdminItem>> ListarAuditoriaAsync(long? empresaId, CancellationToken cancellationToken)
    {
        var query = _db.AuditoriasAdmin.AsNoTracking();
        if (empresaId is not null) query = query.Where(a => a.EmpresaId == empresaId);

        return await query
            .OrderByDescending(a => a.CreatedAt).ThenByDescending(a => a.Id)
            .Take(MaxRegistrosDeAuditoria)
            .Select(a => new AuditoriaAdminItem
            {
                Id = a.Id,
                AdminNome = a.Admin != null ? a.Admin.Nome : "Sistema",
                Acao = a.Acao,
                EmpresaId = a.EmpresaId,
                EmpresaNome = _db.Empresas.Where(e => e.Id == a.EmpresaId).Select(e => e.Nome).FirstOrDefault(),
                UsuarioId = a.UsuarioId,
                Detalhes = a.Detalhes,
                CreatedAt = a.CreatedAt,
            })
            .ToListAsync(cancellationToken);
    }

    private async Task<Empresa> ObterEmpresaAsync(long empresaId, CancellationToken cancellationToken) =>
        await _db.Empresas.FirstOrDefaultAsync(e => e.Id == empresaId, cancellationToken)
        ?? throw new NotFoundException("Empresa não encontrada.");

    // O usuário precisa ser da empresa da rota: um id de outra empresa dá 404.
    private async Task<Usuario> ObterUsuarioAsync(long empresaId, long usuarioId, CancellationToken cancellationToken) =>
        await _db.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId && u.EmpresaId == empresaId && u.DeletedAt == null, cancellationToken)
        ?? throw new NotFoundException("Usuário não encontrado nesta empresa.");
}
