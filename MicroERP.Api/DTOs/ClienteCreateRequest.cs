using System.ComponentModel.DataAnnotations;

namespace MicroERP.Api.DTOs;

public sealed class ClienteCreateRequest
{
    // Opcional: UUID gerado no device (offline-first). Ausente = gerado no servidor.
    public Guid? Uuid { get; set; }

    [Required(ErrorMessage = "Nome obrigatório.")]
    [MinLength(2, ErrorMessage = "Nome deve ter no mínimo 2 caracteres.")]
    [MaxLength(120, ErrorMessage = "Nome deve ter no máximo 120 caracteres.")]
    public string Nome { get; set; } = string.Empty;

    [MaxLength(20, ErrorMessage = "Telefone deve ter no máximo 20 caracteres.")]
    public string? Telefone { get; set; }

    [Required(ErrorMessage = "CPF obrigatório.")]
    [RegularExpression(@"^(\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$", ErrorMessage = "CPF inválido.")]
    public string Cpf { get; set; } = string.Empty;

    [MaxLength(150, ErrorMessage = "Logradouro deve ter no máximo 150 caracteres.")]
    public string? Logradouro { get; set; }

    [MaxLength(20, ErrorMessage = "Número deve ter no máximo 20 caracteres.")]
    public string? Numero { get; set; }

    [MaxLength(100, ErrorMessage = "Bairro deve ter no máximo 100 caracteres.")]
    public string? Bairro { get; set; }

    [MaxLength(100, ErrorMessage = "Cidade deve ter no máximo 100 caracteres.")]
    public string? Cidade { get; set; }

    [MaxLength(9, ErrorMessage = "CEP deve ter no máximo 9 caracteres.")]
    public string? Cep { get; set; }
}
