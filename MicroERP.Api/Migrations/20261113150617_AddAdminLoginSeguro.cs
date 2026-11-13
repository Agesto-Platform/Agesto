using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MicroERP.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAdminLoginSeguro : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "BloqueadoAte",
                table: "AdminsPlataforma",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CodigoLoginExpiraEm",
                table: "AdminsPlataforma",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CodigoLoginHash",
                table: "AdminsPlataforma",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CodigoLoginTentativas",
                table: "AdminsPlataforma",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "DesafioLoginHash",
                table: "AdminsPlataforma",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TentativasLoginFalhas",
                table: "AdminsPlataforma",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BloqueadoAte",
                table: "AdminsPlataforma");

            migrationBuilder.DropColumn(
                name: "CodigoLoginExpiraEm",
                table: "AdminsPlataforma");

            migrationBuilder.DropColumn(
                name: "CodigoLoginHash",
                table: "AdminsPlataforma");

            migrationBuilder.DropColumn(
                name: "CodigoLoginTentativas",
                table: "AdminsPlataforma");

            migrationBuilder.DropColumn(
                name: "DesafioLoginHash",
                table: "AdminsPlataforma");

            migrationBuilder.DropColumn(
                name: "TentativasLoginFalhas",
                table: "AdminsPlataforma");
        }
    }
}
