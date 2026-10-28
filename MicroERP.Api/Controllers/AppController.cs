using Microsoft.AspNetCore.Mvc;
using MicroERP.Api.DTOs;

namespace MicroERP.Api.Controllers;

// Sem loja (DEC-47), o app pergunta aqui se o APK instalado ficou velho e avisa
// o agente. Configurado no Render por App__VersaoMinimaAndroid e App__UrlDownload;
// sem a versão configurada, o app não avisa nada. Rota pública e sem banco.
[ApiController]
[Route("api/[controller]")]
public sealed class AppController : ApiControllerBase
{
    private readonly IConfiguration _configuration;

    public AppController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    [HttpGet("versao")]
    public ActionResult<ApiResponse> GetVersao()
    {
        return Ok(new ApiResponse
        {
            Success = true,
            Message = "Versão do app.",
            Data = new AppVersaoResponse
            {
                VersaoMinimaAndroid = Valor("App:VersaoMinimaAndroid"),
                UrlDownload = Valor("App:UrlDownload")
            }
        });
    }

    private string? Valor(string chave)
    {
        var valor = _configuration[chave];
        return string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();
    }
}
