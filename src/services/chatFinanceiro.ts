import { dbQuery } from "@/lib/db";
import type { ChatResponse, FinancialIndicator } from "@/types/chat";

const MONTHS_PT: Record<string, string> = {
  jan: "01",
  janeiro: "01",
  fev: "02",
  fevereiro: "02",
  mar: "03",
  marco: "03",
  março: "03",
  abr: "04",
  abril: "04",
  mai: "05",
  maio: "05",
  jun: "06",
  junho: "06",
  jul: "07",
  julho: "07",
  ago: "08",
  agosto: "08",
  set: "09",
  setembro: "09",
  out: "10",
  outubro: "10",
  nov: "11",
  novembro: "11",
  dez: "12",
  dezembro: "12",
};

const MONTH_NAMES_PT: Record<string, string> = {
  "01": "janeiro",
  "02": "fevereiro",
  "03": "março",
  "04": "abril",
  "05": "maio",
  "06": "junho",
  "07": "julho",
  "08": "agosto",
  "09": "setembro",
  "10": "outubro",
  "11": "novembro",
  "12": "dezembro",
};

type PeriodFilter = {
  month: number;
  year: number | null;
  label: string;
};

const EBITDA_LUCRO_OPERACIONAL_MATCH = `
  LOWER(BTRIM(COALESCE(id1, ''))) = LOWER('(=) Lucro Operacional')
`.trim();

const EBITDA_DEPRECIACAO_MATCH = `
  LOWER(BTRIM(COALESCE(id1, ''))) LIKE '(-) deprecia%'
`.trim();

const ROE_LUCRO_MATCH = `
  (
    LOWER(BTRIM(COALESCE(id1, ''))) = LOWER('(=) Lucro Líquido')
    OR LOWER(BTRIM(COALESCE(id1, ''))) = LOWER('(=) Lucro Liquido')
  )
`.trim();

const ROE_PATRIMONIO_MATCH = `
  (
    LOWER(BTRIM(COALESCE(id1, ''))) LIKE 'patrimonio liquido%'
    OR LOWER(BTRIM(COALESCE(id1, ''))) LIKE 'patrimônio líquido%'
  )
`.trim();

