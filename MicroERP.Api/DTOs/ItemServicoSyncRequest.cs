namespace MicroERP.Api.DTOs;

public sealed class ItemServicoSyncRequest
{
    // Serviço do catálogo (id do servidor) ou criado offline (uuid do device,
    // resolvido no servidor). Informe um dos dois; o uuid tem precedencia.
    public long? ServicoId { get; set; }
    public Guid? ServicoUuid { get; set; }
    public int Quantidade { get; set; }
}
