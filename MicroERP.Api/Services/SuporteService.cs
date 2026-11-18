using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Services.Arquivos;
using MicroERP.Api.Services.Email;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Services;

// Chamados de suporte (DEC-60). O Dono abre pela aba Suporte do painel: o
// chamado vai por email para a equipe do Agesto (Email:SuporteEmail) com cópia
// para o Dono. A equipe responde e avança o status no superadmin, e o Dono
// recebe um email a cada resposta.
public sealed class SuporteService : ISuporteService
{
    // Protege a cota de emails (Brevo) de um formulário enviado em loop.
    public const int LimitePorDia = 10;
    // Anexos: imagens (PNG, JPG, WEBP) e PDF. O web já comprime as imagens antes de enviar.
    public const int MaxAnexos = 3;
    public const long MaxBytesAnexo = 5 * 1024 * 1024;
    private static readonly TimeSpan ValidadeLink = TimeSpan.FromMinutes(10);

    private readonly AppDbContext _db;
    private readonly IFilaDeEmails _fila;
    private readonly EmailOptions _options;
    private readonly IArmazenamentoArquivos _arquivos;
    private readonly ILogger<SuporteService> _logger;

    public SuporteService(
        AppDbContext db, IFilaDeEmails fila, IOptions<EmailOptions> options,
        IArmazenamentoArquivos arquivos, ILogger<SuporteService> logger)
    {
        _db = db;
        _fila = fila;
        _options = options.Value;
        _arquivos = arquivos;
        _logger = logger;
    }

    public async Task<TicketResponse> CriarAsync(
        long empresaId, long usuarioId, TicketCriarRequest request, IReadOnlyList<ArquivoRecebido> anexos, CancellationToken cancellationToken)
    {
        if (!Enum.IsDefined(request.Assunto))
            throw new ArgumentException("Assunto inválido.");
        var mensagem = (request.Mensagem ?? string.Empty).Trim();
        if (mensagem.Length < 10)
            throw new ArgumentException("Escreva pelo menos 10 caracteres.");
        if (mensagem.Length > 4000)
            throw new ArgumentException("A mensagem deve ter no máximo 4000 caracteres.");
        var arquivos = ValidarAnexos(anexos);

        var dono = await _db.Usuarios.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == usuarioId && u.EmpresaId == empresaId && u.DeletedAt == null, cancellationToken)
            ?? throw new NotFoundException("Usuário não encontrado.");
        var empresa = await _db.Empresas.AsNoTracking()
            .Where(e => e.Id == empresaId).Select(e => e.Nome)
            .FirstOrDefaultAsync(cancellationToken) ?? "Empresa";

        var agora = DateTime.UtcNow;
        var recentes = await _db.TicketsSuporte
            .CountAsync(t => t.EmpresaId == empresaId && t.CreatedAt > agora.AddDays(-1), cancellationToken);
        if (recentes >= LimitePorDia)
            throw new InvalidOperationException($"Sua empresa já abriu {LimitePorDia} chamados nas últimas 24 horas. Aguarde a resposta da equipe ou fale pelo WhatsApp do Agesto.");

        var ticket = new TicketSuporte
        {
            EmpresaId = empresaId,
            UsuarioId = usuarioId,
            Assunto = request.Assunto,
            Mensagem = mensagem,
            Status = StatusTicket.Aberto,
            CreatedAt = agora,
            UpdatedAt = agora,
        };

        // Os arquivos sobem antes de gravar o chamado; se a gravação falhar, saem do bucket.
        var enviados = new List<string>();
        try
        {
            foreach (var (arquivo, tipo) in arquivos)
            {
                var caminho = $"empresa-{empresaId}/{Guid.NewGuid():N}{tipo.Extensao}";
                await _arquivos.EnviarAsync(caminho, arquivo.Conteudo, tipo.ContentType, cancellationToken);
                enviados.Add(caminho);
                ticket.Anexos.Add(new AnexoTicketSuporte
                {
                    NomeArquivo = NomeSeguro(arquivo.Nome, tipo.Extensao),
                    ContentType = tipo.ContentType,
                    Tamanho = arquivo.Conteudo.LongLength,
                    Caminho = caminho,
                    CreatedAt = agora,
                });
            }
            _db.TicketsSuporte.Add(ticket);
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            await RemoverSemFalharAsync(enviados);
            if (ex is HttpRequestException)
                throw new InvalidOperationException("Não foi possível guardar os anexos agora. Tente de novo ou envie sem anexos.", ex);
            throw;
        }

