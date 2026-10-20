namespace MicroERP.Api.DTOs;

public sealed class AuthResponse
{
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool DeveTrocarSenha { get; set; }
}
