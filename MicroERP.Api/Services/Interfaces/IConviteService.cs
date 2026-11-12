using MicroERP.Api.Models;

namespace MicroERP.Api.Services.Interfaces;

// Convites por email (DEC-55): Dono e equipe do Agesto criam acessos; a pessoa
// cria a senha pelo link.
public interface IConviteService
{
    // false sem o Brevo configurado: o convite é registrado, mas o email não sai.
    bool EnvioHabilitado { get; }

    // Link de 72 horas para o usuário criar a senha. Convite pendente recebe o
    // email de boas-vindas (com o nome da empresa); quem já tem acesso recebe o de senha nova.
    Task EnviarParaUsuarioAsync(Usuario usuario, CancellationToken cancellationToken);

    Task EnviarParaAdminAsync(AdminPlataforma admin, CancellationToken cancellationToken);
}
