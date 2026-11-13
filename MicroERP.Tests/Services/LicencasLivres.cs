using MicroERP.Api.DTOs;
using MicroERP.Api.Services.Exceptions;
using MicroERP.Api.Services.Interfaces;

namespace MicroERP.Tests.Services;

// Assinatura falsa para os testes de usuário: libera tudo, ou recusa a licença
// quando `esgotada` (DEC-58).
public sealed class LicencasLivres(bool esgotada = false) : IAssinaturaService
{
    public Task GarantirLicencaAsync(long empresaId, CancellationToken cancellationToken) =>
        esgotada ? throw new RegraUsuarioException("Sem licença.") : Task.CompletedTask;

    public Task<AssinaturaResponse> ObterAsync(long empresaId, bool comPagamentos, CancellationToken cancellationToken) =>
        Task.FromResult(new AssinaturaResponse());

    public Task<AssinaturaResponse> RegistrarPagamentoAsync(long adminId, long empresaId, PagamentoAssinaturaRequest request, string? ip, CancellationToken cancellationToken) =>
        throw new NotSupportedException();

    public Task<AssinaturaResponse> AtualizarAsync(long adminId, long empresaId, AssinaturaAtualizarRequest request, string? ip, CancellationToken cancellationToken) =>
        throw new NotSupportedException();

    public Task<int> BloquearAtrasadasAsync(CancellationToken cancellationToken) => Task.FromResult(0);
}
