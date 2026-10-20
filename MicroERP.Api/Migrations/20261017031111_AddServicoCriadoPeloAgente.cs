using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MicroERP.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddServicoCriadoPeloAgente : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "CriadoPorUsuarioId",
                table: "Servicos",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Revisado",
                table: "Servicos",
                type: "boolean",
                nullable: false,
                // Serviços existentes foram cadastrados pelo Dono: já revisados.
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "AgenteCadastraServico",
                table: "Configuracoes",
                type: "boolean",
                nullable: false,
                // Ligado por padrão (DEC-36): o Dono desliga em Parametrização.
                defaultValue: true);

            migrationBuilder.CreateIndex(
                name: "IX_Servicos_CriadoPorUsuarioId",
                table: "Servicos",
                column: "CriadoPorUsuarioId");

            migrationBuilder.AddForeignKey(
                name: "FK_Servicos_Usuarios_CriadoPorUsuarioId",
                table: "Servicos",
                column: "CriadoPorUsuarioId",
                principalTable: "Usuarios",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Servicos_Usuarios_CriadoPorUsuarioId",
                table: "Servicos");

            migrationBuilder.DropIndex(
                name: "IX_Servicos_CriadoPorUsuarioId",
                table: "Servicos");

            migrationBuilder.DropColumn(
                name: "CriadoPorUsuarioId",
                table: "Servicos");

            migrationBuilder.DropColumn(
                name: "Revisado",
                table: "Servicos");

            migrationBuilder.DropColumn(
                name: "AgenteCadastraServico",
                table: "Configuracoes");
        }
    }
}
