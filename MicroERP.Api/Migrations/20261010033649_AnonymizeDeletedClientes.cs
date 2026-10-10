using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MicroERP.Api.Migrations
{
    /// <inheritdoc />
    public partial class AnonymizeDeletedClientes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Clientes excluídos antes da anonimização na exclusão (LGPD) ainda
            // guardam dados pessoais. Mesmo formato de DadosPessoais.Anonimizar.
            migrationBuilder.Sql("""
                UPDATE "Clientes"
                SET "Nome" = 'Cliente removido',
                    "Cpf" = 'ANON' || "Id",
                    "Telefone" = NULL,
                    "Logradouro" = NULL,
                    "Numero" = NULL,
                    "Bairro" = NULL,
                    "Cidade" = NULL,
                    "Cep" = NULL
                WHERE "DeletedAt" IS NOT NULL AND "Cpf" NOT LIKE 'ANON%';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Irreversível: os dados pessoais foram apagados de propósito.
        }
    }
}
