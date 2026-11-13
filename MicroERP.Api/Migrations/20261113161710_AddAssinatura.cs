using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace MicroERP.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAssinatura : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "BloqueioAutomatico",
                table: "Empresas",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateOnly>(
                name: "BloqueioAutomaticoReferencia",
                table: "Empresas",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LicencasFuncionarios",
                table: "Empresas",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<DateOnly>(
                name: "PagoAte",
                table: "Empresas",
                type: "date",
                nullable: true);

            migrationBuilder.AlterColumn<long>(
                name: "AdminId",
                table: "AuditoriasAdmin",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.CreateTable(
                name: "PagamentosAssinatura",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<long>(type: "bigint", nullable: false),
                    AdminId = table.Column<long>(type: "bigint", nullable: true),
                    Valor = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    PagoEm = table.Column<DateOnly>(type: "date", nullable: false),
                    Forma = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Meses = table.Column<int>(type: "integer", nullable: false),
                    PeriodoInicio = table.Column<DateOnly>(type: "date", nullable: false),
                    PeriodoFim = table.Column<DateOnly>(type: "date", nullable: false),
                    Observacao = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PagamentosAssinatura", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PagamentosAssinatura_Empresas_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PagamentosAssinatura_EmpresaId",
                table: "PagamentosAssinatura",
                column: "EmpresaId");

            // Empresas que já existem não ficam travadas: as licenças cobrem os
            // acessos ativos de hoje (o Dono não conta). O PagoAte fica nulo:
            // "sem cobrança", sem bloqueio automático, até a equipe registrar um pagamento.
            migrationBuilder.Sql("""
                UPDATE "Empresas" e
                SET "LicencasFuncionarios" = GREATEST(1, (
                    SELECT COUNT(*) FROM "Usuarios" u
                    WHERE u."EmpresaId" = e."Id" AND u."DeletedAt" IS NULL AND u."Ativo") - 1);
                """);

            // Mesmo padrão das outras tabelas (DEC-34): RLS e acesso só da API.
            migrationBuilder.Sql("""
                ALTER TABLE public."PagamentosAssinatura" ENABLE ROW LEVEL SECURITY;
                DO $$
                BEGIN
                  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agesto_api') THEN
                    CREATE POLICY agesto_api_all ON public."PagamentosAssinatura"
                      FOR ALL TO agesto_api USING (true) WITH CHECK (true);
                  END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PagamentosAssinatura");

            migrationBuilder.DropColumn(
                name: "BloqueioAutomatico",
                table: "Empresas");

            migrationBuilder.DropColumn(
                name: "BloqueioAutomaticoReferencia",
                table: "Empresas");

            migrationBuilder.DropColumn(
                name: "LicencasFuncionarios",
                table: "Empresas");

            migrationBuilder.DropColumn(
                name: "PagoAte",
                table: "Empresas");

            migrationBuilder.AlterColumn<long>(
                name: "AdminId",
                table: "AuditoriasAdmin",
                type: "bigint",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);
        }
    }
}
