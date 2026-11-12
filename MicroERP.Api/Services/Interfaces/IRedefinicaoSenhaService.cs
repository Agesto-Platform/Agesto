using MicroERP.Api.DTOs;
using MicroERP.Api.Enums;

namespace MicroERP.Api.Services.Interfaces;

public interface IRedefinicaoSenhaService
{
    // Se o email for de um Dono ou Agente ativo, gera o link (15 minutos) e
    // enfileira o email. Para qualquer outro email não faz nada, e quem chama responde igual.
    Task SolicitarAsync(EsqueciSenhaRequest request, CancellationToken cancellationToken);

    // Cria a senha com o link do email ("esqueci" ou convite). Devolve o perfil,
    // para a tela dizer se a pessoa entra pelo painel ou pelo app.
    Task<PerfilUsuario> RedefinirAsync(RedefinirSenhaRequest request, CancellationToken cancellationToken);

    // Cria a senha de alguém da equipe do Agesto pelo link do convite (DEC-55).
    Task CriarSenhaAdminAsync(AdminCriarSenhaRequest request, CancellationToken cancellationToken);
}
