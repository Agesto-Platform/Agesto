using Microsoft.EntityFrameworkCore;
using MicroERP.Api.Data;
using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Services;

public sealed class SyncService : ISyncService
{
    private readonly AppDbContext _dbContext;
    private readonly IClienteService _clienteService;
    private readonly IClienteRepository _clienteRepository;
    private readonly IProdutoRepository _produtoRepository;
    private readonly IServicoRepository _servicoRepository;
    private readonly IAtendimentoRepository _atendimentoRepository;
    private readonly IItemProdutoRepository _itemProdutoRepository;
    private readonly IItemServicoRepository _itemServicoRepository;

    public SyncService(
        AppDbContext dbContext,
        IClienteService clienteService,
        IClienteRepository clienteRepository,
        IProdutoRepository produtoRepository,
        IServicoRepository servicoRepository,
        IAtendimentoRepository atendimentoRepository,
        IItemProdutoRepository itemProdutoRepository,
        IItemServicoRepository itemServicoRepository)
    {
        _dbContext = dbContext;
        _clienteService = clienteService;
        _clienteRepository = clienteRepository;
        _produtoRepository = produtoRepository;
        _servicoRepository = servicoRepository;
        _atendimentoRepository = atendimentoRepository;
        _itemProdutoRepository = itemProdutoRepository;
        _itemServicoRepository = itemServicoRepository;
    }

    public async Task<SyncCargaResponse> CargaAsync(long empresaId, DateTime? ultimaSincronizacao, CancellationToken cancellationToken)
    {
        var desde = ultimaSincronizacao ?? DateTime.MinValue;

        var clientes = await _dbContext.Clientes
            .AsNoTracking()
            .Where(c => c.EmpresaId == empresaId && c.DeletedAt == null && c.UpdatedAt > desde)
            .OrderBy(c => c.Nome)
            .Select(c => new ClienteResponse
            {
                Id = c.Id,
                Uuid = c.Uuid.ToString(),
                Nome = c.Nome,
                Telefone = c.Telefone,
                Cpf = c.Cpf,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt
            })
            .ToListAsync(cancellationToken);

        var produtos = await _dbContext.Produtos
            .AsNoTracking()
            .Where(p => p.EmpresaId == empresaId && p.DeletedAt == null && p.UpdatedAt > desde)
            .OrderBy(p => p.Nome)
            .Select(p => new ProdutoResponse
            {
                Id = p.Id,
                Uuid = p.Uuid.ToString(),
                Nome = p.Nome,
                Preco = p.Preco,
                QuantidadeEstoque = p.QuantidadeEstoque,
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt
            })
            .ToListAsync(cancellationToken);

        var servicos = await _dbContext.Servicos
            .AsNoTracking()
            .Where(s => s.EmpresaId == empresaId && s.DeletedAt == null && s.UpdatedAt > desde)
            .OrderBy(s => s.Descricao)
            .Select(s => new ServicoResponse
            {
                Id = s.Id,
                Uuid = s.Uuid.ToString(),
                Descricao = s.Descricao,
                TipoCobranca = s.TipoCobranca,
                ValorHora = s.ValorHora,
                ValorEmpreitada = s.ValorEmpreitada,
                CreatedAt = s.CreatedAt,
                UpdatedAt = s.UpdatedAt
            })
            .ToListAsync(cancellationToken);

        // Orcamentos atualizados desde a ultima sync (com itens) — o agente ve as
        // propostas em campo. Materializa e mapeia em memoria (nested + Uuid.ToString).
        var orcamentosDb = await _dbContext.Orcamentos
            .AsNoTracking()
            .Where(o => o.EmpresaId == empresaId && o.DeletedAt == null && o.UpdatedAt > desde)
            .Include(o => o.Itens)
            .OrderBy(o => o.DataRegistro)
            .ToListAsync(cancellationToken);

        var orcamentos = orcamentosDb
            .Select(o => new OrcamentoResponse
            {
                Id = o.Id,
                Uuid = o.Uuid.ToString(),
                ClienteId = o.ClienteId,
                Status = o.Status,
                ValorTotal = o.ValorTotal,
                DataRegistro = o.DataRegistro,
                AtendimentoConvertidoId = o.AtendimentoConvertidoId,
                CreatedAt = o.CreatedAt,
                UpdatedAt = o.UpdatedAt,
                Itens = o.Itens
                    .Where(i => i.DeletedAt == null)
                    .Select(i => new ItemOrcamentoResponse
                    {
                        Id = i.Id,
                        ProdutoId = i.ProdutoId,
                        ServicoId = i.ServicoId,
                        Descricao = i.Descricao,
                        Quantidade = i.Quantidade,
                        PrecoUnitario = i.PrecoUnitario,
                        Subtotal = i.Subtotal,
                        Custo = i.Custo
                    })
                    .ToList()
            })
            .ToList();

        // Materiais sugeridos (kit) de todos os serviços da empresa — o agente
        // vê e adiciona em campo, offline. Achatado (servicoId, produtoId, qtd).
        var sugeridos = await _dbContext.ServicoItemSugeridos
            .AsNoTracking()
            .Where(s => s.EmpresaId == empresaId)
            .OrderBy(s => s.ServicoId)
            .Select(s => new SyncSugeridoResponse
            {
                ServicoId = s.ServicoId,
                ProdutoId = s.ProdutoId,
                QuantidadePadrao = s.QuantidadePadrao,
            })
            .ToListAsync(cancellationToken);

        // Configuracao da empresa — o mobile precisa dela para saber o modo de
        // agenda (Flexivel/Fixa) e se controla estoque. Vai em toda Carga (nao
        // depende de UpdatedAt: e um unico registro pequeno e sempre relevante).
        var configuracao = await _dbContext.Configuracoes
            .AsNoTracking()
            .Where(c => c.EmpresaId == empresaId)
            .Select(c => new ConfiguracaoResponse
            {
                Id = c.Id,
                TipoOperacao = c.TipoOperacao,
                ModoAgendaAgente = c.ModoAgendaAgente,
                ControlaEstoque = c.ControlaEstoque,
                EmpresaId = c.EmpresaId,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt
            })
            .FirstOrDefaultAsync(cancellationToken)
            ?? new ConfiguracaoResponse
            {
                EmpresaId = empresaId,
                TipoOperacao = TipoOperacao.Servico,
                ModoAgendaAgente = ModoAgendaAgente.Flexivel,
                ControlaEstoque = true
            };

        return new SyncCargaResponse
        {
            Clientes = clientes,
            Produtos = produtos,
            Servicos = servicos,
            Orcamentos = orcamentos,
            Sugeridos = sugeridos,
            Configuracao = configuracao,
            SincronizadoEm = DateTime.UtcNow
        };
    }

