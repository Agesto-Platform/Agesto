namespace MicroERP.Api.Enums;

// Assunto do chamado que o Dono abre na aba Suporte (DEC-60).
public enum AssuntoTicket
{
    Duvida,
    Bug,
    Melhoria,
    Assinatura,
    Outro,
}

// Andamento do chamado, avançado pela equipe do Agesto no superadmin (DEC-60).
public enum StatusTicket
{
    Aberto,
    EmAndamento,
    Resolvido,
}