        if (string.IsNullOrWhiteSpace(_options.SuporteEmail))
            _logger.LogWarning("Email:SuporteEmail não configurado: o chamado #{Id} não foi enviado para a equipe.", ticket.Id);
        else
            Enfileirar(EmailsDeSuporte.NovoParaEquipe(
                _options.SuporteEmail, ticket.Id, ticket.Assunto, mensagem, empresa, dono.Nome, dono.Email, ticket.Anexos.Count, _options.UrlWeb));
        Enfileirar(EmailsDeSuporte.CopiaParaDono(dono.Email, dono.Nome, ticket.Id, ticket.Assunto, mensagem, ticket.Anexos.Count, _options.UrlWeb));

        var criado = Map(ticket, respostas: []);
        criado.Anexos = await AnexosAsync(ticket.Anexos, cancellationToken);
        return criado;
    }

    private List<(ArquivoRecebido Arquivo, TiposDeArquivo.Tipo Tipo)> ValidarAnexos(IReadOnlyList<ArquivoRecebido> anexos)
    {
        if (anexos.Count == 0) return [];
        if (!_arquivos.Habilitado)
            throw new ArgumentException("Os anexos ainda não estão disponíveis. Envie o chamado sem anexos.");
        if (anexos.Count > MaxAnexos)
            throw new ArgumentException($"Anexe no máximo {MaxAnexos} arquivos.");
        var validos = new List<(ArquivoRecebido, TiposDeArquivo.Tipo)>();
        foreach (var a in anexos)
        {
            if (a.Conteudo.Length == 0)
                throw new ArgumentException($"O arquivo {a.Nome} está vazio.");
            if (a.Conteudo.LongLength > MaxBytesAnexo)
                throw new ArgumentException($"O arquivo {a.Nome} passa de 5 MB.");
            var tipo = TiposDeArquivo.Detectar(a.Conteudo)
                ?? throw new ArgumentException($"O arquivo {a.Nome} não é uma imagem (PNG, JPG, WEBP) nem um PDF.");
            validos.Add((a, tipo));
        }
        return validos;
    }

    // Nome só para exibir: sem caminho, sem caracteres de controle, com a extensão do tipo real.
    private static string NomeSeguro(string nome, string extensao)
    {
        var baseNome = Path.GetFileNameWithoutExtension(Path.GetFileName(nome ?? string.Empty));
        baseNome = new string(baseNome.Where(c => !char.IsControl(c) && c is not ('/' or '\\' or '"')).ToArray()).Trim();
        if (baseNome.Length == 0) baseNome = "anexo";
        if (baseNome.Length > 100) baseNome = baseNome[..100];
        return baseNome + extensao;
    }

    private async Task RemoverSemFalharAsync(IReadOnlyCollection<string> caminhos)
    {
        try
        {
            await _arquivos.RemoverAsync(caminhos, CancellationToken.None);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Não foi possível remover {Total} anexo(s) de um chamado que não foi gravado.", caminhos.Count);
        }
    }

    private async Task<List<AnexoTicketResponse>> AnexosAsync(IEnumerable<AnexoTicketSuporte> anexos, CancellationToken cancellationToken)
    {
        var lista = new List<AnexoTicketResponse>();
        foreach (var a in anexos.OrderBy(x => x.Id))
        {
            string? url = null;
            if (_arquivos.Habilitado)
            {
                try
                {
                    url = await _arquivos.LinkTemporarioAsync(a.Caminho, ValidadeLink, cancellationToken);
                }
                catch (HttpRequestException ex)
                {
                    _logger.LogWarning(ex, "Não foi possível gerar o link do anexo {Id}.", a.Id);
                }
            }
            lista.Add(new AnexoTicketResponse { Id = a.Id, NomeArquivo = a.NomeArquivo, ContentType = a.ContentType, Tamanho = a.Tamanho, Url = url });
        }
        return lista;
    }

    public async Task<IReadOnlyList<TicketResponse>> ListarDaEmpresaAsync(long empresaId, CancellationToken cancellationToken)
    {
        var tickets = await _db.TicketsSuporte.AsNoTracking()
            .Where(t => t.EmpresaId == empresaId && t.DeletedAt == null)
            .OrderByDescending(t => t.UpdatedAt)
            .Select(t => new { Ticket = t, Total = t.Respostas.Count, Anexos = t.Anexos.Count })
            .ToListAsync(cancellationToken);
        return tickets.Select(x =>
        {
            var r = Map(x.Ticket, null, x.Total);
            r.TotalAnexos = x.Anexos;
            return r;
        }).ToList();
    }

    public async Task<TicketResponse> ObterDaEmpresaAsync(long empresaId, long id, CancellationToken cancellationToken)
    {
        var ticket = await Consulta()
            .FirstOrDefaultAsync(t => t.Id == id && t.EmpresaId == empresaId && t.DeletedAt == null, cancellationToken)
            ?? throw new NotFoundException("Chamado não encontrado.");
        var r = Map(ticket, ticket.Respostas);
        r.Anexos = await AnexosAsync(ticket.Anexos, cancellationToken);
        return r;
    }

    public async Task<IReadOnlyList<TicketResponse>> ListarAdminAsync(StatusTicket? status, CancellationToken cancellationToken)
    {
        var query = _db.TicketsSuporte.AsNoTracking().Where(t => t.DeletedAt == null);
        if (status is not null) query = query.Where(t => t.Status == status);
        var tickets = await query
            .OrderBy(t => t.Status == StatusTicket.Resolvido)
            .ThenByDescending(t => t.UpdatedAt)
            .Take(200)
            .Select(t => new
            {
                Ticket = t,
                Total = t.Respostas.Count,
                Anexos = t.Anexos.Count,
                Empresa = t.Empresa!.Nome,
                DonoNome = t.Usuario!.Nome,
                DonoEmail = t.Usuario!.Email,
            })
            .ToListAsync(cancellationToken);
        return tickets.Select(x =>
        {
            var r = Map(x.Ticket, null, x.Total);
            r.TotalAnexos = x.Anexos;
            r.EmpresaId = x.Ticket.EmpresaId;
            r.EmpresaNome = x.Empresa;
            r.DonoNome = x.DonoNome;
            r.DonoEmail = x.DonoEmail;
            return r;
        }).ToList();
    }

    public async Task<TicketResponse> ObterAdminAsync(long id, CancellationToken cancellationToken)
    {
        var ticket = await Consulta()
            .Include(t => t.Empresa)
            .Include(t => t.Usuario)
            .FirstOrDefaultAsync(t => t.Id == id && t.DeletedAt == null, cancellationToken)
            ?? throw new NotFoundException("Chamado não encontrado.");
        var r = MapAdmin(ticket);
        r.Anexos = await AnexosAsync(ticket.Anexos, cancellationToken);
        return r;
    }

    public async Task<TicketResponse> ResponderAsync(long adminId, long id, TicketResponderRequest request, string? ip, CancellationToken cancellationToken)
    {
        var mensagem = (request.Mensagem ?? string.Empty).Trim();
        if (mensagem.Length < 2)
            throw new ArgumentException("Escreva a resposta.");
        if (mensagem.Length > 4000)
            throw new ArgumentException("A resposta deve ter no máximo 4000 caracteres.");
        if (request.Status is { } s && !Enum.IsDefined(s))
            throw new ArgumentException("Status inválido.");

        var ticket = await _db.TicketsSuporte
            .Include(t => t.Usuario)
            .FirstOrDefaultAsync(t => t.Id == id && t.DeletedAt == null, cancellationToken)
            ?? throw new NotFoundException("Chamado não encontrado.");

        var agora = DateTime.UtcNow;
        _db.RespostasTicketSuporte.Add(new RespostaTicketSuporte { TicketId = ticket.Id, AdminId = adminId, Mensagem = mensagem, CreatedAt = agora });
        // Responder um chamado aberto já o coloca em andamento, se a equipe não escolher outro status.
        AplicarStatus(ticket, request.Status ?? (ticket.Status == StatusTicket.Aberto ? StatusTicket.EmAndamento : ticket.Status), agora);
        ticket.UpdatedAt = agora;
        AdminAuditoria.Registrar(_db, adminId, "responder-chamado", ticket.EmpresaId, ticket.UsuarioId,
            detalhes: $"Chamado #{ticket.Id}; status {ticket.Status}", ip: ip);
        await _db.SaveChangesAsync(cancellationToken);

        if (ticket.Usuario is { DeletedAt: null } dono)
            Enfileirar(EmailsDeSuporte.RespostaParaDono(dono.Email, dono.Nome, ticket.Id, ticket.Status, mensagem, _options.UrlWeb));

        return await ObterAdminAsync(ticket.Id, cancellationToken);
    }

    public async Task<TicketResponse> MudarStatusAsync(long adminId, long id, StatusTicket status, string? ip, CancellationToken cancellationToken)
    {
        if (!Enum.IsDefined(status))
            throw new ArgumentException("Status inválido.");
        var ticket = await _db.TicketsSuporte
            .FirstOrDefaultAsync(t => t.Id == id && t.DeletedAt == null, cancellationToken)
            ?? throw new NotFoundException("Chamado não encontrado.");

        var antes = ticket.Status;
        var agora = DateTime.UtcNow;
        AplicarStatus(ticket, status, agora);
        ticket.UpdatedAt = agora;
        AdminAuditoria.Registrar(_db, adminId, "status-chamado", ticket.EmpresaId, ticket.UsuarioId,
            detalhes: $"Chamado #{ticket.Id}: {antes} → {status}", ip: ip);
        await _db.SaveChangesAsync(cancellationToken);
        return await ObterAdminAsync(ticket.Id, cancellationToken);
    }

    private static void AplicarStatus(TicketSuporte ticket, StatusTicket status, DateTime agora)
    {
        ticket.Status = status;
        ticket.ResolvidoEm = status == StatusTicket.Resolvido ? (ticket.ResolvidoEm ?? agora) : null;
    }

    private IQueryable<TicketSuporte> Consulta() =>
        _db.TicketsSuporte.AsNoTracking()
            .Include(t => t.Anexos)
            .Include(t => t.Respostas.OrderBy(r => r.CreatedAt))
            .ThenInclude(r => r.Admin);

    private void Enfileirar(EmailMensagem mensagem)
    {
        if (!_fila.Enfileirar(mensagem))
            _logger.LogWarning("Fila de emails cheia: um email de suporte não foi enviado.");
    }

    private static TicketResponse MapAdmin(TicketSuporte t)
    {
        var r = Map(t, t.Respostas);
        r.EmpresaId = t.EmpresaId;
        r.EmpresaNome = t.Empresa?.Nome;
        r.DonoNome = t.Usuario?.Nome;
        r.DonoEmail = t.Usuario?.Email;
        return r;
    }

    private static TicketResponse Map(TicketSuporte t, IEnumerable<RespostaTicketSuporte>? respostas, int? total = null)
    {
        var lista = respostas?.Select(r => new RespostaTicketResponse
        {
            Id = r.Id,
            Mensagem = r.Mensagem,
            Autor = r.Admin?.Nome ?? "Equipe Agesto",
            CreatedAt = r.CreatedAt,
        }).ToList();
        return new TicketResponse
        {
            Id = t.Id,
            Assunto = t.Assunto,
            Status = t.Status,
            Mensagem = t.Mensagem,
            TotalRespostas = total ?? lista?.Count ?? 0,
            TotalAnexos = t.Anexos.Count,
            CreatedAt = t.CreatedAt,
            UpdatedAt = t.UpdatedAt,
            ResolvidoEm = t.ResolvidoEm,
            Respostas = lista,
        };
    }
}
