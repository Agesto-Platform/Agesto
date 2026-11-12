using System.ComponentModel.DataAnnotations;
using MicroERP.Api.Enums;

namespace MicroERP.Api.DTOs;

// PAG-01: filtros das listas paginadas do web. Com qualquer filtro, a lista é paginada.
public sealed class ClienteFiltroQuery
{
    // Nome, endereço ou cidade (sem acento); 3 dígitos ou mais também buscam no telefone.
    [MaxLength(100, ErrorMessage = "Busca deve ter no máximo 100 caracteres.")]
    public string? Busca { get; set; }

    public bool Informado => !string.IsNullOrWhiteSpace(Busca);
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

    public bool Informado => !string.IsNullOrWhiteSpace(Busca) || Status.HasValue || ClienteId.HasValue;
}

// Abas da tela de Atendimentos.
public sealed class AtendimentoContagemResponse
{
    public int Todos { get; set; }
    public int Pendente { get; set; }
    public int Concluido { get; set; }
    public int Cancelado { get; set; }
}
