import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { requireAdminSession } from "@/lib/authGuards";
import { dbQuery, pool } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { parseDreCsv } from "@/services/csvProcessor";
import * as XLSX from "xlsx";

async function updateUploadJob(
  jobId: string,
  updates: {
    status?: "processing" | "done" | "error";
    totalRows?: number;
    insertedRows?: number;
    deletedRows?: number;
    message?: string;
    error?: string | null;
  },
) {
  await dbQuery(
    `
      UPDATE upload_jobs
      SET
        status = COALESCE($2, status),
        total_rows = COALESCE($3, total_rows),
        inserted_rows = COALESCE($4, inserted_rows),
        deleted_rows = COALESCE($5, deleted_rows),
        message = COALESCE($6, message),
        error = $7,
        updated_at = NOW()
      WHERE job_id = $1
    `,
    [
      jobId,
      updates.status ?? null,
      updates.totalRows ?? null,
      updates.insertedRows ?? null,
      updates.deletedRows ?? null,
      updates.message ?? null,
      updates.error ?? null,
    ],
  );
}

export async function POST(request: Request) {
  let jobId: string | null = null;

  try {
    if (!requireAdminSession()) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    await ensureSchema();

    const formData = await request.formData();
    const file = formData.get("file");
    const monthsWindow = 6;
    const importMode = formData.get("importMode") === "full" ? "full" : "window";
    const rawJobId = formData.get("jobId");

    jobId = typeof rawJobId === "string" && rawJobId.trim() ? rawJobId.trim() : randomUUID();

    await dbQuery(
      `
        INSERT INTO upload_jobs (job_id, target_base, status, total_rows, inserted_rows, deleted_rows, message, error)
        VALUES ($1, 'dre', 'processing', 0, 0, 0, 'Preparando arquivo...', NULL)
        ON CONFLICT (job_id)
        DO UPDATE SET
          target_base = EXCLUDED.target_base,
          status = EXCLUDED.status,
          total_rows = EXCLUDED.total_rows,
          inserted_rows = EXCLUDED.inserted_rows,
          deleted_rows = EXCLUDED.deleted_rows,
          message = EXCLUDED.message,
          error = NULL,
          updated_at = NOW()
      `,
      [jobId],
    );

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo CSV não enviado." }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const bytes = await file.arrayBuffer();
    const uint8 = new Uint8Array(bytes);
    let text = "";

    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const workbook = XLSX.read(bytes, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        return NextResponse.json({ error: "Planilha sem abas para processar." }, { status: 400 });
      }

      const firstSheet = workbook.Sheets[firstSheetName];
      text = XLSX.utils.sheet_to_csv(firstSheet, { FS: ";" });
    } else {
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(uint8);
      } catch {
        throw new Error("CSV inválido. Salve o arquivo em UTF-8 e tente novamente.");
      }
    }

    const rows = parseDreCsv(text);
    await updateUploadJob(jobId, {
      status: "processing",
      totalRows: rows.length,
      insertedRows: 0,
      message: `Arquivo validado. Iniciando importação de ${rows.length} linhas...`,
      error: null,
    });

    const uploadedDates = rows
      .map((row) => row.data)
      .filter((value): value is string => Boolean(value));

    const referenceDate = uploadedDates.length > 0
      ? uploadedDates.reduce((currentMax, currentValue) => (currentValue > currentMax ? currentValue : currentMax))
      : null;

    const client = await pool.connect();
    let deletedRows = 0;
    let insertedRows = 0;
    const insertChunkSize = 1000;

    try {
      await client.query("BEGIN");

      const deleteResult = importMode === "full"
        ? await client.query("DELETE FROM dre")
        : await client.query(
            `
              DELETE FROM dre
              WHERE data IS NOT NULL
                AND data >= (COALESCE($1::date, CURRENT_DATE) - ($2 * INTERVAL '1 month'))::date
            `,
            [referenceDate, monthsWindow],
          );

      deletedRows = deleteResult.rowCount ?? 0;

      await updateUploadJob(jobId, {
        status: "processing",
        deletedRows,
        message: `Base ajustada. ${deletedRows} linhas removidas. Inserindo dados...`,
        error: null,
      });

      for (let start = 0; start < rows.length; start += insertChunkSize) {
        const chunk = rows.slice(start, start + insertChunkSize);
        const values: Array<string | number | null> = [];

        const placeholders = chunk
          .map((_, index) => {
            const base = index * 6;
            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::date, $${base + 6})`;
          })
          .join(", ");

        for (const row of chunk) {
          values.push(row.conta, row.id1, row.id2, row.id3, row.data, row.valor);
        }

        await client.query(
          `
            INSERT INTO dre (conta, id1, id2, id3, data, valor)
            VALUES ${placeholders}
          `,
          values,
        );

        insertedRows += chunk.length;

        await updateUploadJob(jobId, {
          status: "processing",
          insertedRows,
          deletedRows,
          message: `Inserindo dados... ${insertedRows}/${rows.length}`,
          error: null,
        });
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      await updateUploadJob(jobId, {
        status: "error",
        insertedRows,
        deletedRows,
        message: "Falha durante a importação.",
        error: error instanceof Error ? error.message : "Erro ao importar DRE.",
      });
      throw error;
    } finally {
      client.release();
    }

    await updateUploadJob(jobId, {
      status: "done",
      insertedRows,
      deletedRows,
      message: `Importação finalizada: ${insertedRows}/${rows.length}`,
      error: null,
    });

    return NextResponse.json({
      message: "CSV processado com sucesso.",
      jobId,
      importMode,
      monthsWindow,
      referenceDate,
      deletedRows,
      inserted: insertedRows,
    });
  } catch (error) {
    if (jobId) {
      await updateUploadJob(jobId, {
        status: "error",
        message: "Falha durante a importação.",
        error: error instanceof Error ? error.message : "Erro ao processar CSV.",
      });
    }

    return NextResponse.json(
      {
        jobId,
        error: error instanceof Error ? error.message : "Erro ao processar CSV.",
      },
      { status: 500 },
    );
  }
}
