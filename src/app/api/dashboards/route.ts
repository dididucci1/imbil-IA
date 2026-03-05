import { NextResponse } from "next/server";

import { requireSession } from "@/lib/authGuards";
import { dbQuery } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import type { DashboardItem } from "@/types/dashboard";

export async function GET() {
  try {
    const session = requireSession();

    if (!session) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    await ensureSchema();

    if (session.perfil === "Admin") {
      const result = await dbQuery<DashboardItem>(
        `
        SELECT d.id, d.usuario_id, u.nome AS usuario_nome, d.nome, d.link
        FROM dashboards d
        INNER JOIN usuarios u ON u.id = d.usuario_id
        ORDER BY u.nome ASC, d.nome ASC
        `,
      );

      return NextResponse.json({ dashboards: result.rows });
    }

    const result = await dbQuery<DashboardItem>(
      `
      SELECT d.id, d.usuario_id, d.nome, d.link
      FROM dashboards d
      WHERE d.usuario_id = $1
      ORDER BY d.nome ASC
      `,
      [session.id],
    );

    return NextResponse.json({ dashboards: result.rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao listar dashboards." },
      { status: 500 },
    );
  }
}
