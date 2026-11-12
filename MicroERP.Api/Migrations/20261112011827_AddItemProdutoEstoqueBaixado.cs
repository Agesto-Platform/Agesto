using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MicroERP.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddItemProdutoEstoqueBaixado : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "EstoqueBaixado",
                table: "ItemProdutos",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // Escrito à mão (como AnonymizeDeletedClientes): marca os itens que já
            // existem como os baixou a regra antiga — item de catálogo, não excluído,
            // de empresa que controla estoque (sem configuração = controla). Sem isso,
            // excluir um item antigo deixaria de devolver o estoque. Cancelados também
            // ficam marcados: na regra antiga o cancelamento não devolvia nada.
            migrationBuilder.Sql("""
                UPDATE "ItemProdutos" ip
                SET "EstoqueBaixado" = TRUE
                FROM "Atendimentos" a
                WHERE ip."AtendimentoId" = a."Id"
                  AND ip."ProdutoId" IS NOT NULL
                  AND ip."DeletedAt" IS NULL
                  AND COALESCE((SELECT c."ControlaEstoque" FROM "Configuracoes" c WHERE c."EmpresaId" = a."EmpresaId" LIMIT 1), TRUE);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EstoqueBaixado",
                table: "ItemProdutos");
        }
    }
}
