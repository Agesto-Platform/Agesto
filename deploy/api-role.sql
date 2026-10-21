-- Usuário dedicado da API (DEC-34). Rode no SQL Editor do Supabase como postgres,
-- depois de aplicar as migrations. Troque <SENHA> por uma senha aleatória longa
-- (ex.: openssl rand -base64 32) e guarde-a só no painel do Render.
--
-- A API passa a conectar como agesto_api: só lê e grava dados, sem DDL, sem
-- acesso aos schemas internos do Supabase. Migrations continuam sendo aplicadas
-- como postgres, pelo SQL Editor.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agesto_api') THEN
    CREATE ROLE agesto_api LOGIN PASSWORD '<SENHA>';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO agesto_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO agesto_api;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO agesto_api;
-- Tabelas criadas no futuro por postgres (novas migrations) já nascem liberadas.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO agesto_api;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO agesto_api;

-- agesto_api não é dona das tabelas, então o RLS (migration EnableRlsLockdown)
-- vale para ela: sem policy, não enxergaria nada. Libera tudo só para este role;
-- o isolamento entre empresas continua sendo feito pela API (EmpresaId).
-- Rode este bloco de novo sempre que uma migration criar tabela nova.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname = 'public' AND tablename = t AND policyname = 'agesto_api_all') THEN
      EXECUTE format('CREATE POLICY agesto_api_all ON public.%I FOR ALL TO agesto_api USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END $$;
