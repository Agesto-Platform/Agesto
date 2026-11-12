using System.ComponentModel.DataAnnotations;
using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

// PAG-01: filtros das listas paginadas do web.
public sealed class ClienteFiltroQuery
{
    // Nome, endereço ou cidade (sem acento); 3 dígitos ou mais também buscam no telefone.
    [MaxLength(100, ErrorMessage = "Busca deve ter no máximo 100 caracteres.")]
    public string? Busca { get; set; }
}

public sealed class AtendimentoFiltroQuery
{
    // Nome do cliente ou descrição de um serviço/produto do atendimento (sem acento).
    [MaxLength(100, ErrorMessage = "Busca deve ter no máximo 100 caracteres.")]
    public string? Busca { get; set; }

    [EnumDataType(typeof(StatusAtendimento), ErrorMessage = "Status inválido.")]
    public StatusAtendimento? Status { get; set; }

    [Range(1, long.MaxValue, ErrorMessage = "Cliente inválido.")]
    public long? ClienteId { get; set; }

    public const string OrdemRegistro = "registro";
    public const string OrdemAgendada = "agendada";

    // "registro": mais recentes pela data de registro (Dashboard). Ausente ou "agendada":
    // a ordem da tela (agendada, senão registro). Outro valor = 400.
    [RegularExpression("^(registro|agendada)$", ErrorMessage = "Ordem inválida. Use registro ou agendada.")]
    public string? Ordem { get; set; }
}

public sealed class ProdutoFiltroQuery : IValidatableObject
{
    public const int MaximoIds = 100;

    // Nome do produto (sem acento).
    [MaxLength(100, ErrorMessage = "Busca deve ter no máximo 100 caracteres.")]
    public string? Busca { get; set; }

    // ?ids=3,8,15: só esses produtos (filtro "Atenção" dos alertas de estoque), até 100.
    [MaxLength(2000, ErrorMessage = "Lista de ids muito longa.")]
    public string? Ids { get; set; }

    // Ids já convertidos; nulo sem o filtro ou com a lista inválida (que a validação barra).
    public IReadOnlyList<long>? LerIds() => TentarLerIds(out var ids) ? ids : null;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (!TentarLerIds(out var ids) || ids?.Count > MaximoIds)
            yield return new ValidationResult(
                $"Ids deve ser uma lista de até {MaximoIds} números separados por vírgula.", [nameof(Ids)]);
    }

    private bool TentarLerIds(out IReadOnlyList<long>? ids)
    {
        ids = null;
        if (string.IsNullOrWhiteSpace(Ids)) return true;

        var lista = new List<long>();
        foreach (var parte in Ids.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
        {
            if (!long.TryParse(parte, out var id) || id <= 0) return false;
            lista.Add(id);
        }
        if (lista.Count == 0) return false;
        ids = lista.Distinct().ToList();
        return true;
    }
}

public sealed class ServicoFiltroQuery
{
    // Descrição do serviço (sem acento).
    [MaxLength(100, ErrorMessage = "Busca deve ter no máximo 100 caracteres.")]
    public string? Busca { get; set; }

    // false = só os criados pelo agente aguardando revisão do Dono (o total vira o contador).
    public bool? Revisado { get; set; }
}

public sealed class OrcamentoFiltroQuery
{
    // Nome do cliente (sem acento).
    [MaxLength(100, ErrorMessage = "Busca deve ter no máximo 100 caracteres.")]
    public string? Busca { get; set; }

    [EnumDataType(typeof(StatusOrcamento), ErrorMessage = "Status inválido.")]
    public StatusOrcamento? Status { get; set; }
}

// Abas da tela de Atendimentos.
public sealed class AtendimentoContagemResponse
{
    public int Todos { get; set; }
    public int Pendente { get; set; }
    public int Concluido { get; set; }
    public int Cancelado { get; set; }
}