    public async Task<SyncDescargaResponse> DescargaAsync(long empresaId, long usuarioId, SyncDescargaRequest request, CancellationToken cancellationToken)
    {
        var erros = new List<string>();
        var clientesImportados = 0;
        var atendimentosImportados = 0;

        var config = await _dbContext.Configuracoes
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.EmpresaId == empresaId, cancellationToken);
        // Default seguro: controla. Quando false, itens nao baixam nem validam estoque.
        var controlaEstoque = config?.ControlaEstoque ?? true;
        // Modo Fixa: o agente nao pode agendar (walk-in liberado). Enforcement de
        // servidor — ignora DataAgendada vinda do device, mesmo em payload forjado.
        var agendaFixa = config?.ModoAgendaAgente == ModoAgendaAgente.Fixa;

        // Uuids que o device pode marcar como sincronizados: importados agora ou
        // ja presentes no servidor (reenvio). O que nao estiver aqui segue pendente.
        var clientesSincronizados = new List<Guid>();
        var atendimentosSincronizados = new List<Guid>();
        var clienteIdPorUuid = new Dictionary<Guid, long>();

        // Importa clientes novos
        foreach (var clienteRequest in request.Clientes)
        {
            try
            {
                if (clienteRequest.Uuid is { } clienteUuid)
                {
                    var existente = await _dbContext.Clientes
                        .AsNoTracking()
                        .Where(c => c.Uuid == clienteUuid)
                        .Select(c => new { c.Id, c.EmpresaId, c.DeletedAt })
                        .FirstOrDefaultAsync(cancellationToken);

                    if (existente is not null)
                    {
                        if (existente.EmpresaId == empresaId)
                        {
                            clientesSincronizados.Add(clienteUuid);
                            if (existente.DeletedAt is null) clienteIdPorUuid[clienteUuid] = existente.Id;
                        }
                        else
                        {
                            erros.Add($"Cliente '{clienteRequest.Nome}': identificador em conflito.");
                        }
                        continue;
                    }
                }

                var criado = await _clienteService.CreateAsync(empresaId, clienteRequest, cancellationToken);
                clientesImportados++;
                if (clienteRequest.Uuid is { } novoUuid)
                {
                    clientesSincronizados.Add(novoUuid);
                    clienteIdPorUuid[novoUuid] = criado.Id;
                }
            }
            catch (CpfAlreadyExistsException)
            {
                // CPF já existe — última escrita por UpdatedAt prevalece (DEC-06)
                // Por ora ignora silenciosamente, sem contar como erro
                // O uuid do device passa a apontar para o cliente que ja tem o CPF.
                if (clienteRequest.Uuid is { } cpfUuid)
                {
                    clientesSincronizados.Add(cpfUuid);
                    var cpf = new string(clienteRequest.Cpf.Where(char.IsDigit).ToArray());
                    var mesmoCpf = await _clienteRepository.GetByCpfAsync(empresaId, cpf, cancellationToken);
                    if (mesmoCpf is not null) clienteIdPorUuid[cpfUuid] = mesmoCpf.Id;
                }
            }
            catch (Exception ex)
            {
                erros.Add($"Cliente '{clienteRequest.Nome}': {ex.Message}");
            }
        }

