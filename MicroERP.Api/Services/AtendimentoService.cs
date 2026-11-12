using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Services;

public sealed class AtendimentoService : IAtendimentoService
{
    // Dois meses cheios: cobre a visão de mês do web e a navegação para o mês seguinte.
    public const int PeriodoMaximoAgendaDias = 62;

    private readonly IAtendimentoRepository _atendimentoRepository;
    private readonly IClienteRepository _clienteRepository;
    private readonly IItemProdutoRepository _itemProdutoRepository;
    private readonly IItemServicoRepository _itemServicoRepository;
    private readonly IProdutoRepository _produtoRepository;
    private readonly IConfiguracaoRepository _configuracaoRepository;
    private readonly IUsuarioRepository _usuarioRepository;

    public AtendimentoService(
        IAtendimentoRepository atendimentoRepository,
        IClienteRepository clienteRepository,
        IItemProdutoRepository itemProdutoRepository,
        IItemServicoRepository itemServicoRepository,
        IProdutoRepository produtoRepository,
        IConfiguracaoRepository configuracaoRepository,
        IUsuarioRepository usuarioRepository)
    {
        _atendimentoRepository = atendimentoRepository;
        _clienteRepository = clienteRepository;
        _itemProdutoRepository = itemProdutoRepository;
        _itemServicoRepository = itemServicoRepository;
        _produtoRepository = produtoRepository;
        _configuracaoRepository = configuracaoRepository;
        _usuarioRepository = usuarioRepository;
    }

    // O responsável precisa ser um usuário ativo da mesma empresa.
    private async Task ValidarResponsavelAsync(long empresaId, long usuarioId, CancellationToken cancellationToken)
    {
        var usuario = await _usuarioRepository.GetByIdAsync(empresaId, usuarioId, cancellationToken);
        if (usuario is null || !usuario.Ativo) throw new NotFoundException("Agente não encontrado.");
    }

    // Default seguro: controla. Quando false, os itens novos nao baixam estoque.
    private async Task<bool> ControlaEstoqueAsync(long empresaId, CancellationToken cancellationToken)
    {
        var config = await _configuracaoRepository.GetByEmpresaAsync(empresaId, false, cancellationToken);
        return config?.ControlaEstoque ?? true;
    }

    public async Task<IReadOnlyList<AtendimentoResponse>> GetAllAsync(long empresaId, CancellationToken cancellationToken)
    {
        var atendimentos = await _atendimentoRepository.GetAllAsync(empresaId, cancellationToken);
        var resumos = await _atendimentoRepository.GetResumosAsync(empresaId, atendimentos.Select(a => a.Id).ToList(), cancellationToken);
        return atendimentos.Select(a => MapResponse(a, resumos.GetValueOrDefault(a.Id))).ToList();
    }

    public async Task<PaginaResponse<AtendimentoResponse>> GetPaginaAsync(long empresaId, PaginacaoQuery paginacao, AtendimentoFiltroQuery? filtro, CancellationToken cancellationToken)
    {
        var (itens, total) = await _atendimentoRepository.GetPaginaAsync(
            empresaId, paginacao.PaginaOuPadrao, paginacao.TamanhoOuPadrao,
            filtro?.Busca, filtro?.Status, filtro?.ClienteId, cancellationToken);
        var resumos = await _atendimentoRepository.GetResumosAsync(empresaId, itens.Select(a => a.Id).ToList(), cancellationToken);
        return new PaginaResponse<AtendimentoResponse>
        {
            Itens = itens.Select(a => MapResponse(a, resumos.GetValueOrDefault(a.Id))).ToList(),
            Pagina = paginacao.PaginaOuPadrao,
            Tamanho = paginacao.TamanhoOuPadrao,
            Total = total
        };
    }

    public async Task<AtendimentoContagemResponse> ContarPorStatusAsync(long empresaId, CancellationToken cancellationToken)
    {
        var porStatus = await _atendimentoRepository.ContarPorStatusAsync(empresaId, cancellationToken);
        return new AtendimentoContagemResponse
        {
            Todos = porStatus.Values.Sum(),
            Pendente = porStatus.GetValueOrDefault(StatusAtendimento.Pendente),
            Concluido = porStatus.GetValueOrDefault(StatusAtendimento.Concluido),
            Cancelado = porStatus.GetValueOrDefault(StatusAtendimento.Cancelado)
        };
    }

