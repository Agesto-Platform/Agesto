using MicroERP.Api.Models;
using MicroERP.Api.Services;

namespace MicroERP.Tests.Services;

// Guarda os códigos de acesso do admin "enviados", para os testes lerem (DEC-52).
public sealed class CodigosFalsos : IEnvioCodigoAdmin
{
    public List<(string Email, string Codigo)> Enviados { get; } = [];

    public void Enviar(AdminPlataforma admin, string codigo) => Enviados.Add((admin.Email, codigo));
}
