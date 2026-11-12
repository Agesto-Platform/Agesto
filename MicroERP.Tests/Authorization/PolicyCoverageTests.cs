using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using MicroERP.Api.Authorization;
using MicroERP.Api.Controllers;

namespace MicroERP.Tests.Authorization;

// Guarda contra regressão: toda action nova nasce exclusiva do Dono, a menos
// que seja liberada de propósito nesta lista. Na área de superadmin, toda
// action exige a policy AdminPlataforma (fora o login e o setup).
public sealed class PolicyCoverageTests
{
    private static readonly HashSet<string> LiberadasParaAgente =
    [
        "AuthController.Register",
        "AuthController.Login",
        // Sem login: "Esqueci a senha" (DEC-54). O serviço só atende Dono.
        "AuthController.EsqueciSenha",
        "AuthController.RedefinirSenha",
        "AuthController.TrocarSenha",
        "AuthController.AceitarTermos",
        "SyncController.Carga",
        "SyncController.Descarga",
        "AtendimentoController.GetAgenda",
        "AtendimentoController.GetHistorico",
        "UsuarioController.Delete",
        "AppController.GetVersao",
    ];

    private static readonly HashSet<string> AdminSemLogin =
    [
        "AdminAuthController.Login",
        "AdminAuthController.Setup",
    ];

    public static TheoryData<string> Actions()
    {
        var data = new TheoryData<string>();
        foreach (var action in TodasAsActions().Where(m => !EhAdmin(m))) data.Add(Nome(action));
        return data;
    }

    public static TheoryData<string> ActionsDeAdmin()
    {
        var data = new TheoryData<string>();
        foreach (var action in TodasAsActions().Where(EhAdmin)) data.Add(Nome(action));
        return data;
    }

    [Theory]
    [MemberData(nameof(Actions))]
    public void Action_ExigeDono_ou_EstaLiberadaExplicitamente(string nome)
    {
        var politicas = Politicas(TodasAsActions().Single(m => Nome(m) == nome)).ToList();

        Assert.True(
            politicas.Contains(Policies.Dono) || LiberadasParaAgente.Contains(nome),
            $"{nome} não exige a policy Dono. Se o Agente precisa dela, libere em LiberadasParaAgente.");
        Assert.DoesNotContain(Policies.AdminPlataforma, politicas);
    }

    [Theory]
    [MemberData(nameof(ActionsDeAdmin))]
    public void ActionDeAdmin_ExigeAdminPlataforma(string nome)
    {
        var action = TodasAsActions().Single(m => Nome(m) == nome);
        var politicas = Politicas(action).ToList();

        Assert.DoesNotContain(Policies.Dono, politicas);
        if (AdminSemLogin.Contains(nome))
        {
            Assert.Empty(politicas);
            return;
        }
        Assert.True(politicas.Contains(Policies.AdminPlataforma), $"{nome} não exige a policy AdminPlataforma.");
        Assert.Empty(action.GetCustomAttributes<AllowAnonymousAttribute>());
    }

    [Fact]
    public void ListasDeLiberadas_SoContemActionsExistentes()
    {
        var existentes = TodasAsActions().Select(Nome).ToHashSet();
        Assert.Empty(LiberadasParaAgente.Except(existentes));
        Assert.Empty(AdminSemLogin.Except(existentes));
    }

    private static IEnumerable<string?> Politicas(MethodInfo action) =>
        action.GetCustomAttributes<AuthorizeAttribute>()
            .Concat(action.DeclaringType!.GetCustomAttributes<AuthorizeAttribute>())
            .Select(a => a.Policy);

    private static bool EhAdmin(MethodInfo m) => typeof(AdminControllerBase).IsAssignableFrom(m.DeclaringType);

    private static IEnumerable<MethodInfo> TodasAsActions() =>
        typeof(ApiControllerBase).Assembly.GetTypes()
            .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract)
            .SelectMany(t => t.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly))
            .Where(m => m.GetCustomAttributes<HttpMethodAttribute>().Any());

    private static string Nome(MethodInfo m) => $"{m.DeclaringType!.Name}.{m.Name}";
}
