namespace MicroERP.Api.DTOs;

public sealed class SyncDescargaResponse
{
    public int AtendimentosImportados { get; set; }
    public int ClientesImportados { get; set; }
    public int ServicosImportados { get; set; }
    public int ConclusoesImportadas { get; set; }
    // Uuids que o device pode marcar como sincronizados (importados ou ja
    // existentes). Pendencias fora destas listas devem ser mantidas no device.
    public IReadOnlyList<Guid> ClientesSincronizados { get; set; } = [];
    public IReadOnlyList<Guid> AtendimentosSincronizados { get; set; } = [];
    public IReadOnlyList<Guid> ServicosSincronizados { get; set; } = [];
    // Uuids dos atendimentos cuja conclusao foi gravada (ou ja estava gravada).
    public IReadOnlyList<Guid> ConclusoesSincronizadas { get; set; } = [];
    // uuid do device -> id do servidor dos clientes desta leva, para o device
    // religar atendimentos pendentes que referenciam cliente criado offline.
    public IReadOnlyList<ClienteMapeadoResponse> ClientesMapeados { get; set; } = [];
    // Mesmo desenho para serviços criados offline (ou reaproveitados pela descrição).
    public IReadOnlyList<ServicoMapeadoResponse> ServicosMapeados { get; set; } = [];
    public IReadOnlyList<string> Erros { get; set; } = [];
    // Os mesmos motivos de Erros, pelo uuid do que foi recusado (cliente,
    // servico ou atendimento), para o device mostrar em cada pendencia.
    public IReadOnlyList<RecusaDescargaResponse> Recusas { get; set; } = [];
    public DateTime SincronizadoEm { get; set; }
}

public sealed class RecusaDescargaResponse
{
    public Guid Uuid { get; set; }
    public string Motivo { get; set; } = string.Empty;
}

public sealed class ClienteMapeadoResponse
{
    public Guid Uuid { get; set; }
    public long Id { get; set; }
}

public sealed class ServicoMapeadoResponse
{
    public Guid Uuid { get; set; }
    public long Id { get; set; }
}
