using System.ComponentModel.DataAnnotations;
using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;

namespace MicroERP.Tests.DTOs;

// Os testes de controller chamam as actions direto e nao passam pela validacao
// de modelo do ASP.NET. Aqui ela roda de verdade: atributo incompativel com o
// tipo da propriedade (ex.: MaxLength em enum) lanca excecao e vira HTTP 500.
public sealed class RequestValidationTests
{
    public static TheoryData<Type> RequestTypes()
    {
        var data = new TheoryData<Type>();
        foreach (var type in typeof(ApiResponse).Assembly.GetTypes()
                     .Where(t => t.Namespace == typeof(ApiResponse).Namespace
                                 && t.Name.EndsWith("Request")
                                 && t is { IsClass: true, IsAbstract: false }
                                 && t.GetConstructor(Type.EmptyTypes) is not null))
        {
            data.Add(type);
        }
        return data;
    }

    [Theory]
    [MemberData(nameof(RequestTypes))]
    public void Validacao_NaoLancaExcecao(Type requestType)
    {
        var instance = Activator.CreateInstance(requestType)!;

        var ex = Record.Exception(() =>
            Validator.TryValidateObject(instance, new ValidationContext(instance), [], validateAllProperties: true));

        Assert.Null(ex);
    }

    [Fact]
    public void AtendimentoCreateRequest_StatusForaDoEnum_EhInvalido()
    {
        var request = new AtendimentoCreateRequest { ClienteId = 1, Status = (StatusAtendimento)999 };
        var results = new List<ValidationResult>();

        var valido = Validator.TryValidateObject(request, new ValidationContext(request), results, validateAllProperties: true);

        Assert.False(valido);
        Assert.Contains(results, r => r.ErrorMessage == "Status inválido.");
    }
}
