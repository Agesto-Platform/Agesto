using System.Globalization;
using System.Text;

namespace MicroERP.Api.Data;

// Busca no servidor (PAG-01): sem acento e sem diferença de maiúsculas, como a busca
// que o web fazia na memória. Usa o translate() nativo do Postgres, sem extensão nem
// migration. Os testes em SQLite registram uma função translate na conexão.
public static class FuncoesSql
{
    // Mapeado para translate(texto, de, para) no AppDbContext. Só roda dentro de consultas.
    public static string Translate(string texto, string de, string para) =>
        throw new NotSupportedException("FuncoesSql.Translate só pode ser usado em consultas do EF.");

    // Letras acentuadas (minúsculas e maiúsculas: o lower() do SQLite só trata ASCII)
    // e o equivalente sem acento, posição a posição.
    public const string ComAcento = "áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ";
    public const string SemAcento = "aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn";

    // translate() apaga o que não tem par em 'para': sobra só o número do telefone.
    public const string PontuacaoTelefone = "()- .+";

    // O termo digitado passa pela mesma normalização da coluna.
    public static string NormalizarTermo(string termo)
    {
        var decomposto = termo.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decomposto.Length);
        foreach (var c in decomposto)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(c);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }

    public static string SoDigitos(string texto) => new(texto.Where(char.IsDigit).ToArray());

    // Para os testes em SQLite: o mesmo comportamento do translate() do Postgres.
    public static string? TranslateEmMemoria(string? texto, string de, string para)
    {
        if (texto is null) return null;
        var sb = new StringBuilder(texto.Length);
        foreach (var c in texto)
        {
            var i = de.IndexOf(c);
            if (i < 0) sb.Append(c);
            else if (i < para.Length) sb.Append(para[i]);
        }
        return sb.ToString();
    }
}
