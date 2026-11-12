namespace MicroERP.Api.Enums;

// Link por email para criar a senha (DEC-55).
public enum TipoTokenSenha
{
    // "Esqueci a senha", pedido pela própria pessoa: vale 15 minutos.
    Redefinicao,
    // Enviado pela equipe do Agesto (acesso novo ou "enviar link de senha"): vale 72 horas.
    Convite
}
