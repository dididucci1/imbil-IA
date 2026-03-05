import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/authGuards";
import { dbQuery } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_SORT_COLUMNS = new Set(["data", "conta", "id1", "id2", "id3", "valor"]);

export async function GET(request: Request) {
  try {
    if (!requireAdminSession()) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    await ensureSchema();

    const { searchParams } = new URL(request.url);
    const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
    const pageSize = Number.parseInt(searchParams.get("pageSize") ?? "10", 10);
    const search = searchParams.get("search")?.trim() ?? "";
    const sortByParam = searchParams.get("sortBy") ?? "data";
    const sortBy = ALLOWED_SORT_COLUMNS.has(sortByParam) ? sortByParam : "data";
    const sortOrder = (searchParams.get("sortOrder") ?? "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

    const offset = (Math.max(page, 1) - 1) * Math.max(pageSize, 1);

    const whereParts: string[] = [];
    const values: unknown[] = [];

    if (search) {
      values.push(`%${search}%`);
      whereParts.push(`(
        conta ILIKE $${values.length}
        OR COALESCE(id1, '') ILIKE $${values.length}
        OR COALESCE(id2, '') ILIKE $${values.length}
        OR COALESCE(id3, '') ILIKE $${values.length}
      )`);
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    const countQuery = await dbQuery<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM dre ${whereClause}`,
      values,
    );

    const total = Number.parseInt(countQuery.rows[0]?.total ?? "0", 10);

    values.push(pageSize, offset);

    const dataQuery = await dbQuery(
      `
      SELECT
        conta,
        id1,
        id2,
        id3,
        TO_CHAR(data, 'YYYY-MM-DD') AS data,
        valor::float AS valor
      FROM dre
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${values.length - 1}
      OFFSET $${values.length}
      `,
      values,
    );

    const lastUpdateQuery = await dbQuery<{ last_update: string | null }>(
      `SELECT TO_CHAR(MAX(data), 'YYYY-MM-DD') AS last_update FROM dre`,
    );

    return NextResponse.json(
      {
        rows: dataQuery.rows,
        total,
        page,
        pageSize,
        lastUpdate: lastUpdateQuery.rows[0]?.last_update,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar DRE." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if (!requireAdminSession()) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as { confirm?: string };

    if (body.confirm !== "REMOVER") {
      return NextResponse.json(
        { error: "Confirmação obrigatória para remover dados. Use confirm: REMOVER." },
        { status: 400 },
      );
    }

    await ensureSchema();
    await dbQuery("DELETE FROM dre");

    return NextResponse.json({ message: "Dados da DRE removidos com sucesso." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao remover dados." },
      { status: 500 },
    );
  }
}
