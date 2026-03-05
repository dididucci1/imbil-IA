import { NextResponse } from "next/server";

import { requireSession } from "@/lib/authGuards";
import { ensureSchema } from "@/lib/schema";
import { processFinancialQuestion } from "@/services/chatFinanceiro";

export async function POST(request: Request) {
  try {
    if (!requireSession()) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    await ensureSchema();

    const body = (await request.json()) as { question?: string };

    if (!body.question || body.question.trim().length === 0) {
      return NextResponse.json({ error: "Pergunta é obrigatória." }, { status: 400 });
    }

    const response = await processFinancialQuestion(body.question);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao processar pergunta financeira.",
      },
      { status: 500 },
    );
  }
}
