import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/authGuards";
import { dbQuery } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    if (!requireAdminSession()) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    await ensureSchema();

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId")?.trim();

    if (!jobId) {
      return NextResponse.json({ error: "Parâmetro jobId é obrigatório." }, { status: 400 });
    }

    const result = await dbQuery<{
      job_id: string;
      target_base: string;
      status: string;
      total_rows: number;
      inserted_rows: number;
      deleted_rows: number;
      message: string | null;
      error: string | null;
      updated_at: string;
    }>(
      `
      SELECT
        job_id,
        target_base,
        status,
        total_rows,
        inserted_rows,
        deleted_rows,
        message,
        error,
        TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at
      FROM upload_jobs
      WHERE job_id = $1
      `,
      [jobId],
    );

    const job = result.rows[0];

    if (!job) {
      return NextResponse.json({ error: "Upload não encontrado." }, { status: 404 });
    }

    return NextResponse.json(job, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao consultar status do upload." },
      { status: 500 },
    );
  }
}
