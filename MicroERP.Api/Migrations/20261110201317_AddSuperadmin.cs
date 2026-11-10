using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace MicroERP.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSuperadmin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Ativa",
                table: "Empresas",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "BloqueadaEm",
                table: "Empresas",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MotivoBloqueio",
                table: "Empresas",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AdminsPlataforma",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Nome = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Email = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Senha = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Ativo = table.Column<bool>(type: "boolean", nullable: false),
                    UltimoAcessoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdminsPlataforma", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AuditoriasAdmin",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AdminId = table.Column<long>(type: "bigint", nullable: false),
                    Acao = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    EmpresaId = table.Column<long>(type: "bigint", nullable: true),
                    UsuarioId = table.Column<long>(type: "bigint", nullable: true),
                    Detalhes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Ip = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditoriasAdmin", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AuditoriasAdmin_AdminsPlataforma_AdminId",
                        column: x => x.AdminId,
                        principalTable: "AdminsPlataforma",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AdminsPlataforma_Email",
                table: "AdminsPlataforma",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AuditoriasAdmin_AdminId",
                table: "AuditoriasAdmin",
                column: "AdminId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditoriasAdmin_CreatedAt",
                table: "AuditoriasAdmin",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_AuditoriasAdmin_EmpresaId",
                table: "AuditoriasAdmin",
                column: "EmpresaId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditoriasAdmin");

            migrationBuilder.DropTable(
                name: "AdminsPlataforma");

            migrationBuilder.DropColumn(
                name: "Ativa",
                table: "Empresas");

            migrationBuilder.DropColumn(
                name: "BloqueadaEm",
                table: "Empresas");

            migrationBuilder.DropColumn(
                name: "MotivoBloqueio",
                table: "Empresas");
        }
    }
}
