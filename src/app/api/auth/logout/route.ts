import { NextResponse } from "next/server";

import { sessionCookieName } from "@/lib/session";

export async function POST() {
  const response = NextResponse.json({ message: "Logout realizado com sucesso." });

  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });

  return response;
}
