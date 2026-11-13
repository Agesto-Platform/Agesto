using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace MicroERP.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUsoIa : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UsosIa",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<long>(type: "bigint", nullable: false),
                    Dia = table.Column<DateOnly>(type: "date", nullable: false),
                    Perguntas = table.Column<int>(type: "integer", nullable: false),
                    Relatorios = table.Column<int>(type: "integer", nullable: false),
                    TokensEntrada = table.Column<long>(type: "bigint", nullable: false),
                    TokensSaida = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UsosIa", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UsosIa_Empresas_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UsosIa_EmpresaId_Dia",
                table: "UsosIa",
                columns: new[] { "EmpresaId", "Dia" },
                unique: true);

            // Mesmo padrão das outras tabelas (DEC-34): RLS ligado e acesso só da
            // API pelo role agesto_api. Num Postgres local o role não existe.
            migrationBuilder.Sql("""
                ALTER TABLE public."UsosIa" ENABLE ROW LEVEL SECURITY;
                DO $$
                BEGIN
                  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agesto_api') THEN
                    CREATE POLICY agesto_api_all ON public."UsosIa"
                      FOR ALL TO agesto_api USING (true) WITH CHECK (true);
                  END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UsosIa");
        }
    }
}
