using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MicroERP.Api.Migrations
{
    /// <inheritdoc />
    public partial class EnableRlsLockdown : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Segunda camada além da Data API desligada no Supabase: RLS ligado sem
            // policies nega tudo a anon/authenticated. A API conecta como dona das
            // tabelas (sem FORCE), então não é afetada. Os roles só existem no
            // Supabase; no Postgres local o REVOKE é pulado.
            migrationBuilder.Sql("""
                DO $$
                DECLARE t text;
                BEGIN
                  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
                    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
                  END LOOP;
                  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
                    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
                    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
                    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
                    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
                  END IF;
                END $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Os privilégios revogados não são devolvidos: reabrir o acesso
            // público às tabelas nunca deve ser automático.
            migrationBuilder.Sql("""
                DO $$
                DECLARE t text;
                BEGIN
                  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
                    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
                  END LOOP;
                END $$;
                """);
        }
    }
}