        // Importa atendimentos offline. Cada atendimento e tudo-ou-nada: valida
        // cliente, itens e estoque antes de gravar; qualquer falha rejeita o
        // atendimento inteiro, que continua pendente no device para correcao.
        foreach (var atendimentoRequest in request.Atendimentos)
        {
            var rotulo = $"Atendimento '{atendimentoRequest.Uuid}'";
            await using var tx = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                // Verifica se já foi sincronizado pelo Uuid
                var existente = await _dbContext.Atendimentos
                    .AsNoTracking()
                    .Where(a => a.Uuid == atendimentoRequest.Uuid)
                    .Select(a => new { a.EmpresaId })
                    .FirstOrDefaultAsync(cancellationToken);

                if (existente is not null)
                {
                    await tx.RollbackAsync(cancellationToken);
                    if (existente.EmpresaId == empresaId)
                    {
                        atendimentosSincronizados.Add(atendimentoRequest.Uuid);
                    }
                    else
                    {
                        erros.Add($"{rotulo}: identificador em conflito.");
                    }
                    continue;
                }

                var falhas = new List<string>();

                long? clienteId = atendimentoRequest.ClienteId;
                if (atendimentoRequest.ClienteUuid is { } clienteUuidRef)
                {
                    clienteId = clienteIdPorUuid.TryGetValue(clienteUuidRef, out var mapeado)
                        ? mapeado
                        : await _dbContext.Clientes
                            .AsNoTracking()
                            .Where(c => c.Uuid == clienteUuidRef && c.EmpresaId == empresaId && c.DeletedAt == null)
                            .Select(c => (long?)c.Id)
                            .FirstOrDefaultAsync(cancellationToken);
                }

                var cliente = clienteId is { } idCliente
                    ? await _clienteRepository.GetByIdAsync(empresaId, idCliente, false, cancellationToken)
                    : null;
                if (cliente is null)
                {
                    falhas.Add(atendimentoRequest.ClienteUuid is { } u
                        ? $"Cliente {u} nao encontrado."
                        : $"Cliente {atendimentoRequest.ClienteId} nao encontrado.");
                }

                var produtos = new Dictionary<long, Produto>();
                foreach (var itemProduto in atendimentoRequest.ItensProduto)
                {
                    if (itemProduto.Quantidade <= 0)
                    {
                        falhas.Add($"Quantidade invalida para produto {itemProduto.ProdutoId}.");
                        continue;
                    }

                    if (produtos.ContainsKey(itemProduto.ProdutoId)) continue;

                    var produto = await _produtoRepository.GetByIdAsync(empresaId, itemProduto.ProdutoId, true, cancellationToken);
                    if (produto is null)
                    {
                        falhas.Add($"Produto {itemProduto.ProdutoId} nao encontrado.");
                        continue;
                    }

                    produtos[produto.Id] = produto;
                }

                if (controlaEstoque)
                {
                    // Soma por produto: o mesmo produto pode aparecer em mais de um item.
                    var demanda = atendimentoRequest.ItensProduto
                        .Where(i => i.Quantidade > 0 && produtos.ContainsKey(i.ProdutoId))
                        .GroupBy(i => i.ProdutoId)
                        .Select(g => new { Produto = produtos[g.Key], Quantidade = g.Sum(i => i.Quantidade) });

                    foreach (var d in demanda.Where(d => d.Produto.QuantidadeEstoque < d.Quantidade))
                    {
                        falhas.Add($"Estoque insuficiente para produto '{d.Produto.Nome}'.");
                    }
                }

                var servicos = new Dictionary<long, Servico>();
                foreach (var itemServico in atendimentoRequest.ItensServico)
                {
                    if (itemServico.Quantidade <= 0)
                    {
                        falhas.Add($"Quantidade invalida para servico {itemServico.ServicoId}.");
                        continue;
                    }

                    if (servicos.ContainsKey(itemServico.ServicoId)) continue;

                    var servico = await _servicoRepository.GetByIdAsync(empresaId, itemServico.ServicoId, false, cancellationToken);
                    if (servico is null)
                    {
                        falhas.Add($"Servico {itemServico.ServicoId} nao encontrado.");
                        continue;
                    }

                    servicos[servico.Id] = servico;
                }

                if (falhas.Count > 0)
                {
                    await tx.RollbackAsync(cancellationToken);
                    // Descarta alteracoes rastreadas (nenhuma esperada aqui) para nao
                    // vazarem no SaveChanges do proximo atendimento da leva.
                    _dbContext.ChangeTracker.Clear();
                    erros.AddRange(falhas.Select(f => $"{rotulo}: {f}"));
                    continue;
                }

                var agora = DateTime.UtcNow;
                var atendimento = new Atendimento
                {
                    Uuid = atendimentoRequest.Uuid,
                    EmpresaId = empresaId,
                    UsuarioId = usuarioId,
                    ClienteId = cliente!.Id,
                    Status = atendimentoRequest.Status,
                    DataRegistro = atendimentoRequest.DataRegistro,
                    DataAgendada = agendaFixa ? null : atendimentoRequest.DataAgendada,
                    CreatedAt = agora,
                    UpdatedAt = agora
                };

                foreach (var itemProduto in atendimentoRequest.ItensProduto)
                {
                    var produto = produtos[itemProduto.ProdutoId];
                    if (controlaEstoque)
                    {
                        produto.QuantidadeEstoque -= itemProduto.Quantidade;
                        produto.UpdatedAt = agora;
                    }

                    atendimento.ItensProduto.Add(new ItemProduto
                    {
                        Uuid = Guid.NewGuid(),
                        ProdutoId = produto.Id,
                        Quantidade = itemProduto.Quantidade,
                        PrecoUnitario = produto.Preco,
                        Subtotal = itemProduto.Quantidade * produto.Preco,
                        CreatedAt = agora,
                        UpdatedAt = agora
                    });
                }

                foreach (var itemServico in atendimentoRequest.ItensServico)
                {
                    var servico = servicos[itemServico.ServicoId];
                    var empreitada = servico.TipoCobranca == Enums.TipoCobranca.Empreitada;
                    var precoUnitario = empreitada
                        ? servico.ValorEmpreitada ?? 0
                        : servico.ValorHora ?? 0;

                    atendimento.ItensServico.Add(new ItemServico
                    {
                        Uuid = Guid.NewGuid(),
                        ServicoId = servico.Id,
                        Quantidade = itemServico.Quantidade,
                        PrecoUnitario = precoUnitario,
                        Subtotal = empreitada ? precoUnitario : itemServico.Quantidade * precoUnitario,
                        CreatedAt = agora,
                        UpdatedAt = agora
                    });
                }

                atendimento.ValorTotal = atendimento.ItensProduto.Sum(i => i.Subtotal)
                    + atendimento.ItensServico.Sum(i => i.Subtotal);

                await _atendimentoRepository.AddAsync(atendimento, cancellationToken);
                await _dbContext.SaveChangesAsync(cancellationToken);
                await tx.CommitAsync(cancellationToken);
                atendimentosImportados++;
                atendimentosSincronizados.Add(atendimentoRequest.Uuid);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(cancellationToken);
                _dbContext.ChangeTracker.Clear();
                erros.Add($"{rotulo}: {ex.Message}");
            }
        }

        return new SyncDescargaResponse
        {
            AtendimentosImportados = atendimentosImportados,
            ClientesImportados = clientesImportados,
            ClientesSincronizados = clientesSincronizados,
            AtendimentosSincronizados = atendimentosSincronizados,
            ClientesMapeados = clienteIdPorUuid
                .Select(kv => new ClienteMapeadoResponse { Uuid = kv.Key, Id = kv.Value })
                .ToList(),
            Erros = erros,
            SincronizadoEm = DateTime.UtcNow
        };
    }
}