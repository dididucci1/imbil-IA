import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/session";

export async function GET() {
  const session = getServerSession();

  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  return NextResponse.json({ user: session });
}
