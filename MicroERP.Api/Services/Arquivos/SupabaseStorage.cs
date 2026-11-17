using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace MicroERP.Api.Services.Arquivos;

// Supabase Storage pela API REST (/storage/v1). O bucket é privado: o arquivo
// só abre por link assinado, que vence em poucos minutos.
public sealed class SupabaseStorage : IArmazenamentoArquivos
{
    private readonly HttpClient _http;
    private readonly ArmazenamentoOptions _options;

    public SupabaseStorage(HttpClient http, IOptions<ArmazenamentoOptions> options)
    {
        _http = http;
        _options = options.Value;
    }

    public bool Habilitado => _options.Habilitado;

    private string Base => $"{_options.SupabaseUrl!.TrimEnd('/')}/storage/v1";

    public async Task EnviarAsync(string caminho, byte[] conteudo, string contentType, CancellationToken cancellationToken)
    {
        using var request = Requisicao(HttpMethod.Post, $"{Base}/object/{_options.BucketSuporte}/{caminho}");
        request.Content = new ByteArrayContent(conteudo);
        request.Content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        request.Headers.TryAddWithoutValidation("x-upsert", "false");
        await EnviarOuFalharAsync(request, cancellationToken);
    }

    public async Task<string?> LinkTemporarioAsync(string caminho, TimeSpan validade, CancellationToken cancellationToken)
    {
        using var request = Requisicao(HttpMethod.Post, $"{Base}/object/sign/{_options.BucketSuporte}/{caminho}");
        request.Content = JsonContent.Create(new { expiresIn = (int)validade.TotalSeconds });
        using var response = await _http.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode) return null;
        var corpo = await response.Content.ReadFromJsonAsync<RespostaAssinatura>(cancellationToken);
        return string.IsNullOrEmpty(corpo?.SignedUrl) ? null : $"{Base}{corpo.SignedUrl}";
    }

    public async Task RemoverAsync(IReadOnlyCollection<string> caminhos, CancellationToken cancellationToken)
    {
        if (caminhos.Count == 0) return;
        using var request = Requisicao(HttpMethod.Delete, $"{Base}/object/{_options.BucketSuporte}");
        request.Content = JsonContent.Create(new { prefixes = caminhos });
        await EnviarOuFalharAsync(request, cancellationToken);
    }

    private HttpRequestMessage Requisicao(HttpMethod metodo, string url)
    {
        var request = new HttpRequestMessage(metodo, url);
        // Chave no cabeçalho, nunca na URL, para não aparecer em logs.
        request.Headers.TryAddWithoutValidation("apikey", _options.ChaveSecreta);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ChaveSecreta);
        return request;
    }

    private async Task EnviarOuFalharAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        using var response = await _http.SendAsync(request, cancellationToken);
        if (response.IsSuccessStatusCode) return;
        var corpo = await response.Content.ReadAsStringAsync(cancellationToken);
        throw new HttpRequestException(
            $"Supabase Storage respondeu {(int)response.StatusCode}: {corpo[..Math.Min(corpo.Length, 300)]}");
    }

    private sealed class RespostaAssinatura
    {
        [JsonPropertyName("signedURL")]
        public string? SignedUrl { get; set; }
    }
}
