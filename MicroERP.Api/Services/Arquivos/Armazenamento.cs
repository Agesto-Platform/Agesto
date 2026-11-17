namespace MicroERP.Api.Services.Arquivos;

// Bucket privado do Supabase Storage para arquivos enviados pelos usuários
// (anexos dos chamados de suporte, DEC-60). A chave fica só no Render.
public sealed class ArmazenamentoOptions
{
    public const string Secao = "Storage";

    // Ex.: https://<projeto>.supabase.co
    public string? SupabaseUrl { get; set; }
    // Chave secreta do projeto (service_role ou "secret key"). Nunca no Git.
    public string? ChaveSecreta { get; set; }
    public string BucketSuporte { get; set; } = "suporte-anexos";

    public bool Habilitado =>
        !string.IsNullOrWhiteSpace(SupabaseUrl) && !string.IsNullOrWhiteSpace(ChaveSecreta);
}

// Guarda e entrega arquivos privados. Atrás de interface para trocar de provedor
// sem mexer no resto e para os testes.
public interface IArmazenamentoArquivos
{
    // false sem URL e chave configuradas: os anexos ficam desligados.
    bool Habilitado { get; }
    Task EnviarAsync(string caminho, byte[] conteudo, string contentType, CancellationToken cancellationToken);
    // Link temporário para abrir o arquivo (o bucket é privado).
    Task<string?> LinkTemporarioAsync(string caminho, TimeSpan validade, CancellationToken cancellationToken);
    Task RemoverAsync(IReadOnlyCollection<string> caminhos, CancellationToken cancellationToken);
}

// Tipos aceitos nos anexos, reconhecidos pelos primeiros bytes do arquivo (não
// pelo nome nem pelo Content-Type que o navegador manda).
public static class TiposDeArquivo
{
    public sealed record Tipo(string ContentType, string Extensao);

    public static readonly Tipo Png = new("image/png", ".png");
    public static readonly Tipo Jpeg = new("image/jpeg", ".jpg");
    public static readonly Tipo Webp = new("image/webp", ".webp");
    public static readonly Tipo Pdf = new("application/pdf", ".pdf");

    public static Tipo? Detectar(ReadOnlySpan<byte> b)
    {
        if (b.Length >= 8 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47
            && b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A) return Png;
        if (b.Length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) return Jpeg;
        if (b.Length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
            && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return Webp;
        if (b.Length >= 5 && b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F' && b[4] == '-') return Pdf;
        return null;
    }
}
