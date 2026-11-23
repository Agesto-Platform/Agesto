namespace MicroERP.Api.DTOs;

public sealed class AppVersaoResponse
{
    // Versão nativa mínima do APK (runtime do expo-updates). Null = não avisa.
    public string? VersaoMinimaAndroid { get; set; }
    public string? UrlDownload { get; set; }
    // Manual de uso no web (KAN-42). Null = o app não mostra o link.
    public string? UrlManual { get; set; }
}
