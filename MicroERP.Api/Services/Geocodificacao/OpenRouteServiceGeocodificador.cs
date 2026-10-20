using System.Text.Json;
using Microsoft.Extensions.Options;

namespace MicroERP.Api.Services.Geocodificacao;

// Geocodificação pelo OpenRouteService (Pelias). Resposta em GeoJSON:
// features[0].geometry.coordinates = [longitude, latitude].
public sealed class OpenRouteServiceGeocodificador : IGeocodificador
{
    private readonly HttpClient _http;
    private readonly GeocodificacaoOptions _options;

    public OpenRouteServiceGeocodificador(HttpClient http, IOptions<GeocodificacaoOptions> options)
    {
        _http = http;
        _options = options.Value;
    }

    public bool Habilitado => !string.IsNullOrWhiteSpace(_options.OpenRouteServiceApiKey);

    public async Task<Coordenadas?> GeocodificarAsync(string endereco, CancellationToken cancellationToken)
    {
        if (!Habilitado) return null;

        var url = $"{_options.OpenRouteServiceUrl.TrimEnd('/')}/geocode/search"
                  + $"?text={Uri.EscapeDataString(endereco)}&boundary.country=BR&size=1";
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        // Chave no cabeçalho, não na URL, para não aparecer em logs de requisição.
        request.Headers.TryAddWithoutValidation("Authorization", _options.OpenRouteServiceApiKey);

        using var response = await _http.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var json = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        return LerPrimeiraCoordenada(json.RootElement);
    }

    public static Coordenadas? LerPrimeiraCoordenada(JsonElement raiz)
    {
        if (!raiz.TryGetProperty("features", out var features) || features.GetArrayLength() == 0) return null;
        var coordenadas = features[0].GetProperty("geometry").GetProperty("coordinates");
        if (coordenadas.GetArrayLength() < 2) return null;

        var longitude = coordenadas[0].GetDouble();
        var latitude = coordenadas[1].GetDouble();
        return double.IsFinite(latitude) && double.IsFinite(longitude)
            ? new Coordenadas(latitude, longitude)
            : null;
    }
}
