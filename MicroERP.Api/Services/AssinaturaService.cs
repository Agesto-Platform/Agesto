using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Services;

// Controle de assinatura e licenças (DEC-58). O pagamento é combinado no contato
// (DEC-57) e registrado pela equipe no superadmin; o "pago até" da empresa diz a
// situação. Venceu: 10 dias de carência com aviso ao Dono; depois, bloqueio
// automático, que sai sozinho quando a equipe registra o pagamento.
public sealed class AssinaturaService : IAssinaturaService
{
    public const int DiasDeCarencia = 10;
    public const int DiasDeAvisoAntes = 5;
    public const decimal PrecoAssinatura = 49.90m;
    public const decimal PrecoLicencaExtra = 19.90m;

    private readonly AppDbContext _db;
    private readonly TimeProvider _relogio;

    public AssinaturaService(AppDbContext db, TimeProvider relogio)
    {
        _db = db;
        _relogio = relogio;
    }

    /// <summary>Situação a partir do "pago até" e do dia de hoje (Brasília).</summary>
    public static (SituacaoAssinatura Situacao, int? ParaVencer, int? Atraso, int? ParaBloqueio) Calcular(DateOnly? pagoAte, DateOnly hoje)
    {
        if (pagoAte is null) return (SituacaoAssinatura.SemCobranca, null, null, null);
        var restam = pagoAte.Value.DayNumber - hoje.DayNumber;
        if (restam >= 0)
            return (restam <= DiasDeAvisoAntes ? SituacaoAssinatura.VenceEmBreve : SituacaoAssinatura.EmDia, restam, null, null);
        var atraso = -restam;
        return atraso <= DiasDeCarencia
            ? (SituacaoAssinatura.EmCarencia, null, atraso, DiasDeCarencia - atraso + 1)
            : (SituacaoAssinatura.Atrasada, null, atraso, null);
    }

    /// <summary>R$ 49,90 com o Dono e 1 funcionário; R$ 19,90 por funcionário a mais (DEC-57).</summary>
    public static decimal ValorMensal(int licencasFuncionarios) =>
        PrecoAssinatura + Math.Max(0, licencasFuncionarios - 1) * PrecoLicencaExtra;

    public async Task<AssinaturaResponse> ObterAsync(long empresaId, bool comPagamentos, CancellationToken cancellationToken)
    {
        var empresa = await _db.Empresas.AsNoTracking().FirstOrDefaultAsync(e => e.Id == empresaId, cancellationToken)
            ?? throw new NotFoundException("Empresa não encontrada.");
        return await MontarAsync(empresa, comPagamentos, cancellationToken);
    }

    public async Task GarantirLicencaAsync(long empresaId, CancellationToken cancellationToken)
    {
        var licencas = await _db.Empresas.Where(e => e.Id == empresaId).Select(e => (int?)e.LicencasFuncionarios)
            .FirstOrDefaultAsync(cancellationToken) ?? throw new NotFoundException("Empresa não encontrada.");
        var emUso = await AcessosEmUsoAsync(empresaId, cancellationToken);
        if (emUso >= 1 + licencas)
        {
            throw new RegraUsuarioException(
                $"A assinatura cobre {licencas} {(licencas == 1 ? "funcionário" : "funcionários")} além do Dono, e todos estão em uso. "
                + "Para liberar mais um acesso, fale com a equipe do Agesto ou desative alguém que não usa mais.");
        }
    }

    public async Task<AssinaturaResponse> RegistrarPagamentoAsync(
        long adminId, long empresaId, PagamentoAssinaturaRequest request, string? ip, CancellationToken cancellationToken)
    {
        var empresa = await _db.Empresas.FirstOrDefaultAsync(e => e.Id == empresaId, cancellationToken)
            ?? throw new NotFoundException("Empresa não encontrada.");
        var hoje = Hoje();
        var meses = Math.Clamp(request.Meses, 1, 12);

        // O período começa no dia seguinte ao último pago; sem histórico, hoje.
        var inicio = empresa.PagoAte?.AddDays(1) ?? hoje;
        var fim = inicio.AddMonths(meses).AddDays(-1);
        _db.PagamentosAssinatura.Add(new PagamentoAssinatura
        {
            EmpresaId = empresaId,
            AdminId = adminId,
            Valor = decimal.Round(request.Valor, 2),
            PagoEm = request.PagoEm ?? hoje,
            Forma = request.Forma,
            Meses = meses,
            PeriodoInicio = inicio,
            PeriodoFim = fim,
            Observacao = string.IsNullOrWhiteSpace(request.Observacao) ? null : request.Observacao.Trim(),
            CreatedAt = DateTime.UtcNow,
        });
        empresa.PagoAte = fim;
        AdminAuditoria.Registrar(_db, adminId, "registrar-pagamento", empresaId,
            detalhes: $"R$ {request.Valor:0.00} ({request.Forma}), {meses} {(meses == 1 ? "mês" : "meses")}, pago até {fim:dd/MM/yyyy}", ip: ip);

        DesbloquearSeEmDia(empresa, hoje, adminId, ip);
        await _db.SaveChangesAsync(cancellationToken);
        return await MontarAsync(empresa, comPagamentos: true, cancellationToken);
    }

