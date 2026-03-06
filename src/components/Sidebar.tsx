"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import type { SessionUser } from "@/types/session";
import logoImbil from "../../image.png";

type SidebarProps = {
  session: SessionUser | null;
};

export function Sidebar({ session }: SidebarProps) {
  const pathname = usePathname();
  const [loadingLogout, setLoadingLogout] = useState(false);

  if (!session) {
    return null;
  }

  const menuItems =
    session.perfil === "Admin"
      ? [
          { href: "/", label: "Dashboard" },
          { href: "/dados", label: "Dados" },
          { href: "/relatorios", label: "Relatórios" },
          { href: "/usuarios", label: "Usuários" },
        ]
      : [
          { href: "/", label: "Dashboard" },
          { href: "/relatorios", label: "Relatórios" },
        ];

  async function handleLogout() {
    setLoadingLogout(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-72 border-r border-slate-200 bg-slate-50">
      <div className="flex justify-center border-b border-slate-200 px-6 py-6">
        <Image
          src={logoImbil}
          alt="IMBIL"
          className="h-auto w-48"
          priority
        />
      </div>

      <nav className="px-5 py-6">
        <p className="mb-4 px-2 text-xs font-bold uppercase tracking-wider text-slate-500">Menu</p>

        <div className="space-y-2">
        {menuItems.map((item) => {
          const isActive = item.href !== "#" && pathname === item.href;

          const icon = 
            item.label === "Dashboard" ? "▤" : 
            item.label === "Dados" ? "⛁" : 
            item.label === "Relatórios" ? "▦" :
            "◌";

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                isActive
                  ? "bg-red-600 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span className="text-base">{icon}</span>
              {item.label}
            </Link>
          );
        })}
        </div>

        <p className="mb-4 mt-10 px-2 text-xs font-bold uppercase tracking-wider text-slate-500">Minha conta</p>

        <button
          onClick={() => void handleLogout()}
          disabled={loadingLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-60"
        >
          <span className="text-base">↪</span>
          {loadingLogout ? "Saindo..." : "Sair"}
        </button>
      </nav>
    </aside>
  );
}
