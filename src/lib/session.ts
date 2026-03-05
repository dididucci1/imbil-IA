import { cookies } from "next/headers";

import type { SessionUser } from "@/types/session";

const SESSION_COOKIE = "finance_session";

function toBase64Url(value: string) {
  return Buffer.from(value, "utf-8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf-8");
}

export function serializeSession(user: Omit<SessionUser, "expiresAt">, maxAgeSeconds = 60 * 60 * 12) {
  const payload: SessionUser = {
    ...user,
    expiresAt: Date.now() + maxAgeSeconds * 1000,
  };

  return toBase64Url(JSON.stringify(payload));
}

export function deserializeSession(token: string | undefined): SessionUser | null {
  if (!token) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(token)) as SessionUser;

    if (!parsed?.id || !parsed?.perfil || !parsed?.expiresAt) {
      return null;
    }

    if (Date.now() > parsed.expiresAt) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function getServerSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return deserializeSession(token);
}

export const sessionCookieName = SESSION_COOKIE;
