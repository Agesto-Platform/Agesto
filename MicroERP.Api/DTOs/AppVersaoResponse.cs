namespace MicroERP.Api.DTOs;

public sealed class AppVersaoResponse
{
    // Versão nativa mínima do APK (runtime do expo-updates). Null = não avisa.
    public string? VersaoMinimaAndroid { get; set; }
    public string? UrlDownload { get; set; }
}
