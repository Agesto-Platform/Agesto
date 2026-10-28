namespace MicroERP.Api.DTOs;

public sealed class AuthResponse
{
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool DeveTrocarSenha { get; set; }
    public bool DeveAceitarTermos { get; set; }
    // Preenchido quando DeveAceitarTermos: versão a aceitar e onde ler os textos.
    public TermosResponse? Termos { get; set; }
}
