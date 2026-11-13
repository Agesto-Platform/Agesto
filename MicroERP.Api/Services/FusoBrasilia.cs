namespace MicroERP.Api.Services;

// Horário de Brasília para "hoje" do usuário: o servidor roda em UTC.
internal static class FusoBrasilia
{
    public static readonly TimeZoneInfo Info = Resolver();

    /// <summary>00:00 de hoje em Brasília, em UTC.</summary>
    public static DateTime InicioDoDiaUtc(DateTime agoraUtc)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(agoraUtc, Info);
        return TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(local.Date, DateTimeKind.Unspecified), Info);
    }

    private static TimeZoneInfo Resolver()
    {
        foreach (var id in new[] { "America/Sao_Paulo", "E. South America Standard Time" })
        {
            if (TimeZoneInfo.TryFindSystemTimeZoneById(id, out var fuso)) return fuso;
        }
        return TimeZoneInfo.CreateCustomTimeZone("Brasilia", TimeSpan.FromHours(-3), "Brasília", "Brasília");
    }
}
