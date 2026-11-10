namespace MicroERP.Api.Authorization;

public static class Policies
{
    // Exige a claim "perfil" = Dono no token.
    public const string Dono = "Dono";

    // Equipe do Agesto na área de superadmin. Só aceita tokens do esquema
    // AdminAuth.Esquema (outra audiência), nunca o token de um cliente.
    public const string AdminPlataforma = "AdminPlataforma";
}

public static class RateLimits
{
    public const string Login = "login";
    public const string Register = "register";
    public const string Sync = "sync";
    public const string Insights = "insights";
    public const string Agente = "agente";
}

// Autenticação da área de superadmin: esquema JWT próprio, com audiência
// diferente da dos clientes. Um token não serve no lugar do outro.
public static class AdminAuth
{
    public const string Esquema = "AdminPlataforma";
    public const string ClaimEscopo = "escopo";
    public const string EscopoPlataforma = "plataforma";

    public static string Audiencia(string audienciaClientes) => $"{audienciaClientes}.Admin";
}
