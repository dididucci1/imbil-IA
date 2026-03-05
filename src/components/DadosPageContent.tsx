"use client";

import { useState } from "react";

import { DreTable } from "@/components/DreTable";
import { Header } from "@/components/Header";
import { UploadCsv } from "@/components/UploadCsv";

export function DadosPageContent() {
  const [refreshToken, setRefreshToken] = useState(0);
  const [stats, setStats] = useState<{ total: number; lastUpdate: string | null }>({
    total: 0,
    lastUpdate: null,
  });

  return (
    <div>
      <Header title="Dados" subtitle="Upload, processamento e análise dos registros de DRE" />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Total de registros</p>
          <p className="mt-1 text-3xl font-bold text-slate-800">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Última atualização</p>
          <p className="mt-1 text-3xl font-bold text-slate-800">{stats.lastUpdate ?? "-"}</p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <UploadCsv onUploaded={() => setRefreshToken((current) => current + 1)} />
      </div>

      <DreTable refreshToken={refreshToken} onStatsChange={setStats} />
    </div>
  );
}
