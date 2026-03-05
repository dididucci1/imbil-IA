"use client";

import { DragEvent, useEffect, useRef, useState } from "react";

type UploadCsvProps = {
  onUploaded: () => void;
};

export function UploadCsv({ onUploaded }: UploadCsvProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [targetBase, setTargetBase] = useState<"dre" | "balancete">("dre");
  const [importMode, setImportMode] = useState<"window" | "full">("window");

  function stopProgressPolling() {
    if (progressTimerRef.current !== null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }

  async function fetchProgress(jobId: string, targetLabel: string) {
    const response = await fetch(`/api/upload-status?jobId=${encodeURIComponent(jobId)}`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    const totalRows = data.total_rows ?? 0;
    const insertedRows = data.inserted_rows ?? 0;

    if (data.status === "processing") {
      setMessage(
        `${targetLabel}: ${data.message ?? "Processando..."} (${insertedRows}/${totalRows})`,
      );
      return;
    }

    if (data.status === "done") {
      setMessage(`${targetLabel}: importação concluída (${insertedRows}/${totalRows}).`);
      stopProgressPolling();
      return;
    }

    if (data.status === "error") {
      setMessage(`${targetLabel}: erro na importação - ${data.error ?? "verifique o arquivo."}`);
      stopProgressPolling();
    }
  }

  function startProgressPolling(jobId: string, targetLabel: string) {
    stopProgressPolling();
    void fetchProgress(jobId, targetLabel);

    progressTimerRef.current = window.setInterval(() => {
      void fetchProgress(jobId, targetLabel);
    }, 700);
  }

  useEffect(() => {
    return () => {
      stopProgressPolling();
    };
  }, []);

  async function sendFile(file: File) {
    setIsUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("importMode", importMode);

      const uploadEndpoint = targetBase === "dre" ? "/api/upload-csv" : "/api/upload-balancete";
      const targetLabel = targetBase === "dre" ? "DRE" : "Balancete";
      const jobId = crypto.randomUUID();
      formData.append("jobId", jobId);

      startProgressPolling(jobId, targetLabel);

      const response = await fetch(uploadEndpoint, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Falha no upload do CSV.");
      }

      stopProgressPolling();

      const scopeLabel = data.importMode === "full"
        ? "base inteira substituída"
        : `${data.deletedRows ?? 0} removidos dos últimos ${data.monthsWindow ?? 6} meses`;

      setMessage(
        `${targetLabel}: ${data.inserted} registros importados (${scopeLabel}).`,
      );
      onUploaded();
    } catch (error) {
      stopProgressPolling();
      setMessage(error instanceof Error ? error.message : "Erro no upload.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files[0];
    if (file) void sendFile(file);
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <label htmlFor="target-base" className="text-sm font-medium text-slate-700">
          Base de destino
        </label>
        <select
          id="target-base"
          value={targetBase}
          onChange={(event) => setTargetBase(event.target.value as "dre" | "balancete")}
          disabled={isUploading}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
        >
          <option value="dre">DRE</option>
          <option value="balancete">Balancete</option>
        </select>
      </div>

      <div className="mb-3 flex items-center gap-3">
        <label htmlFor="import-mode" className="text-sm font-medium text-slate-700">
          Escopo da importação
        </label>
        <select
          id="import-mode"
          value={importMode}
          onChange={(event) => setImportMode(event.target.value as "window" | "full")}
          disabled={isUploading}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
        >
          <option value="window">Sobrescrever últimos 6 meses</option>
          <option value="full">Substituir base inteira (arquivo completo)</option>
        </select>
      </div>

      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {importMode === "full"
          ? "Upload completo: substitui toda a base selecionada"
          : "Sobrescrita automática dos últimos 6 meses"}
      </p>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition ${
          isDragging ? "border-red-500 bg-red-50" : "border-slate-300 bg-white"
        }`}
      >
        <p className="text-sm text-slate-700">
          Arraste e solte seu arquivo CSV aqui
          <br />
          ou clique para selecionar um arquivo
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void sendFile(file);
          }}
        />
      </div>

      {isUploading && <p className="mt-3 text-sm text-slate-500">Processando arquivo com progresso em tempo real...</p>}
      {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
    </div>
  );
}
