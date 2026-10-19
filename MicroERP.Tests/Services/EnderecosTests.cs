using MicroERP.Api.Models;
using MicroERP.Api.Services;

namespace MicroERP.Tests.Services;

public sealed class EnderecosTests
{
    private static Cliente Cliente(string? rua = "R. das Acácias", string? numero = "120", string? bairro = "Centro", string? cidade = "Uberaba", string? cep = "38010-000") =>
        new() { Nome = "Joana", Cpf = "52998224725", Logradouro = rua, Numero = numero, Bairro = bairro, Cidade = cidade, Cep = cep };

    [Fact]
    public void Resumo_MostraRuaENumeroEBairro()
    {
        Assert.Equal("R. das Acácias, 120 — Centro", Enderecos.Resumo(Cliente()));
    }

    [Fact]
    public void Completo_JuntaTudoParaANavegacao()
    {
        Assert.Equal("R. das Acácias, 120, Centro, Uberaba, 38010-000", Enderecos.Completo(Cliente()));
        Assert.Equal("R. das Acácias, Uberaba", Enderecos.Completo(Cliente(numero: null, bairro: " ", cep: null)));
    }

    [Fact]
    public void Completo_SemRua_NaoHaDestino()
    {
        Assert.Null(Enderecos.Completo(Cliente(rua: null)));
        Assert.Null(Enderecos.Completo(null));
        Assert.Equal("Centro", Enderecos.Resumo(Cliente(rua: null)));
    }
}
