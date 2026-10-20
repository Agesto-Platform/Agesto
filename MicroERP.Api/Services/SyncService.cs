using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
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
    private readonly ILogger<SyncService> _logger;

    private static readonly DateTime DataMinima = new(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    public SyncService(
        AppDbContext dbContext,
        IClienteService clienteService,
        IClienteRepository clienteRepository,
        IProdutoRepository produtoRepository,
        IServicoRepository servicoRepository,
        IAtendimentoRepository atendimentoRepository,
        IItemProdutoRepository itemProdutoRepository,
        IItemServicoRepository itemServicoRepository,
        ILogger<SyncService> logger)
    {
        _dbContext = dbContext;
        _clienteService = clienteService;
        _clienteRepository = clienteRepository;
        _produtoRepository = produtoRepository;
        _servicoRepository = servicoRepository;
        _atendimentoRepository = atendimentoRepository;
        _itemProdutoRepository = itemProdutoRepository;
        _itemServicoRepository = itemServicoRepository;
        _logger = logger;
    }

    // restringirDadosSensiveis (Agente): CPF mascarado e sem custo nos orçamentos.
    // O app em campo não precisa desses dados, e um celular perdido não os expõe (LGPD).
    public async Task<SyncCargaResponse> CargaAsync(long empresaId, DateTime? ultimaSincronizacao, CancellationToken cancellationToken, bool restringirDadosSensiveis = false)
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

        if (restringirDadosSensiveis)
        {
            foreach (var cliente in clientes) cliente.Cpf = DadosPessoais.MascararCpf(cliente.Cpf);
        }

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
                        Custo = restringirDadosSensiveis ? null : i.Custo
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
                AgenteCadastraServico = c.AgenteCadastraServico,
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
                ControlaEstoque = true,
                AgenteCadastraServico = true
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

    // porDono: serviço criado pelo Dono no app já nasce revisado e ignora a chave
    // AgenteCadastraServico da Parametrização.
    public async Task<SyncDescargaResponse> DescargaAsync(long empresaId, long usuarioId, SyncDescargaRequest request, CancellationToken cancellationToken, bool porDono = false)
    {
        var erros = new List<string>();
        var clientesImportados = 0;
        var servicosImportados = 0;
        var atendimentosImportados = 0;

        var config = await _dbContext.Configuracoes
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.EmpresaId == empresaId, cancellationToken);
        // Default seguro: controla. Quando false, itens nao baixam nem validam estoque.
        var controlaEstoque = config?.ControlaEstoque ?? true;
        // Modo Fixa: o agente nao pode agendar (walk-in liberado). Enforcement de
        // servidor — ignora DataAgendada vinda do device, mesmo em payload forjado.
        var agendaFixa = config?.ModoAgendaAgente == ModoAgendaAgente.Fixa;
        var podeCadastrarServico = porDono || (config?.AgenteCadastraServico ?? true);

        // Uuids que o device pode marcar como sincronizados: importados agora ou
        // ja presentes no servidor (reenvio). O que nao estiver aqui segue pendente.
        var clientesSincronizados = new List<Guid>();
        var atendimentosSincronizados = new List<Guid>();
        var conclusoesSincronizadas = new List<Guid>();
        var conclusoesImportadas = 0;
        var clienteIdPorUuid = new Dictionary<Guid, long>();
        var servicosSincronizados = new List<Guid>();
        var servicoIdPorUuid = new Dictionary<Guid, long>();

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
            catch (Exception ex) when (ex is ArgumentException or NotFoundException)
            {
                erros.Add($"Cliente '{clienteRequest.Nome}': {ex.Message}");
            }
            catch (Exception ex)
            {
                // Detalhe interno (banco, EF) fica no log; o device recebe só o aviso.
                _logger.LogError(ex, "Falha ao importar cliente {Uuid} na Descarga.", clienteRequest.Uuid);
                erros.Add($"Cliente '{clienteRequest.Nome}': erro interno ao gravar.");
            }
        }

        // Importa servicos criados no app (DEC-36), antes dos atendimentos que os usam.
        foreach (var servicoRequest in request.Servicos)
        {
            var descricao = servicoRequest.Descricao.Trim();
            var rotuloServico = $"Servico '{descricao}'";
            try
            {
                if (servicoRequest.Uuid == Guid.Empty)
                {
                    erros.Add($"{rotuloServico}: identificador invalido.");
                    continue;
                }

                var existente = await _dbContext.Servicos
                    .AsNoTracking()
                    .Where(s => s.Uuid == servicoRequest.Uuid)
                    .Select(s => new { s.Id, s.EmpresaId, s.DeletedAt })
                    .FirstOrDefaultAsync(cancellationToken);

                if (existente is not null)
                {
                    if (existente.EmpresaId == empresaId)
                    {
                        servicosSincronizados.Add(servicoRequest.Uuid);
                        if (existente.DeletedAt is null) servicoIdPorUuid[servicoRequest.Uuid] = existente.Id;
                    }
                    else
                    {
                        erros.Add($"{rotuloServico}: identificador em conflito.");
                    }
                    continue;
                }

                if (!podeCadastrarServico)
                {
                    erros.Add($"{rotuloServico}: o cadastro de servico pelo app esta desligado. Fale com o responsavel pela empresa.");
                    continue;
                }

                var empreitada = servicoRequest.TipoCobranca == TipoCobranca.Empreitada;
                if (empreitada ? servicoRequest.ValorEmpreitada is null : servicoRequest.ValorHora is null)
                {
                    erros.Add($"{rotuloServico}: informe o valor do servico.");
                    continue;
                }

                // Mesma descricao no catalogo: reaproveita em vez de duplicar. Os
                // atendimentos usam o preco do catalogo, como para qualquer servico.
                var mesmaDescricao = await _servicoRepository.GetByDescricaoAsync(empresaId, descricao, cancellationToken);
                if (mesmaDescricao is not null)
                {
                    servicosSincronizados.Add(servicoRequest.Uuid);
                    servicoIdPorUuid[servicoRequest.Uuid] = mesmaDescricao.Id;
                    continue;
                }

                var agoraServico = DateTime.UtcNow;
                var servico = new Servico
                {
                    Uuid = servicoRequest.Uuid,
                    Descricao = descricao,
                    TipoCobranca = servicoRequest.TipoCobranca,
                    ValorHora = empreitada ? null : servicoRequest.ValorHora,
                    ValorEmpreitada = empreitada ? servicoRequest.ValorEmpreitada : null,
                    EmpresaId = empresaId,
                    CriadoPorUsuarioId = usuarioId,
                    Revisado = porDono,
                    CreatedAt = agoraServico,
                    UpdatedAt = agoraServico
                };
                await _servicoRepository.AddAsync(servico, cancellationToken);
                await _dbContext.SaveChangesAsync(cancellationToken);

                servicosImportados++;
                servicosSincronizados.Add(servicoRequest.Uuid);
                servicoIdPorUuid[servicoRequest.Uuid] = servico.Id;
            }
            catch (Exception ex)
            {
                _dbContext.ChangeTracker.Clear();
                _logger.LogError(ex, "Falha ao importar servico {Uuid} na Descarga.", servicoRequest.Uuid);
                erros.Add($"{rotuloServico}: erro interno ao gravar.");
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

                // Datas fora de uma janela plausível distorcem agenda e métricas.
                var limiteFuturo = DateTime.UtcNow.AddDays(1);
                if (atendimentoRequest.DataRegistro < DataMinima || atendimentoRequest.DataRegistro > limiteFuturo)
                    falhas.Add("Data de registro inválida.");
                if (atendimentoRequest.DataAgendada is { } agendada
                    && (agendada < DataMinima || agendada > DateTime.UtcNow.AddYears(2)))
                    falhas.Add("Data agendada inválida.");
                if (!Enum.IsDefined(atendimentoRequest.Status))
                    falhas.Add("Status inválido.");

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
                        ? $"Cliente {u} não encontrado."
                        : $"Cliente {atendimentoRequest.ClienteId} não encontrado.");
                }

                var itens = await ValidarItensAsync(empresaId, atendimentoRequest.ItensProduto, atendimentoRequest.ItensServico, servicoIdPorUuid, controlaEstoque, falhas, cancellationToken);

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

                AdicionarItens(atendimento, atendimentoRequest.ItensProduto, itens, controlaEstoque, agora);

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
                _logger.LogError(ex, "Falha ao importar atendimento {Uuid} na Descarga.", atendimentoRequest.Uuid);
                erros.Add($"{rotulo}: erro interno ao gravar.");
            }
        }

        // Conclui no app atendimentos que ja existem no servidor (agendados pelo Dono
        // ou sincronizados antes): troca o status e acrescenta itens. Tambem e
        // tudo-ou-nada, e o reenvio e reconhecido pelos uuids dos itens.
        foreach (var conclusao in request.Conclusoes)
        {
            var rotulo = $"Atendimento '{conclusao.Uuid}'";
            await using var tx = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                var atendimento = await _dbContext.Atendimentos
                    .Include(a => a.ItensProduto)
                    .Include(a => a.ItensServico)
                    .FirstOrDefaultAsync(a => a.Uuid == conclusao.Uuid && a.EmpresaId == empresaId && a.DeletedAt == null, cancellationToken);

                var falhas = new List<string>();
                if (atendimento is null)
                {
                    falhas.Add("Atendimento nao encontrado. Ele pode ter sido excluido no web.");
                }
                else if (!porDono && atendimento.UsuarioId != usuarioId)
                {
                    falhas.Add("Atendimento de outro responsavel.");
                }

                if (falhas.Count == 0)
                {
                    var uuidsItens = conclusao.ItensProduto.Select(i => i.Uuid)
                        .Concat(conclusao.ItensServico.Select(i => i.Uuid))
                        .ToList();
                    var gravados = atendimento!.ItensProduto.Select(i => i.Uuid)
                        .Concat(atendimento.ItensServico.Select(i => i.Uuid))
                        .ToHashSet();
                    var jaAplicada = uuidsItens.Any(u => u is { } id && gravados.Contains(id))
                        || (uuidsItens.Count == 0 && atendimento.Status == conclusao.Status);
                    if (jaAplicada)
                    {
                        await tx.RollbackAsync(cancellationToken);
                        _dbContext.ChangeTracker.Clear();
                        conclusoesSincronizadas.Add(conclusao.Uuid);
                        continue;
                    }

                    if (atendimento.Status != StatusAtendimento.Pendente)
                        falhas.Add("Este atendimento ja foi finalizado. Descarte esta conclusao no app.");
                    if (!Enum.IsDefined(conclusao.Status))
                        falhas.Add("Status inválido.");
                    if (uuidsItens.Any(u => u is null || u == Guid.Empty))
                        falhas.Add("Item sem identificador.");
                }

                var itens = falhas.Count == 0
                    ? await ValidarItensAsync(empresaId, conclusao.ItensProduto, conclusao.ItensServico, servicoIdPorUuid, controlaEstoque, falhas, cancellationToken)
                    : null;

                if (falhas.Count > 0)
                {
                    await tx.RollbackAsync(cancellationToken);
                    _dbContext.ChangeTracker.Clear();
                    erros.AddRange(falhas.Select(f => $"{rotulo}: {f}"));
                    continue;
                }

                var agora = DateTime.UtcNow;
                AdicionarItens(atendimento!, conclusao.ItensProduto, itens!, controlaEstoque, agora);
                atendimento!.Status = conclusao.Status;
                atendimento.UpdatedAt = agora;
                atendimento.ValorTotal = atendimento.ItensProduto.Where(i => i.DeletedAt == null).Sum(i => i.Subtotal)
                    + atendimento.ItensServico.Where(i => i.DeletedAt == null).Sum(i => i.Subtotal);
                atendimento.CustoTotal = atendimento.ItensProduto.Where(i => i.DeletedAt == null).Sum(i => i.Custo ?? 0m);

                await _dbContext.SaveChangesAsync(cancellationToken);
                await tx.CommitAsync(cancellationToken);
                conclusoesImportadas++;
                conclusoesSincronizadas.Add(conclusao.Uuid);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync(cancellationToken);
                _dbContext.ChangeTracker.Clear();
                _logger.LogError(ex, "Falha ao concluir atendimento {Uuid} na Descarga.", conclusao.Uuid);
                erros.Add($"{rotulo}: erro interno ao gravar.");
            }
        }

        return new SyncDescargaResponse
        {
            AtendimentosImportados = atendimentosImportados,
            ClientesImportados = clientesImportados,
            ServicosImportados = servicosImportados,
            ServicosSincronizados = servicosSincronizados,
            ServicosMapeados = servicoIdPorUuid
                .Select(kv => new ServicoMapeadoResponse { Uuid = kv.Key, Id = kv.Value })
                .ToList(),
            ClientesSincronizados = clientesSincronizados,
            AtendimentosSincronizados = atendimentosSincronizados,
            ConclusoesImportadas = conclusoesImportadas,
            ConclusoesSincronizadas = conclusoesSincronizadas,
            ClientesMapeados = clienteIdPorUuid
                .Select(kv => new ClienteMapeadoResponse { Uuid = kv.Key, Id = kv.Value })
                .ToList(),
            Erros = erros,
            SincronizadoEm = DateTime.UtcNow
        };
    }

    // Itens de um atendimento da Descarga ja conferidos contra o catalogo.
    private sealed record ItensValidados(
        Dictionary<long, Produto> Produtos,
        List<(ItemServicoSyncRequest Request, Servico Servico)> Servicos);

    // Confere itens de produto (catalogo ou avulso) e de servico, e o estoque.
    // Problemas vao para `falhas`; quem chama rejeita o atendimento inteiro.
    private async Task<ItensValidados> ValidarItensAsync(
        long empresaId,
        IReadOnlyList<ItemProdutoSyncRequest> itensProduto,
        IReadOnlyList<ItemServicoSyncRequest> itensServico,
        IReadOnlyDictionary<Guid, long> servicoIdPorUuid,
        bool controlaEstoque,
        List<string> falhas,
        CancellationToken cancellationToken)
    {
        var produtos = new Dictionary<long, Produto>();
        foreach (var itemProduto in itensProduto)
        {
            if (itemProduto.ProdutoId is not { } produtoId)
            {
                // Item avulso: fora do catalogo, sem estoque.
                if (itemProduto.Quantidade <= 0)
                    falhas.Add("Quantidade invalida para item avulso.");
                if (string.IsNullOrWhiteSpace(itemProduto.Descricao))
                    falhas.Add("Item avulso sem descricao.");
                if (itemProduto.PrecoUnitario is null or < 0)
                    falhas.Add("Item avulso sem valor.");
                continue;
            }

            if (itemProduto.Quantidade <= 0)
            {
                falhas.Add($"Quantidade invalida para produto {produtoId}.");
                continue;
            }

            // Valor ajustado no atendimento (DEC-23); nulo usa o preco do catalogo.
            if (itemProduto.PrecoUnitario is < 0)
            {
                falhas.Add($"Valor invalido para produto {produtoId}.");
                continue;
            }

            if (produtos.ContainsKey(produtoId)) continue;

            var produto = await _produtoRepository.GetByIdAsync(empresaId, produtoId, true, cancellationToken);
            if (produto is null)
            {
                falhas.Add($"Produto {produtoId} nao encontrado.");
                continue;
            }

            produtos[produto.Id] = produto;
        }

        if (controlaEstoque)
        {
            // Soma por produto: o mesmo produto pode aparecer em mais de um item.
            var demanda = itensProduto
                .Where(i => i.Quantidade > 0 && i.ProdutoId is { } id && produtos.ContainsKey(id))
                .GroupBy(i => i.ProdutoId!.Value)
                .Select(g => new { Produto = produtos[g.Key], Quantidade = g.Sum(i => i.Quantidade) });

            foreach (var d in demanda.Where(d => d.Produto.QuantidadeEstoque < d.Quantidade))
            {
                falhas.Add($"Estoque insuficiente para produto '{d.Produto.Nome}'.");
            }
        }

        var servicos = new Dictionary<long, Servico>();
        var itensValidos = new List<(ItemServicoSyncRequest, Servico)>();
        foreach (var itemServico in itensServico)
        {
            var referencia = itemServico.ServicoUuid?.ToString() ?? itemServico.ServicoId?.ToString() ?? "sem identificador";
            if (itemServico.Quantidade <= 0)
            {
                falhas.Add($"Quantidade invalida para servico {referencia}.");
                continue;
            }

            if (itemServico.PrecoUnitario is < 0)
            {
                falhas.Add($"Valor invalido para servico {referencia}.");
                continue;
            }

            long? servicoId = itemServico.ServicoId;
            if (itemServico.ServicoUuid is { } servicoUuidRef)
            {
                servicoId = servicoIdPorUuid.TryGetValue(servicoUuidRef, out var mapeado)
                    ? mapeado
                    : await _dbContext.Servicos
                        .AsNoTracking()
                        .Where(s => s.Uuid == servicoUuidRef && s.EmpresaId == empresaId && s.DeletedAt == null)
                        .Select(s => (long?)s.Id)
                        .FirstOrDefaultAsync(cancellationToken);
            }

            if (servicoId is not { } idServico)
            {
                falhas.Add($"Servico {referencia} nao encontrado.");
                continue;
            }

            if (!servicos.TryGetValue(idServico, out var servico))
            {
                servico = await _servicoRepository.GetByIdAsync(empresaId, idServico, false, cancellationToken);
                if (servico is null)
                {
                    falhas.Add($"Servico {referencia} nao encontrado.");
                    continue;
                }
                servicos[servico.Id] = servico;
            }

            itensValidos.Add((itemServico, servico));
        }

        return new ItensValidados(produtos, itensValidos);
    }

    // Grava os itens validados no atendimento e baixa o estoque dos produtos.
    // O valor vem do device quando informado (DEC-23); senao, do catalogo.
    private static void AdicionarItens(
        Atendimento atendimento,
        IReadOnlyList<ItemProdutoSyncRequest> itensProduto,
        ItensValidados itens,
        bool controlaEstoque,
        DateTime agora)
    {
        foreach (var itemProduto in itensProduto)
        {
            if (itemProduto.ProdutoId is not { } produtoId)
            {
                var precoAvulso = itemProduto.PrecoUnitario!.Value;
                atendimento.ItensProduto.Add(new ItemProduto
                {
                    Uuid = itemProduto.Uuid ?? Guid.NewGuid(),
                    Descricao = itemProduto.Descricao!.Trim(),
                    Quantidade = itemProduto.Quantidade,
                    PrecoUnitario = precoAvulso,
                    Subtotal = itemProduto.Quantidade * precoAvulso,
                    CreatedAt = agora,
                    UpdatedAt = agora
                });
                continue;
            }

            var produto = itens.Produtos[produtoId];
            if (controlaEstoque)
            {
                produto.QuantidadeEstoque -= itemProduto.Quantidade;
                produto.UpdatedAt = agora;
            }

            var preco = itemProduto.PrecoUnitario ?? produto.Preco;
            atendimento.ItensProduto.Add(new ItemProduto
            {
                Uuid = itemProduto.Uuid ?? Guid.NewGuid(),
                ProdutoId = produto.Id,
                Quantidade = itemProduto.Quantidade,
                PrecoUnitario = preco,
                Subtotal = itemProduto.Quantidade * preco,
                CreatedAt = agora,
                UpdatedAt = agora
            });
        }

        foreach (var (itemServico, servico) in itens.Servicos)
        {
            // Empreitada nao multiplica por quantidade (DEC-04): o app manda uma linha por unidade.
            var empreitada = servico.TipoCobranca == TipoCobranca.Empreitada;
            var catalogo = empreitada ? servico.ValorEmpreitada ?? 0 : servico.ValorHora ?? 0;
            var preco = itemServico.PrecoUnitario ?? catalogo;

            atendimento.ItensServico.Add(new ItemServico
            {
                Uuid = itemServico.Uuid ?? Guid.NewGuid(),
                ServicoId = servico.Id,
                Quantidade = itemServico.Quantidade,
                PrecoUnitario = preco,
                Subtotal = empreitada ? preco : itemServico.Quantidade * preco,
                CreatedAt = agora,
                UpdatedAt = agora
            });
        }
    }
}
