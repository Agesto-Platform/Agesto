using MicroERP.Api.DTOs;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Services;

public sealed class AtendimentoService : IAtendimentoService
{
    private readonly IAtendimentoRepository _atendimentoRepository;
    private readonly IClienteRepository _clienteRepository;
    private readonly IItemProdutoRepository _itemProdutoRepository;
    private readonly IItemServicoRepository _itemServicoRepository;
    private readonly IProdutoRepository _produtoRepository;
    private readonly IConfiguracaoRepository _configuracaoRepository;

    public AtendimentoService(
        IAtendimentoRepository atendimentoRepository,
        IClienteRepository clienteRepository,
        IItemProdutoRepository itemProdutoRepository,
        IItemServicoRepository itemServicoRepository,
        IProdutoRepository produtoRepository,
        IConfiguracaoRepository configuracaoRepository)
    {
        _atendimentoRepository = atendimentoRepository;
        _clienteRepository = clienteRepository;
        _itemProdutoRepository = itemProdutoRepository;
        _itemServicoRepository = itemServicoRepository;
        _produtoRepository = produtoRepository;
        _configuracaoRepository = configuracaoRepository;
    }

    // Default seguro: controla. Quando false, o cancelamento nao devolve estoque.
    private async Task<bool> ControlaEstoqueAsync(long empresaId, CancellationToken cancellationToken)
    {
        var config = await _configuracaoRepository.GetByEmpresaAsync(empresaId, false, cancellationToken);
        return config?.ControlaEstoque ?? true;
    }

    public async Task<IReadOnlyList<AtendimentoResponse>> GetAllAsync(long empresaId, CancellationToken cancellationToken)
    {
        var atendimentos = await _atendimentoRepository.GetAllAsync(empresaId, cancellationToken);
        return atendimentos.Select(MapResponse).ToList();
    }

    public async Task<IReadOnlyList<AgendaItemResponse>> GetAgendaAsync(long empresaId, DateTime? de, DateTime? ate, long? agenteId, CancellationToken cancellationToken)
    {
        var (inicio, fim) = ResolvePeriodo(de, ate);
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

        var atendimento = new Atendimento
        {
            Uuid = Guid.NewGuid(),
            EmpresaId = empresaId,         // isolamento multi-tenant
            UsuarioId = usuarioId,          // agente que registrou
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

        // Soft delete e reversão de estoque dos itens de produto
        var controlaEstoque = await ControlaEstoqueAsync(empresaId, cancellationToken);
        var itensProduto = await _itemProdutoRepository.GetAllByAtendimentoTrackedAsync(atendimento.Id, cancellationToken);
        foreach (var item in itensProduto)
        {
            // Devolve estoque só para item de catalogo (avulso nao movimentou) e
            // apenas quando a empresa controla estoque.
            if (item.ProdutoId.HasValue && controlaEstoque)
            {
                var produto = await _produtoRepository.GetByIdAsync(empresaId, item.ProdutoId.Value, true, cancellationToken);
                if (produto is not null)
                {
                    produto.QuantidadeEstoque += item.Quantidade;
                }
            }
            item.DeletedAt = now;
        }

        // Soft delete dos itens de serviço
        var itensServico = await _itemServicoRepository.GetAllByAtendimentoTrackedAsync(atendimento.Id, cancellationToken);
        foreach (var item in itensServico)
            item.DeletedAt = now;

        atendimento.DeletedAt = now;

        await _atendimentoRepository.SaveChangesAsync(cancellationToken);
    }

    private static AgendaItemResponse MapAgendaItem(Atendimento a)
    {
        var servico = a.ItensServico.FirstOrDefault(i => i.DeletedAt == null)?.Servico?.Descricao;
        var itemProduto = a.ItensProduto.FirstOrDefault(i => i.DeletedAt == null);
        var produto = itemProduto?.Descricao ?? itemProduto?.Produto?.Nome;
        var resumo = !string.IsNullOrWhiteSpace(servico) ? servico
                   : !string.IsNullOrWhiteSpace(produto) ? produto
                   : "Atendimento";

        // Cliente soft-deletado e tratado como ausente (mantem a invariante de soft-delete).
        var cliente = a.Cliente is { DeletedAt: null } ? a.Cliente : null;

        return new AgendaItemResponse
        {
            Id = a.Id,
            Uuid = a.Uuid.ToString(),
            DataAgendada = a.DataAgendada,
            Status = a.Status,
            ValorTotal = a.ValorTotal,
            ClienteId = a.ClienteId,
            ClienteNome = cliente?.Nome ?? string.Empty,
            ClienteTelefone = cliente?.Telefone,
            EnderecoResumo = FormatEndereco(cliente),
            Resumo = resumo
        };
    }

    private static string? FormatEndereco(Cliente? cliente)
    {
        if (cliente is null) return null;

        var partes = new List<string>();
        if (!string.IsNullOrWhiteSpace(cliente.Logradouro))
        {
            var rua = cliente.Logradouro!;
            if (!string.IsNullOrWhiteSpace(cliente.Numero)) rua += $", {cliente.Numero}";
            partes.Add(rua);
        }
        var local = !string.IsNullOrWhiteSpace(cliente.Bairro) ? cliente.Bairro : cliente.Cidade;
        if (!string.IsNullOrWhiteSpace(local)) partes.Add(local!);

        return partes.Count > 0 ? string.Join(" — ", partes) : null;
    }

    // Periodo padrao da agenda: mes corrente (UTC).
    private static (DateTime Inicio, DateTime Fim) ResolvePeriodo(DateTime? de, DateTime? ate)
    {
        var agora = DateTime.UtcNow;
        var inicio = de ?? new DateTime(agora.Year, agora.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var fim = ate ?? inicio.AddMonths(1).AddTicks(-1);
        return (inicio, fim);
    }

    private static AtendimentoResponse MapResponse(Atendimento atendimento)
    {
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
            CreatedAt = atendimento.CreatedAt,
            UpdatedAt = atendimento.UpdatedAt
        };
    }
}