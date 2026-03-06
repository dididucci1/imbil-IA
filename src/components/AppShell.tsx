"use client";

import { usePathname } from "next/navigation";

import { Sidebar } from "@/components/Sidebar";
import type { SessionUser } from "@/types/session";

type AppShellProps = {
  children: React.ReactNode;
  session: SessionUser | null;
};

export function AppShell({ children, session }: AppShellProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <main className="min-h-screen bg-slate-100">{children}</main>;
  }

  return (
    <>
      <Sidebar session={session} />
      <main className="h-screen overflow-hidden bg-slate-100 pl-72">
        <div className="h-full overflow-hidden pl-3 pr-6 py-3 md:py-6">{children}</div>
      </main>
    </>
  );
}
