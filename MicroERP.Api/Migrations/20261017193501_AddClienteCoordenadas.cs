using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MicroERP.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddClienteCoordenadas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "GeocodificadoEm",
                table: "Clientes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Latitude",
                table: "Clientes",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Longitude",
                table: "Clientes",
                type: "double precision",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Clientes_GeocodificadoEm",
                table: "Clientes",
                column: "GeocodificadoEm");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Clientes_GeocodificadoEm",
                table: "Clientes");

            migrationBuilder.DropColumn(
                name: "GeocodificadoEm",
                table: "Clientes");

            migrationBuilder.DropColumn(
                name: "Latitude",
                table: "Clientes");

            migrationBuilder.DropColumn(
                name: "Longitude",
                table: "Clientes");
        }
    }
}