function normalizeText(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectIndicator(question: string): FinancialIndicator {
  const q = normalizeText(question);
  if (q.includes("roe")) return "ROE";
  return "EBITDA";
}

function detectPeriodFilter(question: string): PeriodFilter | null {
  const q = normalizeText(question);

  const monthYearByName = q.match(
    /(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)[\s\/-]*(\d{2,4})?/,
  );

  if (monthYearByName) {
    const month = Number(MONTHS_PT[monthYearByName[1]]);
    const rawYear = monthYearByName[2] ?? null;
    const year = rawYear ? Number(rawYear.length === 2 ? `20${rawYear}` : rawYear) : null;
    const label = year ? `${String(month).padStart(2, "0")}/${year}` : String(month).padStart(2, "0");
    return { month, year, label };
  }

  const numericMonthYear = q.match(/\b(\d{1,2})[\/-](\d{2,4})\b/);

  if (numericMonthYear) {
    const month = Number(numericMonthYear[1]);
    const rawYear = numericMonthYear[2];
    const year = Number(rawYear.length === 2 ? `20${rawYear}` : rawYear);
    if (month >= 1 && month <= 12) {
      return { month, year, label: `${String(month).padStart(2, "0")}/${year}` };
    }
  }

  return null;
}

function formatCurrency(value: number | null) {
  return (value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number | null) {
  return `${(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function formatPeriodLabel(periodFilter: PeriodFilter | null): string {
  if (!periodFilter) return "";
  
  const monthStr = String(periodFilter.month).padStart(2, "0");
  const monthName = MONTH_NAMES_PT[monthStr] || monthStr;
  
  if (periodFilter.year) {
    return ` em ${monthName} de ${periodFilter.year}`;
  }
  
  return ` em ${monthName}`;
}

function buildEbitdaQuery(periodFilter: PeriodFilter | null) {
  if (periodFilter?.year) {
    return {
      sql: `
        WITH periodo AS (
          SELECT $1::int AS mes, $2::int AS ano
        ),
        modo_periodo AS (
          SELECT
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM dre d
                CROSS JOIN periodo p
                WHERE EXTRACT(MONTH FROM d.data)::int = p.mes
                  AND EXTRACT(YEAR FROM d.data)::int = p.ano
                  AND (${EBITDA_LUCRO_OPERACIONAL_MATCH} OR ${EBITDA_DEPRECIACAO_MATCH})
              ) THEN 'regular'
              WHEN EXISTS (
                SELECT 1
                FROM dre d
                CROSS JOIN periodo p
                WHERE EXTRACT(MONTH FROM d.data)::int = 1
                  AND EXTRACT(DAY FROM d.data)::int = p.mes
                  AND EXTRACT(YEAR FROM d.data)::int = p.ano
                  AND (${EBITDA_LUCRO_OPERACIONAL_MATCH} OR ${EBITDA_DEPRECIACAO_MATCH})
              ) THEN 'legacy'
              ELSE 'regular'
            END AS modo
        ),
        lucro_ref AS (
          SELECT MIN(d.data) AS data_ref
          FROM dre d
          CROSS JOIN periodo p
          CROSS JOIN modo_periodo mp
          WHERE EXTRACT(YEAR FROM d.data)::int = p.ano
            AND (
              (mp.modo = 'regular' AND EXTRACT(MONTH FROM d.data)::int = p.mes)
              OR (mp.modo = 'legacy' AND EXTRACT(MONTH FROM d.data)::int = 1 AND EXTRACT(DAY FROM d.data)::int = p.mes)
            )
            AND ${EBITDA_LUCRO_OPERACIONAL_MATCH}
        ),
        depreciacao_ref AS (
          SELECT MIN(d.data) AS data_ref
          FROM dre d
          CROSS JOIN periodo p
          CROSS JOIN modo_periodo mp
          WHERE EXTRACT(YEAR FROM d.data)::int = p.ano
            AND (
              (mp.modo = 'regular' AND EXTRACT(MONTH FROM d.data)::int = p.mes)
              OR (mp.modo = 'legacy' AND EXTRACT(MONTH FROM d.data)::int = 1 AND EXTRACT(DAY FROM d.data)::int = p.mes)
            )
            AND ${EBITDA_DEPRECIACAO_MATCH}
        ),
        base AS (
          SELECT
            (
              SELECT COALESCE(AVG(d.valor), 0)::float
              FROM dre d
              CROSS JOIN periodo p
              CROSS JOIN modo_periodo mp
              CROSS JOIN lucro_ref lr
              WHERE EXTRACT(YEAR FROM d.data)::int = p.ano
                AND (
                  (mp.modo = 'regular' AND EXTRACT(MONTH FROM d.data)::int = p.mes)
                  OR (mp.modo = 'legacy' AND EXTRACT(MONTH FROM d.data)::int = 1 AND EXTRACT(DAY FROM d.data)::int = p.mes)
                )
                AND d.data = lr.data_ref
                AND ${EBITDA_LUCRO_OPERACIONAL_MATCH}
            ) AS lucro_operacional,
            (
              SELECT COALESCE(AVG(ABS(d.valor)), 0)::float
              FROM dre d
              CROSS JOIN periodo p
              CROSS JOIN modo_periodo mp
              CROSS JOIN depreciacao_ref dr
              WHERE EXTRACT(YEAR FROM d.data)::int = p.ano
                AND (
                  (mp.modo = 'regular' AND EXTRACT(MONTH FROM d.data)::int = p.mes)
                  OR (mp.modo = 'legacy' AND EXTRACT(MONTH FROM d.data)::int = 1 AND EXTRACT(DAY FROM d.data)::int = p.mes)
                )
                AND d.data = dr.data_ref
                AND ${EBITDA_DEPRECIACAO_MATCH}
            ) AS depreciacao
        )
        SELECT
          lucro_operacional,
          depreciacao,
          (lucro_operacional + depreciacao)::float AS value
        FROM base;
      `,
      params: [periodFilter.month, periodFilter.year],
    };
  }

  if (periodFilter?.month) {
    return {
      sql: `
        WITH anos_base AS (
          SELECT
            EXTRACT(YEAR FROM data)::int AS ano_ref,
            SUM(CASE WHEN EXTRACT(MONTH FROM data)::int = $1 AND ${EBITDA_LUCRO_OPERACIONAL_MATCH} THEN 1 ELSE 0 END) AS reg_lucro,
            SUM(CASE WHEN EXTRACT(MONTH FROM data)::int = $1 AND ${EBITDA_DEPRECIACAO_MATCH} THEN 1 ELSE 0 END) AS reg_dep,
            SUM(CASE WHEN EXTRACT(MONTH FROM data)::int = 1 AND EXTRACT(DAY FROM data)::int = $1 AND ${EBITDA_LUCRO_OPERACIONAL_MATCH} THEN 1 ELSE 0 END) AS leg_lucro,
            SUM(CASE WHEN EXTRACT(MONTH FROM data)::int = 1 AND EXTRACT(DAY FROM data)::int = $1 AND ${EBITDA_DEPRECIACAO_MATCH} THEN 1 ELSE 0 END) AS leg_dep
          FROM dre
          GROUP BY EXTRACT(YEAR FROM data)::int
        ),
        anos_validos AS (
          SELECT ano_ref
          FROM anos_base
          WHERE (reg_lucro > 0 AND reg_dep > 0)
             OR (leg_lucro > 0 AND leg_dep > 0)
        ),
        ano_referencia AS (
          SELECT MAX(ano_ref) AS ano_ref
          FROM anos_validos
        ),
        periodo AS (
          SELECT $1::int AS mes, ano_ref AS ano
          FROM ano_referencia
        ),
        modo_periodo AS (
          SELECT
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM dre d
                CROSS JOIN periodo p
                WHERE EXTRACT(MONTH FROM d.data)::int = p.mes
                  AND EXTRACT(YEAR FROM d.data)::int = p.ano
                  AND (${EBITDA_LUCRO_OPERACIONAL_MATCH} OR ${EBITDA_DEPRECIACAO_MATCH})
              ) THEN 'regular'
              WHEN EXISTS (
                SELECT 1
                FROM dre d
                CROSS JOIN periodo p
                WHERE EXTRACT(MONTH FROM d.data)::int = 1
                  AND EXTRACT(DAY FROM d.data)::int = p.mes
                  AND EXTRACT(YEAR FROM d.data)::int = p.ano
                  AND (${EBITDA_LUCRO_OPERACIONAL_MATCH} OR ${EBITDA_DEPRECIACAO_MATCH})
              ) THEN 'legacy'
              ELSE 'regular'
            END AS modo
        ),
        lucro_ref AS (
          SELECT MIN(d.data) AS data_ref
          FROM dre d
          CROSS JOIN periodo p
          CROSS JOIN modo_periodo mp
          WHERE EXTRACT(YEAR FROM d.data)::int = p.ano
            AND (
              (mp.modo = 'regular' AND EXTRACT(MONTH FROM d.data)::int = p.mes)
              OR (mp.modo = 'legacy' AND EXTRACT(MONTH FROM d.data)::int = 1 AND EXTRACT(DAY FROM d.data)::int = p.mes)
            )
            AND ${EBITDA_LUCRO_OPERACIONAL_MATCH}
        ),
        depreciacao_ref AS (
          SELECT MIN(d.data) AS data_ref
          FROM dre d
          CROSS JOIN periodo p
          CROSS JOIN modo_periodo mp
          WHERE EXTRACT(YEAR FROM d.data)::int = p.ano
            AND (
              (mp.modo = 'regular' AND EXTRACT(MONTH FROM d.data)::int = p.mes)
              OR (mp.modo = 'legacy' AND EXTRACT(MONTH FROM d.data)::int = 1 AND EXTRACT(DAY FROM d.data)::int = p.mes)
            )
            AND ${EBITDA_DEPRECIACAO_MATCH}
        ),
        base AS (
          SELECT
            (
              SELECT COALESCE(AVG(d.valor), 0)::float
              FROM dre d
              CROSS JOIN periodo p
              CROSS JOIN modo_periodo mp
              CROSS JOIN lucro_ref lr
              WHERE EXTRACT(YEAR FROM d.data)::int = p.ano
                AND (
                  (mp.modo = 'regular' AND EXTRACT(MONTH FROM d.data)::int = p.mes)
                  OR (mp.modo = 'legacy' AND EXTRACT(MONTH FROM d.data)::int = 1 AND EXTRACT(DAY FROM d.data)::int = p.mes)
                )
                AND d.data = lr.data_ref
                AND ${EBITDA_LUCRO_OPERACIONAL_MATCH}
            ) AS lucro_operacional,
            (
              SELECT COALESCE(AVG(ABS(d.valor)), 0)::float
              FROM dre d
              CROSS JOIN periodo p
              CROSS JOIN modo_periodo mp
              CROSS JOIN depreciacao_ref dr
              WHERE EXTRACT(YEAR FROM d.data)::int = p.ano
                AND (
                  (mp.modo = 'regular' AND EXTRACT(MONTH FROM d.data)::int = p.mes)
                  OR (mp.modo = 'legacy' AND EXTRACT(MONTH FROM d.data)::int = 1 AND EXTRACT(DAY FROM d.data)::int = p.mes)
                )
                AND d.data = dr.data_ref
                AND ${EBITDA_DEPRECIACAO_MATCH}
            ) AS depreciacao
        )
        SELECT
          lucro_operacional,
          depreciacao,
          (lucro_operacional + depreciacao)::float AS value
        FROM base;
      `,
      params: [periodFilter.month],
    };
  }

  return {
    sql: `
      WITH periodos_validos AS (
        SELECT
          EXTRACT(MONTH FROM data)::int AS mes,
          EXTRACT(YEAR FROM data)::int AS ano
        FROM dre
        GROUP BY EXTRACT(MONTH FROM data)::int, EXTRACT(YEAR FROM data)::int
        HAVING
          SUM(CASE WHEN ${EBITDA_LUCRO_OPERACIONAL_MATCH} THEN 1 ELSE 0 END) > 0
          AND SUM(CASE WHEN ${EBITDA_DEPRECIACAO_MATCH} THEN 1 ELSE 0 END) > 0
        UNION ALL
        SELECT
          EXTRACT(DAY FROM data)::int AS mes,
          EXTRACT(YEAR FROM data)::int AS ano
        FROM dre
        WHERE EXTRACT(MONTH FROM data)::int = 1
        GROUP BY EXTRACT(DAY FROM data)::int, EXTRACT(YEAR FROM data)::int
        HAVING
          SUM(CASE WHEN ${EBITDA_LUCRO_OPERACIONAL_MATCH} THEN 1 ELSE 0 END) > 0
          AND SUM(CASE WHEN ${EBITDA_DEPRECIACAO_MATCH} THEN 1 ELSE 0 END) > 0
      ),
      periodo AS (
        SELECT
          mes,
          ano
        FROM periodos_validos
        ORDER BY ano DESC, mes DESC
        LIMIT 1
      ),
      lucro_ref AS (
        SELECT MIN(d.data) AS data_ref
        FROM dre d
        CROSS JOIN periodo p
        WHERE EXTRACT(YEAR FROM d.data)::int = p.ano
          AND (
            EXTRACT(MONTH FROM d.data)::int = p.mes
            OR (EXTRACT(MONTH FROM d.data)::int = 1 AND EXTRACT(DAY FROM d.data)::int = p.mes)
          )
          AND ${EBITDA_LUCRO_OPERACIONAL_MATCH}
      ),
      depreciacao_ref AS (
        SELECT MIN(d.data) AS data_ref
        FROM dre d
        CROSS JOIN periodo p
        WHERE EXTRACT(YEAR FROM d.data)::int = p.ano
          AND (
            EXTRACT(MONTH FROM d.data)::int = p.mes
            OR (EXTRACT(MONTH FROM d.data)::int = 1 AND EXTRACT(DAY FROM d.data)::int = p.mes)
          )
          AND ${EBITDA_DEPRECIACAO_MATCH}
      ),
      base AS (
        SELECT
          (
            SELECT COALESCE(AVG(d.valor), 0)::float
            FROM dre d
            CROSS JOIN periodo p
            CROSS JOIN lucro_ref lr
            WHERE EXTRACT(YEAR FROM d.data)::int = p.ano
              AND (
                EXTRACT(MONTH FROM d.data)::int = p.mes
                OR (EXTRACT(MONTH FROM d.data)::int = 1 AND EXTRACT(DAY FROM d.data)::int = p.mes)
              )
              AND d.data = lr.data_ref
              AND ${EBITDA_LUCRO_OPERACIONAL_MATCH}
          ) AS lucro_operacional,
          (
            SELECT COALESCE(AVG(ABS(d.valor)), 0)::float
            FROM dre d
            CROSS JOIN periodo p
            CROSS JOIN depreciacao_ref dr
            WHERE EXTRACT(YEAR FROM d.data)::int = p.ano
              AND (
                EXTRACT(MONTH FROM d.data)::int = p.mes
                OR (EXTRACT(MONTH FROM d.data)::int = 1 AND EXTRACT(DAY FROM d.data)::int = p.mes)
              )
              AND d.data = dr.data_ref
              AND ${EBITDA_DEPRECIACAO_MATCH}
          ) AS depreciacao
      )
      SELECT
        lucro_operacional,
        depreciacao,
        (lucro_operacional + depreciacao)::float AS value
      FROM base;
    `,
    params: [],
  };
}

function buildRoeQuery(periodFilter: PeriodFilter | null) {
  if (periodFilter?.year) {
    return {
      sql: `
        WITH periodo AS (
          SELECT $1::int AS mes, $2::int AS ano
        ),
        modo_lucro AS (
          SELECT
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM dre d
                CROSS JOIN periodo p
                WHERE EXTRACT(MONTH FROM d.data)::int = p.mes
                  AND EXTRACT(YEAR FROM d.data)::int = p.ano
                  AND ${ROE_LUCRO_MATCH}
              ) THEN 'regular'
              WHEN EXISTS (
                SELECT 1
                FROM dre d
                CROSS JOIN periodo p
                WHERE EXTRACT(MONTH FROM d.data)::int = 1
                  AND EXTRACT(DAY FROM d.data)::int = p.mes
                  AND EXTRACT(YEAR FROM d.data)::int = p.ano
                  AND ${ROE_LUCRO_MATCH}
              ) THEN 'legacy'
              ELSE 'regular'
            END AS modo
        ),
        modo_patrimonio AS (
          SELECT
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM balancete b
                CROSS JOIN periodo p
                WHERE EXTRACT(MONTH FROM b.data)::int = p.mes
                  AND EXTRACT(YEAR FROM b.data)::int = p.ano
                  AND ${ROE_PATRIMONIO_MATCH}
              ) THEN 'regular'
              WHEN EXISTS (
                SELECT 1
                FROM balancete b
                CROSS JOIN periodo p
                WHERE EXTRACT(MONTH FROM b.data)::int = 1
                  AND EXTRACT(DAY FROM b.data)::int = p.mes
                  AND EXTRACT(YEAR FROM b.data)::int = p.ano
                  AND ${ROE_PATRIMONIO_MATCH}
              ) THEN 'legacy'
              ELSE 'regular'
            END AS modo
        ),
        lucro_ref AS (
          SELECT MIN(d.data) AS data_ref
          FROM dre d
          CROSS JOIN periodo p
          CROSS JOIN modo_lucro ml
          WHERE EXTRACT(YEAR FROM d.data)::int = p.ano
            AND (
              (ml.modo = 'regular' AND EXTRACT(MONTH FROM d.data)::int = p.mes)
              OR (ml.modo = 'legacy' AND EXTRACT(MONTH FROM d.data)::int = 1 AND EXTRACT(DAY FROM d.data)::int = p.mes)
            )
            AND ${ROE_LUCRO_MATCH}
        ),
        patrimonio_ref AS (
          SELECT MIN(b.data) AS data_ref
          FROM balancete b
          CROSS JOIN periodo p
          CROSS JOIN modo_patrimonio mp
          WHERE EXTRACT(YEAR FROM b.data)::int = p.ano
            AND (
              (mp.modo = 'regular' AND EXTRACT(MONTH FROM b.data)::int = p.mes)
              OR (mp.modo = 'legacy' AND EXTRACT(MONTH FROM b.data)::int = 1 AND EXTRACT(DAY FROM b.data)::int = p.mes)
            )
            AND ${ROE_PATRIMONIO_MATCH}
        ),
        base AS (
          SELECT
            (
              SELECT COALESCE(AVG(d.valor), 0)::float
              FROM dre d
              CROSS JOIN periodo p
              CROSS JOIN modo_lucro ml
              CROSS JOIN lucro_ref lr
              WHERE EXTRACT(YEAR FROM d.data)::int = p.ano
                AND (
                  (ml.modo = 'regular' AND EXTRACT(MONTH FROM d.data)::int = p.mes)
                  OR (ml.modo = 'legacy' AND EXTRACT(MONTH FROM d.data)::int = 1 AND EXTRACT(DAY FROM d.data)::int = p.mes)
                )
                AND d.data = lr.data_ref
                AND ${ROE_LUCRO_MATCH}
            ) AS lucro_liquido,
            (
              SELECT COALESCE(AVG(b.valor), 0)::float
              FROM balancete b
              CROSS JOIN periodo p
              CROSS JOIN modo_patrimonio mp
              CROSS JOIN patrimonio_ref pr
              WHERE EXTRACT(YEAR FROM b.data)::int = p.ano
                AND (
                  (mp.modo = 'regular' AND EXTRACT(MONTH FROM b.data)::int = p.mes)
                  OR (mp.modo = 'legacy' AND EXTRACT(MONTH FROM b.data)::int = 1 AND EXTRACT(DAY FROM b.data)::int = p.mes)
                )
                AND b.data = pr.data_ref
                AND ${ROE_PATRIMONIO_MATCH}
            ) AS patrimonio_liquido
        )
        SELECT
          CASE
            WHEN patrimonio_liquido = 0 THEN NULL
            ELSE (lucro_liquido / patrimonio_liquido) * 100
          END AS value,
          lucro_liquido,
          patrimonio_liquido
        FROM base;
      `,
      params: [periodFilter.month, periodFilter.year],
    };
  }

  if (periodFilter?.month) {
    return {
      sql: `
        WITH anos_lucro AS (
          SELECT EXTRACT(YEAR FROM d.data)::int AS ano_ref
          FROM dre d
          WHERE (
              EXTRACT(MONTH FROM d.data)::int = $1
              OR (EXTRACT(MONTH FROM d.data)::int = 1 AND EXTRACT(DAY FROM d.data)::int = $1)
            )
            AND ${ROE_LUCRO_MATCH}
          GROUP BY EXTRACT(YEAR FROM d.data)::int
        ),
        anos_patrimonio AS (
          SELECT EXTRACT(YEAR FROM b.data)::int AS ano_ref
          FROM balancete b
          WHERE (
              EXTRACT(MONTH FROM b.data)::int = $1
              OR (EXTRACT(MONTH FROM b.data)::int = 1 AND EXTRACT(DAY FROM b.data)::int = $1)
            )
            AND ${ROE_PATRIMONIO_MATCH}
          GROUP BY EXTRACT(YEAR FROM b.data)::int
        ),
        WITH ano_referencia AS (
          SELECT MAX(l.ano_ref) AS ano_ref
          FROM anos_lucro l
          INNER JOIN anos_patrimonio p ON p.ano_ref = l.ano_ref
        ),
        periodo AS (
          SELECT $1::int AS mes, ano_ref AS ano
          FROM ano_referencia
        ),
        modo_lucro AS (
          SELECT
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM dre d
                CROSS JOIN periodo p
                WHERE EXTRACT(MONTH FROM d.data)::int = p.mes
                  AND EXTRACT(YEAR FROM d.data)::int = p.ano
                  AND ${ROE_LUCRO_MATCH}
              ) THEN 'regular'
              WHEN EXISTS (
                SELECT 1
                FROM dre d
                CROSS JOIN periodo p
                WHERE EXTRACT(MONTH FROM d.data)::int = 1
                  AND EXTRACT(DAY FROM d.data)::int = p.mes
                  AND EXTRACT(YEAR FROM d.data)::int = p.ano
                  AND ${ROE_LUCRO_MATCH}
              ) THEN 'legacy'
              ELSE 'regular'
            END AS modo
        ),
        modo_patrimonio AS (
          SELECT
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM balancete b
                CROSS JOIN periodo p
                WHERE EXTRACT(MONTH FROM b.data)::int = p.mes
                  AND EXTRACT(YEAR FROM b.data)::int = p.ano
                  AND ${ROE_PATRIMONIO_MATCH}
              ) THEN 'regular'
              WHEN EXISTS (
                SELECT 1
                FROM balancete b
                CROSS JOIN periodo p
                WHERE EXTRACT(MONTH FROM b.data)::int = 1
                  AND EXTRACT(DAY FROM b.data)::int = p.mes
                  AND EXTRACT(YEAR FROM b.data)::int = p.ano
                  AND ${ROE_PATRIMONIO_MATCH}
              ) THEN 'legacy'
              ELSE 'regular'
            END AS modo
        ),
        lucro_ref AS (
          SELECT MIN(d.data) AS data_ref
          FROM dre d
          CROSS JOIN periodo p
          CROSS JOIN modo_lucro ml
          WHERE EXTRACT(YEAR FROM d.data)::int = p.ano
            AND (
              (ml.modo = 'regular' AND EXTRACT(MONTH FROM d.data)::int = p.mes)
              OR (ml.modo = 'legacy' AND EXTRACT(MONTH FROM d.data)::int = 1 AND EXTRACT(DAY FROM d.data)::int = p.mes)
            )
            AND ${ROE_LUCRO_MATCH}
        ),
        patrimonio_ref AS (
          SELECT MIN(b.data) AS data_ref
          FROM balancete b
          CROSS JOIN periodo p
          CROSS JOIN modo_patrimonio mp
          WHERE EXTRACT(YEAR FROM b.data)::int = p.ano
            AND (
              (mp.modo = 'regular' AND EXTRACT(MONTH FROM b.data)::int = p.mes)
              OR (mp.modo = 'legacy' AND EXTRACT(MONTH FROM b.data)::int = 1 AND EXTRACT(DAY FROM b.data)::int = p.mes)
            )
            AND ${ROE_PATRIMONIO_MATCH}
        ),
        base AS (
          SELECT
            (
              SELECT COALESCE(AVG(d.valor), 0)::float
              FROM dre d
              CROSS JOIN periodo p
              CROSS JOIN modo_lucro ml
              CROSS JOIN lucro_ref lr
              WHERE EXTRACT(YEAR FROM d.data)::int = p.ano
                AND (
                  (ml.modo = 'regular' AND EXTRACT(MONTH FROM d.data)::int = p.mes)
                  OR (ml.modo = 'legacy' AND EXTRACT(MONTH FROM d.data)::int = 1 AND EXTRACT(DAY FROM d.data)::int = p.mes)
                )
                AND d.data = lr.data_ref
                AND ${ROE_LUCRO_MATCH}
            ) AS lucro_liquido,
            (
              SELECT COALESCE(AVG(b.valor), 0)::float
              FROM balancete b
              CROSS JOIN periodo p
              CROSS JOIN modo_patrimonio mp
              CROSS JOIN patrimonio_ref pr
              WHERE EXTRACT(YEAR FROM b.data)::int = p.ano
                AND (
                  (mp.modo = 'regular' AND EXTRACT(MONTH FROM b.data)::int = p.mes)
                  OR (mp.modo = 'legacy' AND EXTRACT(MONTH FROM b.data)::int = 1 AND EXTRACT(DAY FROM b.data)::int = p.mes)
                )
                AND b.data = pr.data_ref
                AND ${ROE_PATRIMONIO_MATCH}
            ) AS patrimonio_liquido
        )
        SELECT
          CASE
            WHEN patrimonio_liquido = 0 THEN NULL
            ELSE (lucro_liquido / patrimonio_liquido) * 100
          END AS value,
          lucro_liquido,
          patrimonio_liquido
        FROM base;
      `,
      params: [periodFilter.month],
    };
  }

  return {
    sql: `
      WITH periodos_lucro AS (
        SELECT
          EXTRACT(MONTH FROM d.data)::int AS mes,
          EXTRACT(YEAR FROM d.data)::int AS ano
        FROM dre d
        WHERE ${ROE_LUCRO_MATCH}
        GROUP BY EXTRACT(MONTH FROM d.data)::int, EXTRACT(YEAR FROM d.data)::int
        UNION ALL
        SELECT
          EXTRACT(DAY FROM d.data)::int AS mes,
          EXTRACT(YEAR FROM d.data)::int AS ano
        FROM dre d
        WHERE EXTRACT(MONTH FROM d.data)::int = 1
          AND ${ROE_LUCRO_MATCH}
        GROUP BY EXTRACT(DAY FROM d.data)::int, EXTRACT(YEAR FROM d.data)::int
      ),
      periodos_patrimonio AS (
        SELECT
          EXTRACT(MONTH FROM b.data)::int AS mes,
          EXTRACT(YEAR FROM b.data)::int AS ano
        FROM balancete b
        WHERE ${ROE_PATRIMONIO_MATCH}
        GROUP BY EXTRACT(MONTH FROM b.data)::int, EXTRACT(YEAR FROM b.data)::int
        UNION ALL
        SELECT
          EXTRACT(DAY FROM b.data)::int AS mes,
          EXTRACT(YEAR FROM b.data)::int AS ano
        FROM balancete b
        WHERE EXTRACT(MONTH FROM b.data)::int = 1
          AND ${ROE_PATRIMONIO_MATCH}
        GROUP BY EXTRACT(DAY FROM b.data)::int, EXTRACT(YEAR FROM b.data)::int
      ),
      periodos_validos AS (
        SELECT l.mes, l.ano
        FROM periodos_lucro l
        INNER JOIN periodos_patrimonio p ON p.mes = l.mes AND p.ano = l.ano
      ),
      periodo AS (
        SELECT
          mes,
          ano
        FROM periodos_validos
        ORDER BY ano DESC, mes DESC
        LIMIT 1
      ),
      modo_lucro AS (
        SELECT
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM dre d
              CROSS JOIN periodo p
              WHERE EXTRACT(MONTH FROM d.data)::int = p.mes
                AND EXTRACT(YEAR FROM d.data)::int = p.ano
                AND ${ROE_LUCRO_MATCH}
            ) THEN 'regular'
            WHEN EXISTS (
              SELECT 1
              FROM dre d
              CROSS JOIN periodo p
              WHERE EXTRACT(MONTH FROM d.data)::int = 1
                AND EXTRACT(DAY FROM d.data)::int = p.mes
                AND EXTRACT(YEAR FROM d.data)::int = p.ano
                AND ${ROE_LUCRO_MATCH}
            ) THEN 'legacy'
            ELSE 'regular'
          END AS modo
      ),
      modo_patrimonio AS (
        SELECT
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM balancete b
              CROSS JOIN periodo p
              WHERE EXTRACT(MONTH FROM b.data)::int = p.mes
                AND EXTRACT(YEAR FROM b.data)::int = p.ano
                AND ${ROE_PATRIMONIO_MATCH}
            ) THEN 'regular'
            WHEN EXISTS (
              SELECT 1
              FROM balancete b
              CROSS JOIN periodo p
              WHERE EXTRACT(MONTH FROM b.data)::int = 1
                AND EXTRACT(DAY FROM b.data)::int = p.mes
                AND EXTRACT(YEAR FROM b.data)::int = p.ano
                AND ${ROE_PATRIMONIO_MATCH}
            ) THEN 'legacy'
            ELSE 'regular'
          END AS modo
      ),
      lucro_ref AS (
        SELECT MIN(d.data) AS data_ref
        FROM dre d
        CROSS JOIN periodo p
        CROSS JOIN modo_lucro ml
        WHERE EXTRACT(YEAR FROM d.data)::int = p.ano
          AND (
            (ml.modo = 'regular' AND EXTRACT(MONTH FROM d.data)::int = p.mes)
            OR (ml.modo = 'legacy' AND EXTRACT(MONTH FROM d.data)::int = 1 AND EXTRACT(DAY FROM d.data)::int = p.mes)
          )
          AND ${ROE_LUCRO_MATCH}
      ),
      patrimonio_ref AS (
        SELECT MIN(b.data) AS data_ref
        FROM balancete b
        CROSS JOIN periodo p
        CROSS JOIN modo_patrimonio mp
        WHERE EXTRACT(YEAR FROM b.data)::int = p.ano
          AND (
            (mp.modo = 'regular' AND EXTRACT(MONTH FROM b.data)::int = p.mes)
            OR (mp.modo = 'legacy' AND EXTRACT(MONTH FROM b.data)::int = 1 AND EXTRACT(DAY FROM b.data)::int = p.mes)
          )
          AND ${ROE_PATRIMONIO_MATCH}
      ),
      base AS (
        SELECT
          (
            SELECT COALESCE(AVG(d.valor), 0)::float
            FROM dre d
            CROSS JOIN periodo p
            CROSS JOIN modo_lucro ml
            CROSS JOIN lucro_ref lr
            WHERE EXTRACT(YEAR FROM d.data)::int = p.ano
              AND (
                (ml.modo = 'regular' AND EXTRACT(MONTH FROM d.data)::int = p.mes)
                OR (ml.modo = 'legacy' AND EXTRACT(MONTH FROM d.data)::int = 1 AND EXTRACT(DAY FROM d.data)::int = p.mes)
              )
              AND d.data = lr.data_ref
              AND ${ROE_LUCRO_MATCH}
          ) AS lucro_liquido,
          (
            SELECT COALESCE(AVG(b.valor), 0)::float
            FROM balancete b
            CROSS JOIN periodo p
            CROSS JOIN modo_patrimonio mp
            CROSS JOIN patrimonio_ref pr
            WHERE EXTRACT(YEAR FROM b.data)::int = p.ano
              AND (
                (mp.modo = 'regular' AND EXTRACT(MONTH FROM b.data)::int = p.mes)
                OR (mp.modo = 'legacy' AND EXTRACT(MONTH FROM b.data)::int = 1 AND EXTRACT(DAY FROM b.data)::int = p.mes)
              )
              AND b.data = pr.data_ref
              AND ${ROE_PATRIMONIO_MATCH}
          ) AS patrimonio_liquido
      )
      SELECT
        CASE
          WHEN patrimonio_liquido = 0 THEN NULL
          ELSE (lucro_liquido / patrimonio_liquido) * 100
        END AS value,
        lucro_liquido,
        patrimonio_liquido
      FROM base;
    `,
    params: [],
  };
}

function buildRoeDiagnosticSql(periodFilter: PeriodFilter | null) {
  if (periodFilter?.year) {
    return {
      sql: `
        SELECT
          (
            SELECT COALESCE(SUM(CASE WHEN ${ROE_LUCRO_MATCH} THEN 1 ELSE 0 END), 0)::int
            FROM dre
            WHERE EXTRACT(YEAR FROM data)::int = $2
              AND (
                EXTRACT(MONTH FROM data)::int = $1
                OR (EXTRACT(MONTH FROM data)::int = 1 AND EXTRACT(DAY FROM data)::int = $1)
              )
          ) AS lucro_rows,
          (
            SELECT COALESCE(SUM(CASE WHEN ${ROE_PATRIMONIO_MATCH} THEN 1 ELSE 0 END), 0)::int
            FROM balancete
            WHERE EXTRACT(YEAR FROM data)::int = $2
              AND (
                EXTRACT(MONTH FROM data)::int = $1
                OR (EXTRACT(MONTH FROM data)::int = 1 AND EXTRACT(DAY FROM data)::int = $1)
              )
          ) AS patrimonio_rows;
      `,
      params: [periodFilter.month, periodFilter.year],
    };
  }

  if (periodFilter?.month) {
    return {
      sql: `
        WITH anos_lucro AS (
          SELECT EXTRACT(YEAR FROM data)::int AS ano_ref
          FROM dre
          WHERE (
              EXTRACT(MONTH FROM data)::int = $1
              OR (EXTRACT(MONTH FROM data)::int = 1 AND EXTRACT(DAY FROM data)::int = $1)
            )
            AND ${ROE_LUCRO_MATCH}
          GROUP BY EXTRACT(YEAR FROM data)::int
        ),
        anos_patrimonio AS (
          SELECT EXTRACT(YEAR FROM data)::int AS ano_ref
          FROM balancete
          WHERE (
              EXTRACT(MONTH FROM data)::int = $1
              OR (EXTRACT(MONTH FROM data)::int = 1 AND EXTRACT(DAY FROM data)::int = $1)
            )
            AND ${ROE_PATRIMONIO_MATCH}
          GROUP BY EXTRACT(YEAR FROM data)::int
        ),
        ano_referencia AS (
          SELECT MAX(l.ano_ref) AS ano_ref
          FROM anos_lucro l
          INNER JOIN anos_patrimonio p ON p.ano_ref = l.ano_ref
        )
        SELECT
          (
            SELECT COALESCE(SUM(CASE WHEN ${ROE_LUCRO_MATCH} THEN 1 ELSE 0 END), 0)::int
            FROM dre
            CROSS JOIN ano_referencia ar
            WHERE EXTRACT(YEAR FROM data)::int = ar.ano_ref
              AND (
                EXTRACT(MONTH FROM data)::int = $1
                OR (EXTRACT(MONTH FROM data)::int = 1 AND EXTRACT(DAY FROM data)::int = $1)
              )
          ) AS lucro_rows,
          (
            SELECT COALESCE(SUM(CASE WHEN ${ROE_PATRIMONIO_MATCH} THEN 1 ELSE 0 END), 0)::int
            FROM balancete
            CROSS JOIN ano_referencia ar
            WHERE EXTRACT(YEAR FROM data)::int = ar.ano_ref
              AND (
                EXTRACT(MONTH FROM data)::int = $1
                OR (EXTRACT(MONTH FROM data)::int = 1 AND EXTRACT(DAY FROM data)::int = $1)
              )
          ) AS patrimonio_rows;
      `,
      params: [periodFilter.month],
    };
  }

  return {
    sql: `
      WITH periodos_lucro AS (
        SELECT
          EXTRACT(MONTH FROM data)::int AS mes,
          EXTRACT(YEAR FROM data)::int AS ano
        FROM dre
        WHERE ${ROE_LUCRO_MATCH}
        GROUP BY EXTRACT(MONTH FROM data)::int, EXTRACT(YEAR FROM data)::int
        UNION ALL
        SELECT
          EXTRACT(DAY FROM data)::int AS mes,
          EXTRACT(YEAR FROM data)::int AS ano
        FROM dre
        WHERE EXTRACT(MONTH FROM data)::int = 1
          AND ${ROE_LUCRO_MATCH}
        GROUP BY EXTRACT(DAY FROM data)::int, EXTRACT(YEAR FROM data)::int
      ),
      periodos_patrimonio AS (
        SELECT
          EXTRACT(MONTH FROM data)::int AS mes,
          EXTRACT(YEAR FROM data)::int AS ano
        FROM balancete
        WHERE ${ROE_PATRIMONIO_MATCH}
        GROUP BY EXTRACT(MONTH FROM data)::int, EXTRACT(YEAR FROM data)::int
        UNION ALL
        SELECT
          EXTRACT(DAY FROM data)::int AS mes,
          EXTRACT(YEAR FROM data)::int AS ano
        FROM balancete
        WHERE EXTRACT(MONTH FROM data)::int = 1
          AND ${ROE_PATRIMONIO_MATCH}
        GROUP BY EXTRACT(DAY FROM data)::int, EXTRACT(YEAR FROM data)::int
      ),
      periodo AS (
        SELECT l.mes, l.ano
        FROM periodos_lucro l
        INNER JOIN periodos_patrimonio p ON p.mes = l.mes AND p.ano = l.ano
        ORDER BY l.ano DESC, l.mes DESC
        LIMIT 1
      )
      SELECT
        (
          SELECT COALESCE(SUM(CASE WHEN ${ROE_LUCRO_MATCH} THEN 1 ELSE 0 END), 0)::int
          FROM dre
          CROSS JOIN periodo p
          WHERE EXTRACT(YEAR FROM data)::int = p.ano
            AND (
              EXTRACT(MONTH FROM data)::int = p.mes
              OR (EXTRACT(MONTH FROM data)::int = 1 AND EXTRACT(DAY FROM data)::int = p.mes)
            )
        ) AS lucro_rows,
        (
          SELECT COALESCE(SUM(CASE WHEN ${ROE_PATRIMONIO_MATCH} THEN 1 ELSE 0 END), 0)::int
          FROM balancete
          CROSS JOIN periodo p
          WHERE EXTRACT(YEAR FROM data)::int = p.ano
            AND (
              EXTRACT(MONTH FROM data)::int = p.mes
              OR (EXTRACT(MONTH FROM data)::int = 1 AND EXTRACT(DAY FROM data)::int = p.mes)
            )
        ) AS patrimonio_rows;
    `,
    params: [],
  };
}

export async function processFinancialQuestion(question: string): Promise<ChatResponse> {
  const indicator = detectIndicator(question);
  const periodFilter = detectPeriodFilter(question);
  const periodLabel = formatPeriodLabel(periodFilter);

  if (indicator === "EBITDA") {
    const query = buildEbitdaQuery(periodFilter);
    const result = await dbQuery<{ lucro_operacional: number | null; depreciacao: number | null; value: number | null }>(
      query.sql,
      query.params,
    );

    const row = result.rows[0] ?? { lucro_operacional: 0, depreciacao: 0, value: 0 };
    const lucroOperacional = row.lucro_operacional ?? 0;
    const depreciacao = row.depreciacao ?? 0;
    const value = row.value ?? 0;

    return {
      indicator: "EBITDA",
      value,
      answer: `EBITDA${periodLabel}: ${formatCurrency(value)}\nLucro Operacional: ${formatCurrency(lucroOperacional)}\nDepreciação: ${formatCurrency(depreciacao)}`,
      spokenAnswer: `Seu EBITDA${periodLabel} foi ${formatCurrency(value)}. Ele é composto por um Lucro Operacional de ${formatCurrency(lucroOperacional)} e Depreciação de ${formatCurrency(depreciacao)}.`,
    };
  }

  const query = buildRoeQuery(periodFilter);
  const result = await dbQuery<{ value: number | null; lucro_liquido: number | null; patrimonio_liquido: number | null }>(query.sql, query.params);
  const value = result.rows[0]?.value ?? null;
  const lucroLiquido = result.rows[0]?.lucro_liquido ?? null;
  const patrimonioLiquido = result.rows[0]?.patrimonio_liquido ?? null;

  if (value === null) {
    const diagnostic = buildRoeDiagnosticSql(periodFilter);
    const diagnosticResult = await dbQuery<{ lucro_rows: number | null; patrimonio_rows: number | null }>(
      diagnostic.sql,
      diagnostic.params,
    );

    const lucroRows = diagnosticResult.rows[0]?.lucro_rows ?? 0;
    const patrimonioRows = diagnosticResult.rows[0]?.patrimonio_rows ?? 0;

    if (lucroRows === 0 && patrimonioRows === 0) {
      return {
        indicator: "ROE",
        value,
        answer: `Não encontrei os grupos de Lucro Líquido e Patrimônio Líquido${periodLabel} na base para calcular o ROE.`,
      };
    }

    if (patrimonioRows === 0) {
      return {
        indicator: "ROE",
        value,
        answer: `Não encontrei o grupo Patrimônio Líquido${periodLabel} na base para calcular o ROE.`,
      };
    }

    if (lucroRows === 0) {
      return {
        indicator: "ROE",
        value,
        answer: `Não encontrei o grupo Lucro Líquido${periodLabel} na base para calcular o ROE.`,
      };
    }

    return {
      indicator: "ROE",
      value,
      answer: `Não foi possível calcular ROE${periodLabel} com os dados atuais.`,
    };
  }

  return {
    indicator: "ROE",
    value,
    answer: `ROE${periodLabel}: ${formatPercent(value)}`,
    spokenAnswer: `Seu ROE${periodLabel} foi ${formatPercent(value)}. Ele é composto por um Lucro Líquido de ${formatCurrency(lucroLiquido)} e Patrimônio Líquido de ${formatCurrency(patrimonioLiquido)}.`,
  };
}