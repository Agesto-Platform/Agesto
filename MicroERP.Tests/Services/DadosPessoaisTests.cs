using MicroERP.Api.Services;

namespace MicroERP.Tests.Services;

public sealed class DadosPessoaisTests
{
    [Theory]
    [InlineData("12345678901", "***.456.789-**")]
    [InlineData("123.456.789-01", "***.456.789-**")]
    [InlineData("ANON7", "***")]
    [InlineData("", "***")]
    public void MascararCpf(string cpf, string esperado) =>
        Assert.Equal(esperado, DadosPessoais.MascararCpf(cpf));
}
