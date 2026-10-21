namespace MicroERP.Api.Services.Geocodificacao;

public sealed record Coordenadas(double Latitude, double Longitude);

// Converte endereço em coordenadas. Atrás de interface para trocar de provedor
// (ex.: Google) sem mexer no resto (DEC-38). Recebe só o endereço: nunca nome ou CPF.
public interface IGeocodificador
{
    // false quando não há chave configurada: a geocodificação fica desligada.
    bool Habilitado { get; }

    // null = endereço não encontrado. Falha de rede ou cota lança exceção.
    Task<Coordenadas?> GeocodificarAsync(string endereco, CancellationToken cancellationToken);
}
