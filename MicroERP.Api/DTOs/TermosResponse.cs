namespace MicroERP.Api.DTOs;

public sealed class TermosResponse
{
    public string Versao { get; set; } = string.Empty;
    public string? UrlTermos { get; set; }
    public string? UrlPrivacidade { get; set; }
}
