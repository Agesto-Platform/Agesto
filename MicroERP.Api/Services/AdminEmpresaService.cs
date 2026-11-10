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
    private readonly PasswordHasher<Usuario> _hasher = new();

    public AdminEmpresaService(AppDbContext db, IAuthService authService)
    {
        _db = db;
        _authService = authService;
    }

    public async Task<IReadOnlyList<EmpresaAdminResumo>> ListarAsync(string? busca, CancellationToken cancellationToken)
    {
        var query = _db.Empresas.AsNoTracking();

        var termo = busca?.Trim();
        if (!string.IsNullOrEmpty(termo))
        {
            var like = $"%{termo.Replace("%", "").Replace("_", "")}%";
            query = query.Where(e =>
                EF.Functions.ILike(e.Nome, like)
                || (e.Documento != null && EF.Functions.ILike(e.Documento, like))
                || e.Usuarios.Any(u => EF.Functions.ILike(u.Email, like)));
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
                TotalUsuarios = e.Usuarios.Count,
                UsuariosAtivos = e.Usuarios.Count(u => u.Ativo),
                DonoNome = e.Usuarios.Where(u => u.Perfil == PerfilUsuario.Dono).OrderBy(u => u.Id).Select(u => u.Nome).FirstOrDefault(),
                DonoEmail = e.Usuarios.Where(u => u.Perfil == PerfilUsuario.Dono).OrderBy(u => u.Id).Select(u => u.Email).FirstOrDefault(),
                UltimoAcessoEm = e.Usuarios.Max(u => u.UltimoAcessoEm),
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
            .Where(u => u.EmpresaId == empresaId)
            .OrderBy(u => u.Perfil).ThenBy(u => u.Nome)
            .Select(u => new UsuarioAdminItem
            {
                Id = u.Id,
                Nome = u.Nome,
                Email = u.Email,
                Perfil = u.Perfil,
                Ativo = u.Ativo,
                DeveTrocarSenha = u.DeveTrocarSenha,
                UltimoAcessoEm = u.UltimoAcessoEm,
                CreatedAt = u.CreatedAt,
            })
            .ToListAsync(cancellationToken);

        return empresa;
    }

    public async Task<EmpresaAdminCriadaResponse> CriarAsync(long adminId, EmpresaAdminCriarRequest request, string? ip, CancellationToken cancellationToken)
    {
        var senha = UsuarioService.GerarSenhaProvisoria();
        var dono = await _authService.CriarEmpresaComDonoAsync(
            request.NomeEmpresa, request.Documento, request.NomeDono, request.EmailDono, senha, deveTrocarSenha: true, cancellationToken);

        AdminAuditoria.Registrar(_db, adminId, "criar-empresa", dono.EmpresaId, dono.Id,
            $"Empresa \"{request.NomeEmpresa.Trim()}\" com dono {dono.Email}", ip);
        await _db.SaveChangesAsync(cancellationToken);

        return new EmpresaAdminCriadaResponse { EmpresaId = dono.EmpresaId, EmailDono = dono.Email, SenhaProvisoria = senha };
    }

    public async Task BloquearAsync(long adminId, long empresaId, string motivo, string? ip, CancellationToken cancellationToken)
    {
        var empresa = await ObterEmpresaAsync(empresaId, cancellationToken);
        empresa.Ativa = false;
        empresa.BloqueadaEm = DateTime.UtcNow;
        empresa.MotivoBloqueio = motivo.Trim();

        AdminAuditoria.Registrar(_db, adminId, "bloquear-empresa", empresaId, detalhes: empresa.MotivoBloqueio, ip: ip);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task DesbloquearAsync(long adminId, long empresaId, string? ip, CancellationToken cancellationToken)
    {
        var empresa = await ObterEmpresaAsync(empresaId, cancellationToken);
        empresa.Ativa = true;
        empresa.BloqueadaEm = null;
        empresa.MotivoBloqueio = null;

        AdminAuditoria.Registrar(_db, adminId, "desbloquear-empresa", empresaId, ip: ip);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task DefinirUsuarioAtivoAsync(long adminId, long empresaId, long usuarioId, bool ativo, string? ip, CancellationToken cancellationToken)
    {
        var usuario = await ObterUsuarioAsync(empresaId, usuarioId, cancellationToken);
        usuario.Ativo = ativo;

        AdminAuditoria.Registrar(_db, adminId, ativo ? "reativar-usuario" : "desativar-usuario", empresaId, usuarioId, usuario.Email, ip);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<SenhaProvisoriaAdminResponse> RedefinirSenhaAsync(long adminId, long empresaId, long usuarioId, string? ip, CancellationToken cancellationToken)
    {
        var usuario = await ObterUsuarioAsync(empresaId, usuarioId, cancellationToken);
        var senha = UsuarioService.GerarSenhaProvisoria();
        usuario.Senha = _hasher.HashPassword(usuario, senha);
        usuario.DeveTrocarSenha = true;

        // A senha em si nunca vai para a auditoria.
        AdminAuditoria.Registrar(_db, adminId, "redefinir-senha", empresaId, usuarioId, usuario.Email, ip);
        await _db.SaveChangesAsync(cancellationToken);

        return new SenhaProvisoriaAdminResponse { Email = usuario.Email, SenhaProvisoria = senha };
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
                AdminNome = a.Admin!.Nome,
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
        await _db.Usuarios.FirstOrDefaultAsync(u => u.Id == usuarioId && u.EmpresaId == empresaId, cancellationToken)
        ?? throw new NotFoundException("Usuário não encontrado nesta empresa.");
}
