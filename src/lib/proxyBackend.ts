import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "https://imbil-backend.fly.dev";

export async function proxyToBackend(
  request: Request,
  endpoint: string,
  options: RequestInit = {}
): Promise<NextResponse> {
  try {
    const url = `${BACKEND_URL}${endpoint}`;
    const cookieHeader = request.headers.get("cookie");

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
    });

    const contentType = response.headers.get("content-type");
    let data;

    if (contentType?.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    const nextResponse = NextResponse.json(data, { status: response.status });

    // Repassa cookies do backend
    const setCookieHeader = response.headers.get("set-cookie");
    if (setCookieHeader) {
      nextResponse.headers.set("set-cookie", setCookieHeader);
    }

    return nextResponse;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao comunicar com o backend." },
      { status: 500 }
    );
  }
}
