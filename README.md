# Painel Financeiro DRE

Sistema web completo com Next.js 14 (App Router), TypeScript, TailwindCSS, APIs em Node.js e PostgreSQL (Neon) usando `pg`.

## Stack

- Next.js 14
- TypeScript
- TailwindCSS
- PostgreSQL (Neon)
- Driver `pg`

## Estrutura

- `src/app` - páginas e rotas API
- `src/components` - componentes de UI
- `src/lib` - conexão e schema do banco
- `src/services` - regras de negócio (CSV/chat)
- `src/types` - tipagens

## Variáveis de ambiente

Crie um `.env.local`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
```

## Rodando localmente

```bash
npm install
npm run dev
```

## APIs

- `POST /api/upload-csv` - upload e processamento de CSV para tabela `dre`
- `GET /api/dre` - lista dados da DRE com filtro/ordenação/paginação
- `DELETE /api/dre` - remove todos os dados da DRE
- `GET|POST|PUT|DELETE /api/users` - CRUD de usuários
- `POST /api/chat-financeiro` - pergunta financeira -> SQL -> resultado

## SQL de exemplo

### EBITDA

```sql
SELECT COALESCE(SUM(valor), 0) AS ebitda
FROM dre
WHERE conta ILIKE '%ebitda%'
	AND data = (SELECT MAX(data) FROM dre);
```

### ROE

```sql
WITH base AS (
	SELECT
		SUM(CASE WHEN conta ILIKE '%lucro%liquido%' THEN valor ELSE 0 END) AS lucro_liquido,
		SUM(CASE WHEN conta ILIKE '%patrim%liqu%' THEN valor ELSE 0 END) AS patrimonio_liquido
	FROM dre
	WHERE data = (SELECT MAX(data) FROM dre)
)
SELECT CASE WHEN patrimonio_liquido = 0 THEN NULL
						ELSE (lucro_liquido / patrimonio_liquido) * 100
			 END AS roe
FROM base;
```