    public async Task<AssinaturaResponse> AtualizarAsync(
        long adminId, long empresaId, AssinaturaAtualizarRequest request, string? ip, CancellationToken cancellationToken)
    {
        var empresa = await _db.Empresas.FirstOrDefaultAsync(e => e.Id == empresaId, cancellationToken)
            ?? throw new NotFoundException("Empresa não encontrada.");
        var antes = $"{empresa.LicencasFuncionarios} licença(s), pago até {empresa.PagoAte?.ToString("dd/MM/yyyy") ?? "sem cobrança"}";
        empresa.LicencasFuncionarios = Math.Clamp(request.LicencasFuncionarios, 1, 999);
        empresa.PagoAte = request.PagoAte;
        var depois = $"{empresa.LicencasFuncionarios} licença(s), pago até {empresa.PagoAte?.ToString("dd/MM/yyyy") ?? "sem cobrança"}";
        AdminAuditoria.Registrar(_db, adminId, "atualizar-assinatura", empresaId, detalhes: $"{antes} → {depois}", ip: ip);

        DesbloquearSeEmDia(empresa, Hoje(), adminId, ip);
        await _db.SaveChangesAsync(cancellationToken);
        return await MontarAsync(empresa, comPagamentos: true, cancellationToken);
    }

    // Bloqueio automático: venceu há mais de 10 dias. Uma vez por período: se a
    // equipe desbloquear na mão, a rotina não bloqueia de novo até o "pago até" mudar.
    public async Task<int> BloquearAtrasadasAsync(CancellationToken cancellationToken)
    {
        var hoje = Hoje();
        var limite = hoje.AddDays(-DiasDeCarencia - 1);
        var atrasadas = await _db.Empresas
            .Where(e => e.Ativa && e.PagoAte != null && e.PagoAte <= limite
                        && (e.BloqueioAutomaticoReferencia == null || e.BloqueioAutomaticoReferencia != e.PagoAte))
            .ToListAsync(cancellationToken);

        var agora = DateTime.UtcNow;
        foreach (var e in atrasadas)
        {
            e.Ativa = false;
            e.BloqueadaEm = agora;
            e.MotivoBloqueio = $"Assinatura vencida em {e.PagoAte:dd/MM/yyyy}, sem pagamento depois de {DiasDeCarencia} dias de carência.";
            e.BloqueioAutomatico = true;
            e.BloqueioAutomaticoReferencia = e.PagoAte;
            AdminAuditoria.Registrar(_db, null, "bloqueio-automatico", e.Id, detalhes: e.MotivoBloqueio);
        }
        if (atrasadas.Count > 0) await _db.SaveChangesAsync(cancellationToken);
        return atrasadas.Count;
    }

    // Bloqueio automático sai sozinho quando a assinatura volta para dentro da
    // carência. Bloqueio manual (equipe) continua: só a equipe tira.
    private void DesbloquearSeEmDia(Empresa empresa, DateOnly hoje, long adminId, string? ip)
    {
        if (empresa.Ativa || !empresa.BloqueioAutomatico) return;
        if (Calcular(empresa.PagoAte, hoje).Situacao == SituacaoAssinatura.Atrasada) return;
        empresa.Ativa = true;
        empresa.BloqueadaEm = null;
        empresa.MotivoBloqueio = null;
        empresa.BloqueioAutomatico = false;
        AdminAuditoria.Registrar(_db, adminId, "desbloqueio-automatico", empresa.Id, detalhes: "Assinatura em dia", ip: ip);
    }

    private async Task<AssinaturaResponse> MontarAsync(Empresa empresa, bool comPagamentos, CancellationToken cancellationToken)
    {
        var (situacao, paraVencer, atraso, paraBloqueio) = Calcular(empresa.PagoAte, Hoje());
        var resposta = new AssinaturaResponse
        {
            Situacao = situacao,
            PagoAte = empresa.PagoAte,
            DiasParaVencer = paraVencer,
            DiasDeAtraso = atraso,
            DiasParaBloqueio = paraBloqueio,
            LicencasFuncionarios = empresa.LicencasFuncionarios,
            AcessosEmUso = await AcessosEmUsoAsync(empresa.Id, cancellationToken),
            AcessosPermitidos = 1 + empresa.LicencasFuncionarios,
            ValorMensal = ValorMensal(empresa.LicencasFuncionarios),
            Ativa = empresa.Ativa,
            BloqueioAutomatico = empresa.BloqueioAutomatico,
        };
        if (comPagamentos)
        {
            resposta.Pagamentos = await _db.PagamentosAssinatura.AsNoTracking()
                .Where(p => p.EmpresaId == empresa.Id)
                .OrderByDescending(p => p.PeriodoFim).ThenByDescending(p => p.Id)
                .Select(p => new PagamentoAssinaturaItem
                {
                    Id = p.Id,
                    Valor = p.Valor,
                    PagoEm = p.PagoEm,
                    Forma = p.Forma,
                    Meses = p.Meses,
                    PeriodoInicio = p.PeriodoInicio,
                    PeriodoFim = p.PeriodoFim,
                    Observacao = p.Observacao,
                    AdminNome = _db.AdminsPlataforma.Where(a => a.Id == p.AdminId).Select(a => a.Nome).FirstOrDefault(),
                    CreatedAt = p.CreatedAt,
                })
                .ToListAsync(cancellationToken);
        }
        return resposta;
    }

    // Acessos que contam na licença: ativos e não excluídos (inclui convites pendentes).
    private Task<int> AcessosEmUsoAsync(long empresaId, CancellationToken cancellationToken) =>
        _db.Usuarios.CountAsync(u => u.EmpresaId == empresaId && u.DeletedAt == null && u.Ativo, cancellationToken);

    private DateOnly Hoje() =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(_relogio.GetUtcNow().UtcDateTime, FusoBrasilia.Info));
}
