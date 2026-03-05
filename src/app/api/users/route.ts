import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/authGuards";
import { dbQuery } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

type DashboardInput = {
  nome: string;
  link: string;
};

type UserRow = {
  id: number;
  nome: string;
  email: string;
  perfil: "Admin" | "User";
  status: "Ativo" | "Inativo";
};

type DashboardRow = {
  id: number;
  usuario_id: number;
  nome: string;
  link: string;
};

export async function GET() {
  try {
    if (!requireAdminSession()) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    await ensureSchema();

    const result = await dbQuery<UserRow>(
      `
      SELECT id, nome, email, perfil, status
      FROM usuarios
      ORDER BY id DESC
      `,
    );

    const dashboardsResult = await dbQuery<DashboardRow>(
      `
      SELECT id, usuario_id, nome, link
      FROM dashboards
      ORDER BY id ASC
      `,
    );

    const dashboardsByUser = new Map<number, DashboardRow[]>();

    for (const dashboard of dashboardsResult.rows) {
      const current = dashboardsByUser.get(dashboard.usuario_id) ?? [];
      current.push(dashboard);
      dashboardsByUser.set(dashboard.usuario_id, current);
    }

    const users = result.rows.map((user) => ({
      ...user,
      dashboards: dashboardsByUser.get(user.id) ?? [],
    }));

    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao listar usuários." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!requireAdminSession()) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    await ensureSchema();

    const body = (await request.json()) as {
      nome: string;
      email: string;
      senha: string;
      perfil: "Admin" | "User";
      status: "Ativo" | "Inativo";
      dashboards?: DashboardInput[];
    };

    if (!body.nome || !body.email || !body.senha) {
      return NextResponse.json(
        { error: "Nome, email e senha são obrigatórios." },
        { status: 400 },
      );
    }

    const hashedPassword = await bcrypt.hash(body.senha, 10);

    const createdUser = await dbQuery<{ id: number }>(
      `
      INSERT INTO usuarios (nome, email, senha, perfil, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
      `,
      [
        body.nome,
        body.email,
        hashedPassword,
        body.perfil ?? "User",
        body.status ?? "Ativo",
      ],
    );

    const userId = createdUser.rows[0]?.id;
    const dashboards = (body.dashboards ?? []).filter(
      (item) => item.nome.trim() && item.link.trim(),
    );

    for (const dashboard of dashboards) {
      await dbQuery(
        `
        INSERT INTO dashboards (usuario_id, nome, link)
        VALUES ($1, $2, $3)
        `,
        [userId, dashboard.nome.trim(), dashboard.link.trim()],
      );
    }

    return NextResponse.json({ message: "Usuário criado com sucesso." }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar usuário." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    if (!requireAdminSession()) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    await ensureSchema();

    const body = (await request.json()) as {
      id: number;
      nome: string;
      email: string;
      senha?: string;
      perfil: "Admin" | "User";
      status: "Ativo" | "Inativo";
      dashboards?: DashboardInput[];
    };

    if (!body.id) {
      return NextResponse.json({ error: "ID do usuário é obrigatório." }, { status: 400 });
    }

    if (body.senha && body.senha.trim().length > 0) {
      const hashedPassword = await bcrypt.hash(body.senha, 10);
      await dbQuery(
        `
        UPDATE usuarios
        SET nome = $1, email = $2, senha = $3, perfil = $4, status = $5
        WHERE id = $6
        `,
        [
          body.nome,
          body.email,
          hashedPassword,
          body.perfil,
          body.status,
          body.id,
        ],
      );
    } else {
      await dbQuery(
        `
        UPDATE usuarios
        SET nome = $1, email = $2, perfil = $3, status = $4
        WHERE id = $5
        `,
        [body.nome, body.email, body.perfil, body.status, body.id],
      );
    }

    await dbQuery("DELETE FROM dashboards WHERE usuario_id = $1", [body.id]);

    const dashboards = (body.dashboards ?? []).filter(
      (item) => item.nome.trim() && item.link.trim(),
    );

    for (const dashboard of dashboards) {
      await dbQuery(
        `
        INSERT INTO dashboards (usuario_id, nome, link)
        VALUES ($1, $2, $3)
        `,
        [body.id, dashboard.nome.trim(), dashboard.link.trim()],
      );
    }

    return NextResponse.json({ message: "Usuário atualizado com sucesso." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar usuário." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if (!requireAdminSession()) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    await ensureSchema();

    const { searchParams } = new URL(request.url);
    const id = Number.parseInt(searchParams.get("id") ?? "", 10);

    if (!id) {
      return NextResponse.json({ error: "ID do usuário é obrigatório." }, { status: 400 });
    }

    await dbQuery("DELETE FROM usuarios WHERE id = $1", [id]);

    return NextResponse.json({ message: "Usuário removido com sucesso." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao remover usuário." },
      { status: 500 },
    );
  }
}
