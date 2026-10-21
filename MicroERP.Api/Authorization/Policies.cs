namespace MicroERP.Api.Authorization;

public static class Policies
{
    // Exige a claim "perfil" = Dono no token.
    public const string Dono = "Dono";
}

public static class RateLimits
{
    public const string Login = "login";
    public const string Register = "register";
    public const string Sync = "sync";
}
