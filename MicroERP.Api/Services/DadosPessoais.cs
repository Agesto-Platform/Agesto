using MicroERP.Api.Models;

namespace MicroERP.Api.Services;

// Tratamento de dados pessoais de clientes (LGPD): mascaramento para quem não
// precisa do dado completo e anonimização na exclusão.
public static class DadosPessoais
{
    public const string NomeAnonimizado = "Cliente removido";

    // 12345678901 -> ***.456.789-** (mantém os dígitos do meio, como em comprovantes).
    public static string MascararCpf(string cpf)
    {
        var digitos = new string(cpf.Where(char.IsDigit).ToArray());
        return digitos.Length == 11 ? $"***.{digitos[3..6]}.{digitos[6..9]}-**" : "***";
    }

    // A linha fica (atendimentos e métricas apontam para ela), mas sem nada que
    // identifique a pessoa. O CPF vira um marcador único por cliente, o que
    // também libera o CPF real para um novo cadastro.
    public static void Anonimizar(Cliente cliente)
    {
        cliente.Nome = NomeAnonimizado;
        cliente.Cpf = CpfAnonimizado(cliente.Id);
        cliente.Telefone = null;
        cliente.Logradouro = null;
        cliente.Numero = null;
        cliente.Bairro = null;
        cliente.Cidade = null;
        cliente.Cep = null;
    }

    public static string CpfAnonimizado(long clienteId) => $"ANON{clienteId}";
}
