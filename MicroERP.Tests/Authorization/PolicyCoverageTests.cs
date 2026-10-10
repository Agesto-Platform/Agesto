using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using MicroERP.Api.Authorization;
using MicroERP.Api.Controllers;

namespace MicroERP.Tests.Authorization;

// Guarda contra regressão: toda action nova nasce exclusiva do Dono, a menos
// que seja liberada de propósito nesta lista.
public sealed class PolicyCoverageTests
{
    private static readonly HashSet<string> LiberadasParaAgente =
    [
        "AuthController.Register",
        "AuthController.Login",
        "SyncController.Carga",
        "SyncController.Descarga",
        "AtendimentoController.GetAgenda",
        "UsuarioController.Delete",
    ];

    public static TheoryData<string> Actions()
    {
        var data = new TheoryData<string>();
        foreach (var action in TodasAsActions()) data.Add(Nome(action));
        return data;
    }

    [Theory]
    [MemberData(nameof(Actions))]
    public void Action_ExigeDono_ou_EstaLiberadaExplicitamente(string nome)
    {
        var action = TodasAsActions().Single(m => Nome(m) == nome);
        var politicas = action.GetCustomAttributes<AuthorizeAttribute>()
            .Concat(action.DeclaringType!.GetCustomAttributes<AuthorizeAttribute>())
            .Select(a => a.Policy);

        Assert.True(
            politicas.Contains(Policies.Dono) || LiberadasParaAgente.Contains(nome),
            $"{nome} não exige a policy Dono. Se o Agente precisa dela, libere em LiberadasParaAgente.");
    }

    [Fact]
    public void ListaDeLiberadas_SoContemActionsExistentes()
    {
        var existentes = TodasAsActions().Select(Nome).ToHashSet();
        Assert.Empty(LiberadasParaAgente.Except(existentes));
    }

    private static IEnumerable<MethodInfo> TodasAsActions() =>
        typeof(ApiControllerBase).Assembly.GetTypes()
            .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract)
            .SelectMany(t => t.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly))
            .Where(m => m.GetCustomAttributes<HttpMethodAttribute>().Any());

    private static string Nome(MethodInfo m) => $"{m.DeclaringType!.Name}.{m.Name}";
}
