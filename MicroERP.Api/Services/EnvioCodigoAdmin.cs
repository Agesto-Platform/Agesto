using MicroERP.Api.Models;
using MicroERP.Api.Services.Email;

namespace MicroERP.Api.Services;

// Envia o código da verificação em duas etapas do superadmin (DEC-52) pela fila
// de emails (Brevo, DEC-54). Atrás de interface para os testes lerem o código.
public interface IEnvioCodigoAdmin
{
    void Enviar(AdminPlataforma admin, string codigo);
}

public sealed class EnvioCodigoAdmin : IEnvioCodigoAdmin
{
    private readonly IFilaDeEmails _fila;
    private readonly ILogger<EnvioCodigoAdmin> _logger;
    private readonly IHostEnvironment _ambiente;

    public EnvioCodigoAdmin(IFilaDeEmails fila, ILogger<EnvioCodigoAdmin> logger, IHostEnvironment ambiente)
    {
        _fila = fila;
        _logger = logger;
        _ambiente = ambiente;
    }

    public void Enviar(AdminPlataforma admin, string codigo)
    {
        if (!_fila.Enfileirar(EmailsDeSenha.CodigoAdmin(admin.Email, admin.Nome, codigo)))
            _logger.LogWarning("Fila de emails cheia: o código de acesso do admin {AdminId} não foi enviado.", admin.Id);
        // Só na máquina de desenvolvimento, para entrar sem o Brevo. Nunca em produção.
        if (_ambiente.IsDevelopment())
            _logger.LogInformation("Código de acesso do admin (só em desenvolvimento): {Codigo}", codigo);
    }
}
