using MicroERP.Api.DTOs;

namespace MicroERP.Api.Services.Interfaces;

// Assinatura e licenças da empresa (DEC-58).
public interface IAssinaturaService
{
    Task<AssinaturaResponse> ObterAsync(long empresaId, bool comPagamentos, CancellationToken cancellationToken);

    /// <summary>
    /// Confere se cabe mais um acesso ativo na empresa (o Dono mais as licenças de
    /// funcionário). Lança RegraUsuarioException quando passa do contratado.
    /// </summary>
    Task GarantirLicencaAsync(long empresaId, CancellationToken cancellationToken);

    Task<AssinaturaResponse> RegistrarPagamentoAsync(long adminId, long empresaId, PagamentoAssinaturaRequest request, string? ip, CancellationToken cancellationToken);

    Task<AssinaturaResponse> AtualizarAsync(long adminId, long empresaId, AssinaturaAtualizarRequest request, string? ip, CancellationToken cancellationToken);

    /// <summary>Bloqueia as empresas com mais de 10 dias de atraso. Devolve quantas bloqueou.</summary>
    Task<int> BloquearAtrasadasAsync(CancellationToken cancellationToken);
}
