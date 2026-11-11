using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MicroERP.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBloqueioLoginExclusaoLgpdDuracaoServico : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "BloqueadoAte",
                table: "Usuarios",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Usuarios",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TentativasLoginFalhas",
                table: "Usuarios",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "DuracaoMinutos",
                table: "Servicos",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BloqueadoAte",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "TentativasLoginFalhas",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "DuracaoMinutos",
                table: "Servicos");
        }
    }
}
