using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MicroERP.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddConvitesPorEmail : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "EmailConfirmadoEm",
                table: "Usuarios",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AlterColumn<long>(
                name: "UsuarioId",
                table: "TokensRedefinicaoSenha",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.AddColumn<long>(
                name: "AdminId",
                table: "TokensRedefinicaoSenha",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Tipo",
                table: "TokensRedefinicaoSenha",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                // Links que já existirem são do "Esqueci a senha" (DEC-54).
                defaultValue: "Redefinicao");

            migrationBuilder.AddColumn<DateTime>(
                name: "EmailConfirmadoEm",
                table: "AdminsPlataforma",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TokensRedefinicaoSenha_AdminId",
                table: "TokensRedefinicaoSenha",
                column: "AdminId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_TokensRedefinicaoSenha_UmDono",
                table: "TokensRedefinicaoSenha",
                sql: "(\"UsuarioId\" IS NULL) <> (\"AdminId\" IS NULL)");

            migrationBuilder.AddForeignKey(
                name: "FK_TokensRedefinicaoSenha_AdminsPlataforma_AdminId",
                table: "TokensRedefinicaoSenha",
                column: "AdminId",
                principalTable: "AdminsPlataforma",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // Quem já tem acesso hoje entrou com senha própria ou provisória: não
            // aparece como convite pendente (DEC-55).
            migrationBuilder.Sql("""
                UPDATE "Usuarios" SET "EmailConfirmadoEm" = "CreatedAt" WHERE "EmailConfirmadoEm" IS NULL;
                UPDATE "AdminsPlataforma" SET "EmailConfirmadoEm" = "CreatedAt" WHERE "EmailConfirmadoEm" IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TokensRedefinicaoSenha_AdminsPlataforma_AdminId",
                table: "TokensRedefinicaoSenha");

            migrationBuilder.DropIndex(
                name: "IX_TokensRedefinicaoSenha_AdminId",
                table: "TokensRedefinicaoSenha");

            migrationBuilder.DropCheckConstraint(
                name: "CK_TokensRedefinicaoSenha_UmDono",
                table: "TokensRedefinicaoSenha");

            migrationBuilder.DropColumn(
                name: "EmailConfirmadoEm",
                table: "Usuarios");

            migrationBuilder.DropColumn(
                name: "AdminId",
                table: "TokensRedefinicaoSenha");

            migrationBuilder.DropColumn(
                name: "Tipo",
                table: "TokensRedefinicaoSenha");

            migrationBuilder.DropColumn(
                name: "EmailConfirmadoEm",
                table: "AdminsPlataforma");

            migrationBuilder.AlterColumn<long>(
                name: "UsuarioId",
                table: "TokensRedefinicaoSenha",
                type: "bigint",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);
        }
    }
}
