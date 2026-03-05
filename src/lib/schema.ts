import { dbQuery } from "@/lib/db";

let initialized = false;

export async function ensureSchema() {
  if (initialized) return;

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      perfil TEXT NOT NULL CHECK (perfil IN ('Admin', 'User')),
      status TEXT NOT NULL CHECK (status IN ('Ativo', 'Inativo')),
      dashboard_link TEXT NOT NULL DEFAULT ''
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS dre (
      conta TEXT,
      id1 TEXT,
      id2 TEXT,
      id3 TEXT,
      data DATE,
      valor NUMERIC(18,2)
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS balancete (
      conta TEXT,
      id1 TEXT,
      id2 TEXT,
      id3 TEXT,
      data DATE,
      valor NUMERIC(18,2)
    );
  `);

  await dbQuery("ALTER TABLE dre ALTER COLUMN conta DROP NOT NULL;");
  await dbQuery("ALTER TABLE dre ALTER COLUMN data DROP NOT NULL;");
  await dbQuery("ALTER TABLE dre ALTER COLUMN valor DROP NOT NULL;");
  await dbQuery("ALTER TABLE balancete ALTER COLUMN conta DROP NOT NULL;");
  await dbQuery("ALTER TABLE balancete ALTER COLUMN data DROP NOT NULL;");
  await dbQuery("ALTER TABLE balancete ALTER COLUMN valor DROP NOT NULL;");

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS dashboards (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      nome TEXT NOT NULL,
      link TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS upload_jobs (
      job_id TEXT PRIMARY KEY,
      target_base TEXT NOT NULL,
      status TEXT NOT NULL,
      total_rows INTEGER NOT NULL DEFAULT 0,
      inserted_rows INTEGER NOT NULL DEFAULT 0,
      deleted_rows INTEGER NOT NULL DEFAULT 0,
      message TEXT,
      error TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await dbQuery("CREATE INDEX IF NOT EXISTS idx_dre_data ON dre(data);");
  await dbQuery("CREATE INDEX IF NOT EXISTS idx_dre_conta ON dre(conta);");
  await dbQuery("CREATE INDEX IF NOT EXISTS idx_balancete_data ON balancete(data);");
  await dbQuery("CREATE INDEX IF NOT EXISTS idx_balancete_conta ON balancete(conta);");
  await dbQuery("CREATE INDEX IF NOT EXISTS idx_dashboards_usuario_id ON dashboards(usuario_id);");
  await dbQuery("CREATE INDEX IF NOT EXISTS idx_upload_jobs_created_at ON upload_jobs(created_at DESC);");

  await dbQuery(`
    INSERT INTO dashboards (usuario_id, nome, link)
    SELECT u.id, 'Dashboard Principal', u.dashboard_link
    FROM usuarios u
    WHERE COALESCE(TRIM(u.dashboard_link), '') <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM dashboards d
        WHERE d.usuario_id = u.id
          AND d.link = u.dashboard_link
      );
  `);

  initialized = true;
}
