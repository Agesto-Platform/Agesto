using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MicroERP.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRecebimentoEDesfazerPagamento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DesfeitoEm",
                table: "PagamentosAssinatura",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "DesfeitoPorAdminId",
                table: "PagamentosAssinatura",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "PagoAteAnterior",
                table: "PagamentosAssinatura",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FormaPagamento",
                table: "Atendimentos",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "PagoEm",
                table: "Atendimentos",
                type: "date",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DesfeitoEm",
                table: "PagamentosAssinatura");

            migrationBuilder.DropColumn(
                name: "DesfeitoPorAdminId",
                table: "PagamentosAssinatura");

            migrationBuilder.DropColumn(
                name: "PagoAteAnterior",
                table: "PagamentosAssinatura");

            migrationBuilder.DropColumn(
                name: "FormaPagamento",
                table: "Atendimentos");

            migrationBuilder.DropColumn(
                name: "PagoEm",
                table: "Atendimentos");
        }
    }
}