    public async Task<IReadOnlyList<AgendaItemResponse>> GetAgendaAsync(long empresaId, DateTime? de, DateTime? ate, long? agenteId, CancellationToken cancellationToken)
    {
        var (inicio, fim) = ResolvePeriodo(de, ate);
        // PAG-02: a agenda vem inteira, sem paginação; o teto do período limita a resposta.
        if (fim < inicio)
            throw new ArgumentException("O fim do período da agenda vem antes do início.");
        if (fim - inicio > TimeSpan.FromDays(PeriodoMaximoAgendaDias))
            throw new ArgumentException($"O período da agenda é de no máximo {PeriodoMaximoAgendaDias} dias.");
        var atendimentos = await _atendimentoRepository.GetAgendaAsync(empresaId, inicio, fim, agenteId, cancellationToken);
        return atendimentos.Select(MapAgendaItem).ToList();
    }

    public async Task<AtendimentoResponse> GetByIdAsync(long empresaId, long id, CancellationToken cancellationToken)
    {
        var atendimento = await _atendimentoRepository.GetByIdAsync(empresaId, id, false, cancellationToken);
        if (atendimento is null) throw new NotFoundException("Atendimento não encontrado.");
        return MapResponse(atendimento);
    }

    public async Task<AtendimentoResponse> CreateAsync(long empresaId, long usuarioId, AtendimentoCreateRequest request, CancellationToken cancellationToken)
    {
        var cliente = await _clienteRepository.GetByIdAsync(empresaId, request.ClienteId, false, cancellationToken);
        if (cliente is null) throw new NotFoundException("Cliente não encontrado.");

        if (request.ResponsavelId is { } responsavelId && responsavelId != usuarioId)
        {
            await ValidarResponsavelAsync(empresaId, responsavelId, cancellationToken);
            usuarioId = responsavelId;
        }

        var atendimento = new Atendimento
        {
            Uuid = Guid.NewGuid(),
            EmpresaId = empresaId,         // isolamento multi-tenant
            UsuarioId = usuarioId,          // agente responsável (default: quem registrou)
            ClienteId = request.ClienteId,
            Status = request.Status,
            DataRegistro = request.DataRegistro ?? DateTime.UtcNow,
            DataAgendada = request.DataAgendada,
            ValorTotal = 0m,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _atendimentoRepository.AddAsync(atendimento, cancellationToken);
        await _atendimentoRepository.SaveChangesAsync(cancellationToken);

        return MapResponse(atendimento);
    }

    public async Task<AtendimentoResponse> UpdateAsync(long empresaId, long id, AtendimentoUpdateRequest request, CancellationToken cancellationToken)
    {
        var atendimento = await _atendimentoRepository.GetByIdAsync(empresaId, id, true, cancellationToken);
        if (atendimento is null) throw new NotFoundException("Atendimento não encontrado.");

        if (request.ResponsavelId is { } responsavelId && responsavelId != atendimento.UsuarioId)
        {
            await ValidarResponsavelAsync(empresaId, responsavelId, cancellationToken);
            atendimento.UsuarioId = responsavelId;
        }

        // Cancelar devolve o estoque dos itens; sair de Cancelado baixa de novo,
        // conferindo o saldo (E2E-04). As metricas ja tratam cancelado como nao consumido.
        var cancelando = request.Status == StatusAtendimento.Cancelado && atendimento.Status != StatusAtendimento.Cancelado;
        var reativando = request.Status != StatusAtendimento.Cancelado && atendimento.Status == StatusAtendimento.Cancelado;
        if (cancelando || reativando)
        {
            var itens = await _itemProdutoRepository.GetAllByAtendimentoTrackedAsync(atendimento.Id, cancellationToken);
            if (cancelando)
                await EstoqueDosItens.DevolverAsync(itens, empresaId, _produtoRepository, cancellationToken);
            else if (await ControlaEstoqueAsync(empresaId, cancellationToken))
                await EstoqueDosItens.BaixarAsync(itens, empresaId, _produtoRepository, cancellationToken);
        }

        atendimento.Status = request.Status;
        atendimento.DataAgendada = request.DataAgendada;
        atendimento.UpdatedAt = DateTime.UtcNow;

        await _atendimentoRepository.SaveChangesAsync(cancellationToken);

        return MapResponse(atendimento);
    }

    public async Task DeleteAsync(long empresaId, long id, CancellationToken cancellationToken)
    {
        var atendimento = await _atendimentoRepository.GetByIdAsync(empresaId, id, true, cancellationToken);
        if (atendimento is null) throw new NotFoundException("Atendimento não encontrado.");

        var now = DateTime.UtcNow;

        // Soft delete e reversao do estoque que cada item baixou (E2E-03): avulso,
        // lancado com a chave desligada ou ja devolvido no cancelamento nao volta.
        var itensProduto = await _itemProdutoRepository.GetAllByAtendimentoTrackedAsync(atendimento.Id, cancellationToken);
        await EstoqueDosItens.DevolverAsync(itensProduto, empresaId, _produtoRepository, cancellationToken);
        foreach (var item in itensProduto)
            item.DeletedAt = now;

        // Soft delete dos itens de serviço
        var itensServico = await _itemServicoRepository.GetAllByAtendimentoTrackedAsync(atendimento.Id, cancellationToken);
        foreach (var item in itensServico)
            item.DeletedAt = now;

        atendimento.DeletedAt = now;

        await _atendimentoRepository.SaveChangesAsync(cancellationToken);
    }

    // Descrição curta do atendimento: o primeiro serviço, senão o primeiro produto.
    private static string? Resumo(Atendimento a)
    {
        var servico = a.ItensServico.Where(i => i.DeletedAt == null).OrderBy(i => i.Id).FirstOrDefault()?.Servico?.Descricao;
        if (!string.IsNullOrWhiteSpace(servico)) return servico;
        var itemProduto = a.ItensProduto.Where(i => i.DeletedAt == null).OrderBy(i => i.Id).FirstOrDefault();
        var produto = itemProduto?.Descricao ?? itemProduto?.Produto?.Nome;
        return string.IsNullOrWhiteSpace(produto) ? null : produto;
    }

    private static AgendaItemResponse MapAgendaItem(Atendimento a)
    {
        var resumo = Resumo(a) ?? "Atendimento";

        // Cliente soft-deletado e tratado como ausente (mantem a invariante de soft-delete).
        var cliente = a.Cliente is { DeletedAt: null } ? a.Cliente : null;

        return new AgendaItemResponse
        {
            Id = a.Id,
            Uuid = a.Uuid.ToString(),
            DataAgendada = a.DataAgendada,
            Status = a.Status,
            ValorTotal = a.ValorTotal,
            UsuarioId = a.UsuarioId,
            ClienteId = a.ClienteId,
            ClienteNome = cliente?.Nome ?? string.Empty,
            ClienteTelefone = cliente?.Telefone,
            EnderecoResumo = Enderecos.Resumo(cliente),
            EnderecoCompleto = Enderecos.Completo(cliente),
            Latitude = cliente?.Latitude,
            Longitude = cliente?.Longitude,
            Resumo = resumo,
            Itens = a.ItensServico.Where(i => i.DeletedAt == null)
                .Select(i => new AgendaItemLinhaResponse
                {
                    Descricao = i.Servico?.Descricao ?? "Serviço",
                    Quantidade = i.Quantidade,
                    PrecoUnitario = i.PrecoUnitario,
                    Subtotal = i.Subtotal
                })
                .Concat(a.ItensProduto.Where(i => i.DeletedAt == null)
                    .Select(i => new AgendaItemLinhaResponse
                    {
                        Descricao = i.Descricao ?? i.Produto?.Nome ?? "Produto",
                        Quantidade = i.Quantidade,
                        PrecoUnitario = i.PrecoUnitario,
                        Subtotal = i.Subtotal
                    }))
                .ToList()
        };
    }

    // Periodo padrao da agenda: mes corrente (UTC).
    private static (DateTime Inicio, DateTime Fim) ResolvePeriodo(DateTime? de, DateTime? ate)
    {
        var agora = DateTime.UtcNow;
        var inicio = de ?? new DateTime(agora.Year, agora.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var fim = ate ?? inicio.AddMonths(1).AddTicks(-1);
        return (inicio, fim);
    }

    private static AtendimentoResponse MapResponse(Atendimento atendimento) => MapResponse(atendimento, null);

    private static AtendimentoResponse MapResponse(Atendimento atendimento, string? resumo)
    {
        var cliente = atendimento.Cliente is { DeletedAt: null } c ? c : null;
        return new AtendimentoResponse
        {
            Id = atendimento.Id,
            Uuid = atendimento.Uuid.ToString(),
            DataRegistro = atendimento.DataRegistro,
            DataAgendada = atendimento.DataAgendada,
            Status = atendimento.Status,
            ValorTotal = atendimento.ValorTotal,
            CustoTotal = atendimento.CustoTotal,
            Margem = atendimento.ValorTotal - atendimento.CustoTotal,
            ClienteId = atendimento.ClienteId,
            UsuarioId = atendimento.UsuarioId,
            Resumo = resumo,
            // Só quando a consulta trouxe o cliente (lista paginada); excluído = ausente.
            ClienteNome = cliente?.Nome,
            ClienteTelefone = cliente?.Telefone,
            EnderecoResumo = cliente is null ? null : Enderecos.Resumo(cliente),
            CreatedAt = atendimento.CreatedAt,
            UpdatedAt = atendimento.UpdatedAt
        };
    }
}