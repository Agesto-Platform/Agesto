using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace MicroERP.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTokenRedefinicaoSenha : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TokensRedefinicaoSenha",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UsuarioId = table.Column<long>(type: "bigint", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ExpiraEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UsadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TokensRedefinicaoSenha", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TokensRedefinicaoSenha_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TokensRedefinicaoSenha_TokenHash",
                table: "TokensRedefinicaoSenha",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TokensRedefinicaoSenha_UsuarioId",
                table: "TokensRedefinicaoSenha",
                column: "UsuarioId");

            // Mesmo padrão das demais tabelas (DEC-34, EnableRlsLockdown e
            // deploy/api-role.sql): RLS ligado e acesso só para o role da API. No
            // Postgres local o role não existe e a API conecta como dona da tabela.
            migrationBuilder.Sql("""
                ALTER TABLE public."TokensRedefinicaoSenha" ENABLE ROW LEVEL SECURITY;
                DO $$
                BEGIN
                  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agesto_api') THEN
                    CREATE POLICY agesto_api_all ON public."TokensRedefinicaoSenha"
                      FOR ALL TO agesto_api USING (true) WITH CHECK (true);
                  END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TokensRedefinicaoSenha");
        }
    }
}
