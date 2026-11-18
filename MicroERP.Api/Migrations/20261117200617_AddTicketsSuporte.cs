using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace MicroERP.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTicketsSuporte : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TicketsSuporte",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    EmpresaId = table.Column<long>(type: "bigint", nullable: false),
                    UsuarioId = table.Column<long>(type: "bigint", nullable: false),
                    Assunto = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Mensagem = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ResolvidoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TicketsSuporte", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TicketsSuporte_Empresas_EmpresaId",
                        column: x => x.EmpresaId,
                        principalTable: "Empresas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TicketsSuporte_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AnexosTicketSuporte",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TicketId = table.Column<long>(type: "bigint", nullable: false),
                    NomeArquivo = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Tamanho = table.Column<long>(type: "bigint", nullable: false),
                    Caminho = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AnexosTicketSuporte", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AnexosTicketSuporte_TicketsSuporte_TicketId",
                        column: x => x.TicketId,
                        principalTable: "TicketsSuporte",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RespostasTicketSuporte",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TicketId = table.Column<long>(type: "bigint", nullable: false),
                    AdminId = table.Column<long>(type: "bigint", nullable: true),
                    Mensagem = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RespostasTicketSuporte", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RespostasTicketSuporte_AdminsPlataforma_AdminId",
                        column: x => x.AdminId,
                        principalTable: "AdminsPlataforma",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_RespostasTicketSuporte_TicketsSuporte_TicketId",
                        column: x => x.TicketId,
                        principalTable: "TicketsSuporte",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AnexosTicketSuporte_TicketId",
                table: "AnexosTicketSuporte",
                column: "TicketId");

            migrationBuilder.CreateIndex(
                name: "IX_RespostasTicketSuporte_AdminId",
                table: "RespostasTicketSuporte",
                column: "AdminId");

            migrationBuilder.CreateIndex(
                name: "IX_RespostasTicketSuporte_TicketId",
                table: "RespostasTicketSuporte",
                column: "TicketId");

            migrationBuilder.CreateIndex(
                name: "IX_TicketsSuporte_EmpresaId_CreatedAt",
                table: "TicketsSuporte",
                columns: new[] { "EmpresaId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TicketsSuporte_Status",
                table: "TicketsSuporte",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_TicketsSuporte_UsuarioId",
                table: "TicketsSuporte",
                column: "UsuarioId");

            // Mesmo padrão das outras tabelas (DEC-34): RLS e acesso só da API.
            migrationBuilder.Sql("""
                ALTER TABLE public."TicketsSuporte" ENABLE ROW LEVEL SECURITY;
                ALTER TABLE public."RespostasTicketSuporte" ENABLE ROW LEVEL SECURITY;
                ALTER TABLE public."AnexosTicketSuporte" ENABLE ROW LEVEL SECURITY;
                DO $$
                BEGIN
                  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agesto_api') THEN
                    CREATE POLICY agesto_api_all ON public."TicketsSuporte"
                      FOR ALL TO agesto_api USING (true) WITH CHECK (true);
                    CREATE POLICY agesto_api_all ON public."RespostasTicketSuporte"
                      FOR ALL TO agesto_api USING (true) WITH CHECK (true);
                    CREATE POLICY agesto_api_all ON public."AnexosTicketSuporte"
                      FOR ALL TO agesto_api USING (true) WITH CHECK (true);
                  END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AnexosTicketSuporte");

            migrationBuilder.DropTable(
                name: "RespostasTicketSuporte");

            migrationBuilder.DropTable(
                name: "TicketsSuporte");
        }
    }
}
