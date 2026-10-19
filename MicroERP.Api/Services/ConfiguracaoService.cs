using MicroERP.Api.DTOs;
using MicroERP.Api.Models;
using MicroERP.Api.Repositories.Interfaces;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Api.Services;

public sealed class ConfiguracaoService : IConfiguracaoService
{
    private readonly IConfiguracaoRepository _configuracaoRepository;

    public ConfiguracaoService(IConfiguracaoRepository configuracaoRepository)
    {
        _configuracaoRepository = configuracaoRepository;
    }

    public async Task<ConfiguracaoResponse?> GetByEmpresaAsync(long empresaId, CancellationToken cancellationToken)
    {
        var configuracao = await _configuracaoRepository.GetByEmpresaAsync(empresaId, false, cancellationToken);
        return configuracao is null ? null : MapResponse(configuracao);
    }

    public async Task<ConfiguracaoResponse?> UpdateAsync(long empresaId, ConfiguracaoUpdateRequest request, CancellationToken cancellationToken)
    {
        var configuracao = await _configuracaoRepository.GetByEmpresaAsync(empresaId, true, cancellationToken);
        if (configuracao is null)
        {
            return null;
        }

        configuracao.TipoOperacao = request.TipoOperacao!.Value;
        if (request.ModoAgendaAgente.HasValue)
        {
            configuracao.ModoAgendaAgente = request.ModoAgendaAgente.Value;
        }
        if (request.ControlaEstoque.HasValue)
        {
            configuracao.ControlaEstoque = request.ControlaEstoque.Value;
        }
        if (request.AgenteCadastraServico.HasValue)
        {
            configuracao.AgenteCadastraServico = request.AgenteCadastraServico.Value;
        }
        configuracao.UpdatedAt = DateTime.UtcNow;

        await _configuracaoRepository.SaveChangesAsync(cancellationToken);

        return MapResponse(configuracao);
    }

    private static ConfiguracaoResponse MapResponse(Configuracao configuracao)
    {
        return new ConfiguracaoResponse
        {
            Id = configuracao.Id,
            TipoOperacao = configuracao.TipoOperacao,
            ModoAgendaAgente = configuracao.ModoAgendaAgente,
            ControlaEstoque = configuracao.ControlaEstoque,
            AgenteCadastraServico = configuracao.AgenteCadastraServico,
            EmpresaId = configuracao.EmpresaId,
            CreatedAt = configuracao.CreatedAt,
            UpdatedAt = configuracao.UpdatedAt
        };
    }
}