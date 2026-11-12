using MicroERP.Api.DTOs;

namespace MicroERP.Api.Services.Interfaces;

public interface IRedefinicaoSenhaService
{
    // Se o email for de um Dono ativo, gera o token e enfileira o email. Para
    // qualquer outro email não faz nada, e quem chama responde igual.
    Task SolicitarAsync(EsqueciSenhaRequest request, CancellationToken cancellationToken);

    // Troca a senha com o token do email (uso único, 15 minutos).
    Task RedefinirAsync(RedefinirSenhaRequest request, CancellationToken cancellationToken);
}
