namespace MicroERP.Api.Models;

public class Cliente
{
    public long Id { get; set; }
    public Guid Uuid { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string? Telefone { get; set; }
    public string Cpf { get; set; } = string.Empty;
    public string? Logradouro { get; set; }
    public string? Numero { get; set; }
    public string? Bairro { get; set; }
    public string? Cidade { get; set; }
    public string? Cep { get; set; }

    // Coordenadas para o mapa e a rota (DEC-38), preenchidas em segundo plano a
    // partir do endereço. GeocodificadoEm null = pendente; preenchido com
    // coordenadas nulas = endereço não encontrado (não tenta de novo até mudar).
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public DateTime? GeocodificadoEm { get; set; }
    public long EmpresaId { get; set; }
    public Empresa? Empresa { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SyncedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
}
