import { NextResponse } from "next/server";

import { requireSession } from "@/lib/authGuards";
import { dbQuery } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

export async function GET(request: Request) {
  try {
    if (!requireSession()) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    await ensureSchema();

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const yearFrom = searchParams.get("yearFrom");
    const yearTo = searchParams.get("yearTo");

    if (!month || isNaN(Number(month))) {
      return NextResponse.json({ error: "Mês inválido." }, { status: 400 });
    }

    const monthNumber = Number(month);
    const yearFromNumber = yearFrom ? Number(yearFrom) : 2020;
    const yearToNumber = yearTo ? Number(yearTo) : 2025;

    console.log('Parametros:', { monthNumber, yearFromNumber, yearToNumber });

    // Constantes de match (mesmas do chatFinanceiro)
    const EBITDA_LUCRO_MATCH = `LOWER(BTRIM(COALESCE(id1, ''))) = LOWER('(=) Lucro Operacional')`;
    const EBITDA_DEPRECIACAO_MATCH = `LOWER(BTRIM(COALESCE(id1, ''))) LIKE '(-) deprecia%'`;
    const ROE_LUCRO_MATCH = `(LOWER(BTRIM(COALESCE(id1, ''))) = LOWER('(=) Lucro Líquido') OR LOWER(BTRIM(COALESCE(id1, ''))) = LOWER('(=) Lucro Liquido'))`;
    const ROE_PATRIMONIO_MATCH = `(LOWER(BTRIM(COALESCE(id1, ''))) LIKE 'patrimonio liquido%' OR LOWER(BTRIM(COALESCE(id1, ''))) LIKE 'patrimônio líquido%')`;

    // Buscar EBITDA histórico (usando lógica do chatFinanceiro)
    const ebitdaQuery = `
      WITH anos_range AS (
        SELECT generate_series($2::int, $3::int) AS ano
      ),
      dados_por_ano AS (
        SELECT
          ar.ano,
          (
            SELECT MIN(d.data)
            FROM dre d
            WHERE EXTRACT(YEAR FROM d.data)::int = ar.ano
              AND (
                EXTRACT(MONTH FROM d.data)::int = $1
                OR (EXTRACT(MONTH FROM d.data)::int = 1 AND EXTRACT(DAY FROM d.data)::int = $1)
              )
              AND ${EBITDA_LUCRO_MATCH}
          ) AS data_lucro,
          (
            SELECT MIN(d.data)
            FROM dre d
            WHERE EXTRACT(YEAR FROM d.data)::int = ar.ano
              AND (
                EXTRACT(MONTH FROM d.data)::int = $1
                OR (EXTRACT(MONTH FROM d.data)::int = 1 AND EXTRACT(DAY FROM d.data)::int = $1)
              )
              AND ${EBITDA_DEPRECIACAO_MATCH}
          ) AS data_deprec
        FROM anos_range ar
      ),
      valores_ebitda AS (
        SELECT
          dpa.ano,
          COALESCE(
            (
              SELECT AVG(d.valor)
              FROM dre d
              WHERE d.data = dpa.data_lucro
                AND ${EBITDA_LUCRO_MATCH}
            ), 0
          ) AS lucro_operacional,
          COALESCE(
            (
              SELECT AVG(ABS(d.valor))
              FROM dre d
              WHERE d.data = dpa.data_deprec
                AND ${EBITDA_DEPRECIACAO_MATCH}
            ), 0
          ) AS depreciacao
        FROM dados_por_ano dpa
        WHERE dpa.data_lucro IS NOT NULL OR dpa.data_deprec IS NOT NULL
      )
      SELECT
        ano,
        (lucro_operacional + depreciacao)::float AS ebitda
      FROM valores_ebitda
      WHERE (lucro_operacional + depreciacao) != 0
      ORDER BY ano;
    `;

    console.log('Executando query EBITDA...');
    const ebitdaResult = await dbQuery<{ ano: number; ebitda: number }>(ebitdaQuery, [monthNumber, yearFromNumber, yearToNumber]);
    console.log('Resultado EBITDA:', ebitdaResult.rows);

    // Buscar ROE histórico (usando lógica do chatFinanceiro)
    const roeQuery = `
      WITH anos_range AS (
        SELECT generate_series($2::int, $3::int) AS ano
      ),
      dados_por_ano AS (
        SELECT
          ar.ano,
          (
            SELECT MIN(d.data)
            FROM dre d
            WHERE EXTRACT(YEAR FROM d.data)::int = ar.ano
              AND (
                EXTRACT(MONTH FROM d.data)::int = $1
                OR (EXTRACT(MONTH FROM d.data)::int = 1 AND EXTRACT(DAY FROM d.data)::int = $1)
              )
              AND ${ROE_LUCRO_MATCH}
          ) AS data_lucro,
          (
            SELECT MIN(d.data)
            FROM dre d
            WHERE EXTRACT(YEAR FROM d.data)::int = ar.ano
              AND (
                EXTRACT(MONTH FROM d.data)::int = $1
                OR (EXTRACT(MONTH FROM d.data)::int = 1 AND EXTRACT(DAY FROM d.data)::int = $1)
              )
              AND ${ROE_PATRIMONIO_MATCH}
          ) AS data_patrimonio
        FROM anos_range ar
      ),
      valores_roe AS (
        SELECT
          dpa.ano,
          COALESCE(
            (
              SELECT AVG(d.valor)
              FROM dre d
              WHERE d.data = dpa.data_lucro
                AND ${ROE_LUCRO_MATCH}
            ), 0
          ) AS lucro_liquido,
          COALESCE(
            (
              SELECT AVG(d.valor)
              FROM dre d
              WHERE d.data = dpa.data_patrimonio
                AND ${ROE_PATRIMONIO_MATCH}
            ), 1
          ) AS patrimonio_liquido
        FROM dados_por_ano dpa
        WHERE dpa.data_lucro IS NOT NULL OR dpa.data_patrimonio IS NOT NULL
      )
      SELECT
        ano,
        CASE 
          WHEN patrimonio_liquido = 0 THEN 0
          ELSE ((lucro_liquido / patrimonio_liquido) * 100)::float
        END AS roe
      FROM valores_roe
      WHERE (lucro_liquido != 0 OR patrimonio_liquido != 1)
      ORDER BY ano;
    `;

    console.log('Executando query ROE...');
    const roeResult = await dbQuery<{ ano: number; roe: number }>(roeQuery, [monthNumber, yearFromNumber, yearToNumber]);
    console.log('Resultado ROE:', roeResult.rows);

    return NextResponse.json({
      ebitda: ebitdaResult.rows,
      roe: roeResult.rows,
    });
  } catch (error) {
    console.error("Erro ao buscar dados dos relatórios:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erro ao buscar dados dos relatórios.",
      },
      { status: 500 }
    );
  }
}
