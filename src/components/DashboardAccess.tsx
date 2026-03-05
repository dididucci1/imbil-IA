"use client";

import { useEffect, useState } from "react";

import type { SessionUser } from "@/types/session";

type DashboardAccessProps = {
  session: SessionUser;
};

type DashboardOption = {
  id: number;
  usuario_id: number;
  usuario_nome?: string;
  nome: string;
  link: string;
};

export function DashboardAccess({ session }: DashboardAccessProps) {
  const [dashboards, setDashboards] = useState<DashboardOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLink, setSelectedLink] = useState("");

  useEffect(() => {
    async function loadDashboards() {
      setLoading(true);
      const response = await fetch("/api/dashboards");
      const data = await response.json();

      if (!response.ok) {
        setDashboards([]);
        setSelectedLink("");
        setLoading(false);
        return;
      }

      const options = (data.dashboards ?? []) as DashboardOption[];

      setDashboards(options);
      setSelectedLink(options[0]?.link ?? "");
      setLoading(false);
    }

    void loadDashboards();
  }, []);

  const emptyMessage = session.perfil === "Admin"
    ? "Nenhum dashboard cadastrado. Cadastre na tela de Usuários."
    : "Nenhum dashboard vinculado ao seu usuário.";

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <select
          value={selectedLink}
          onChange={(event) => setSelectedLink(event.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm md:max-w-md"
        >
          {dashboards.length === 0 ? (
            <option value="">{loading ? "Carregando dashboards..." : "Nenhum dashboard disponível"}</option>
          ) : (
            dashboards.map((item) => (
              <option key={item.id} value={item.link}>
                {session.perfil === "Admin" && item.usuario_nome
                  ? `${item.usuario_nome} — ${item.nome}`
                  : item.nome}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
        {selectedLink ? (
          <iframe
            title="Dashboard Power BI"
            src={selectedLink}
            className="h-full w-full"
            allowFullScreen
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
            {loading ? "Carregando dashboards..." : emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
}
