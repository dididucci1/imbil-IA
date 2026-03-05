import { getServerSession } from "@/lib/session";

export function requireSession() {
  return getServerSession();
}

export function requireAdminSession() {
  const session = getServerSession();
  if (!session) return null;
  if (session.perfil !== "Admin") return null;
  return session;
}
