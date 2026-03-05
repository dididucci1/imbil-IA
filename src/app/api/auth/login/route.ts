import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { dbQuery } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { serializeSession, sessionCookieName } from "@/lib/session";

type LoginUserRow = {
  id: number;
  nome: string;
  email: string;
  senha: string;
  perfil: "Admin" | "User";
  status: "Ativo" | "Inativo";
};

export async function POST(request: Request) {
  try {
    await ensureSchema();

    const body = (await request.json()) as { email?: string; senha?: string };

    if (!body.email || !body.senha) {
      return NextResponse.json({ error: "Email e senha são obrigatórios." }, { status: 400 });
    }

    const result = await dbQuery<LoginUserRow>(
      `
      SELECT id, nome, email, senha, perfil, status
      FROM usuarios
      WHERE email = $1
      LIMIT 1
      `,
      [body.email.trim().toLowerCase()],
    );

    const user = result.rows[0];

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 401 });
    }

    if (user.status !== "Ativo") {
      return NextResponse.json({ error: "Usuário inativo." }, { status: 403 });
    }

    const isValidPassword = await bcrypt.compare(body.senha, user.senha);

    if (!isValidPassword) {
      return NextResponse.json({ error: "Senha inválida." }, { status: 401 });
    }

    const token = serializeSession({
      id: user.id,
      nome: user.nome,
      email: user.email,
      perfil: user.perfil,
      status: user.status,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        perfil: user.perfil,
        status: user.status,
      },
    });

    response.cookies.set(sessionCookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao autenticar." },
      { status: 500 },
    );
  }
}
