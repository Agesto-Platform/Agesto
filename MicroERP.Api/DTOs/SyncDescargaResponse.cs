namespace MicroERP.Api.DTOs;

public sealed class SyncDescargaResponse
{
    public int AtendimentosImportados { get; set; }
    public int ClientesImportados { get; set; }
    // Uuids que o device pode marcar como sincronizados (importados ou ja
    // existentes). Pendencias fora destas listas devem ser mantidas no device.
    public IReadOnlyList<Guid> ClientesSincronizados { get; set; } = [];
    public IReadOnlyList<Guid> AtendimentosSincronizados { get; set; } = [];
    // uuid do device -> id do servidor dos clientes desta leva, para o device
    // religar atendimentos pendentes que referenciam cliente criado offline.
    public IReadOnlyList<ClienteMapeadoResponse> ClientesMapeados { get; set; } = [];
    public IReadOnlyList<string> Erros { get; set; } = [];
    public DateTime SincronizadoEm { get; set; }
}

public sealed class ClienteMapeadoResponse
{
    public Guid Uuid { get; set; }
    public long Id { get; set; }
}
