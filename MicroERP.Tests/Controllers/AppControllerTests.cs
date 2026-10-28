using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using MicroERP.Api.Controllers;
using MicroERP.Api.DTOs;

namespace MicroERP.Tests.Controllers;

public sealed class AppControllerTests
{
    [Fact]
    public void GetVersao_Configurada_DevolveVersaoEUrl()
    {
        var controller = new AppController(Config(" 1.1.0 ", "https://agesto.com.br/app"));

        var data = Versao(controller.GetVersao());

        Assert.Equal("1.1.0", data.VersaoMinimaAndroid);
        Assert.Equal("https://agesto.com.br/app", data.UrlDownload);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void GetVersao_SemConfiguracao_DevolveNulo(string? valor)
    {
        var controller = new AppController(Config(valor, valor));

        var data = Versao(controller.GetVersao());

        Assert.Null(data.VersaoMinimaAndroid);
        Assert.Null(data.UrlDownload);
    }

    private static AppVersaoResponse Versao(ActionResult<ApiResponse> result)
    {
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<ApiResponse>(ok.Value);
        Assert.True(response.Success);
        return Assert.IsType<AppVersaoResponse>(response.Data);
    }

    private static IConfiguration Config(string? versao, string? url) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["App:VersaoMinimaAndroid"] = versao,
                ["App:UrlDownload"] = url
            })
            .Build();
}
