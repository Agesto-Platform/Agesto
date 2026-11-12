using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MicroERP.Api.Migrations
{
    /// <summary>
    /// Liga o RLS nas tabelas do superadmin, que ficaram de fora do EnableRlsLockdown.
    /// Mesmo padrão das outras tabelas: a API (role agesto_api) tem acesso total pela
    /// policy agesto_api_all; anon e authenticated ficam sem nenhuma linha. Em um
    /// Postgres local o role não existe e a API conecta como dona da tabela.
    /// </summary>
    public partial class EnableRlsSuperadmin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE public."AdminsPlataforma" ENABLE ROW LEVEL SECURITY;
                ALTER TABLE public."AuditoriasAdmin" ENABLE ROW LEVEL SECURITY;
                DO $$
                BEGIN
                  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agesto_api') THEN
                    DROP POLICY IF EXISTS agesto_api_all ON public."AdminsPlataforma";
                    CREATE POLICY agesto_api_all ON public."AdminsPlataforma"
                      FOR ALL TO agesto_api USING (true) WITH CHECK (true);
                    DROP POLICY IF EXISTS agesto_api_all ON public."AuditoriasAdmin";
                    CREATE POLICY agesto_api_all ON public."AuditoriasAdmin"
                      FOR ALL TO agesto_api USING (true) WITH CHECK (true);
                  END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP POLICY IF EXISTS agesto_api_all ON public."AdminsPlataforma";
                DROP POLICY IF EXISTS agesto_api_all ON public."AuditoriasAdmin";
                ALTER TABLE public."AdminsPlataforma" DISABLE ROW LEVEL SECURITY;
                ALTER TABLE public."AuditoriasAdmin" DISABLE ROW LEVEL SECURITY;
                """);
        }
    }
}
