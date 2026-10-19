namespace MicroERP.Api.Services.Geocodificacao;

// Seção "Geocoding" da configuração. No Render: Geocoding__OpenRouteServiceApiKey.
public sealed class GeocodificacaoOptions
{
    public const string Secao = "Geocoding";

    public string? OpenRouteServiceApiKey { get; set; }
    public string OpenRouteServiceUrl { get; set; } = "https://api.openrouteservice.org";
}
