using MicroERP.Api.Models;

namespace MicroERP.Api.Services;

// Formatação do endereço do cliente para a agenda: o resumo para a tela e o
// completo para abrir a navegação (Google Maps) a partir do app.
public static class Enderecos
{
    public static string? Resumo(Cliente? cliente)
    {
        if (cliente is null) return null;

        var partes = new List<string>();
        var rua = Rua(cliente);
        if (rua is not null) partes.Add(rua);
        var local = !string.IsNullOrWhiteSpace(cliente.Bairro) ? cliente.Bairro : cliente.Cidade;
        if (!string.IsNullOrWhiteSpace(local)) partes.Add(local!);

        return partes.Count > 0 ? string.Join(" — ", partes) : null;
    }

    // Sem rua não há destino útil para a navegação: devolve null em vez de só bairro/cidade.
    public static string? Completo(Cliente? cliente)
    {
        var rua = cliente is null ? null : Rua(cliente);
        if (rua is null) return null;

        var partes = new List<string> { rua };
        foreach (var parte in new[] { cliente!.Bairro, cliente.Cidade, cliente.Cep })
        {
            if (!string.IsNullOrWhiteSpace(parte)) partes.Add(parte.Trim());
        }

        return string.Join(", ", partes);
    }

    private static string? Rua(Cliente cliente)
    {
        if (string.IsNullOrWhiteSpace(cliente.Logradouro)) return null;
        var rua = cliente.Logradouro.Trim();
        if (!string.IsNullOrWhiteSpace(cliente.Numero)) rua += $", {cliente.Numero.Trim()}";
        return rua;
    }
}
