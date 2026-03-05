"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type DreRow = {
  conta: string | null;
  id1: string | null;
  id2: string | null;
  id3: string | null;
  data: string | null;
  valor: number | null;
};

type DreResponse = {
  rows: DreRow[];
  total: number;
  page: number;
  pageSize: number;
  lastUpdate: string | null;
};

type DreTableProps = {
  refreshToken: number;
  onStatsChange: (stats: { total: number; lastUpdate: string | null }) => void;
};

const columns: Array<{ key: keyof DreRow; label: string }> = [
  { key: "data", label: "Período" },
  { key: "conta", label: "Conta" },
  { key: "id1", label: "Grupo" },
  { key: "id2", label: "Subgrupo" },
  { key: "id3", label: "Categoria" },
  { key: "valor", label: "Valor" },
];

export function DreTable({ refreshToken, onStatsChange }: DreTableProps) {
  const [rows, setRows] = useState<DreRow[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<keyof DreRow>("data");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [visibleColumns, setVisibleColumns] = useState<Array<keyof DreRow>>(
    columns.map((column) => column.key),
  );

  const fetchData = useCallback(async () => {
    try {
      const query = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search,
        sortBy,
        sortOrder,
      });

      const response = await fetch(`/api/dre?${query.toString()}`, { cache: "no-store" });
      const data = (await response.json()) as Partial<DreResponse> & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Falha ao buscar dados da DRE.");
      }

      const safeRows = Array.isArray(data.rows) ? data.rows : [];
      const safeTotal =
        typeof data.total === "number"
          ? data.total
          : typeof data.total === "string"
            ? Number.parseInt(data.total, 10) || 0
            : 0;
      const safeLastUpdate = data.lastUpdate ?? null;

      setErrorMessage(null);
      setRows(safeRows);
      setTotal(safeTotal);
      setLastUpdate(safeLastUpdate);
      onStatsChange({ total: safeTotal, lastUpdate: safeLastUpdate });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao carregar dados.";
      setErrorMessage(message);
      setRows([]);
      setTotal(0);
      setLastUpdate(null);
      onStatsChange({ total: 0, lastUpdate: null });
    }
  }, [onStatsChange, page, pageSize, search, sortBy, sortOrder]);

  useEffect(() => {
    void fetchData();
  }, [fetchData, refreshToken]);

  async function clearData() {
    const confirmation = window.prompt('Para remover todos os dados, digite "REMOVER".');
    if (confirmation !== "REMOVER") {
      return;
    }

    const response = await fetch("/api/dre", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "REMOVER" }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "Falha ao remover dados.");
    }

    setPage(1);
    await fetchData();
  }

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const visibleColumnsConfig = useMemo(
    () => columns.filter((column) => visibleColumns.includes(column.key)),
    [visibleColumns],
  );

  function toggleColumn(columnKey: keyof DreRow) {
    setVisibleColumns((current) => {
      if (current.includes(columnKey)) {
        if (current.length === 1) {
          return current;
        }

        return current.filter((key) => key !== columnKey);
      }

      return columns
        .map((column) => column.key)
        .filter((key) => current.includes(key) || key === columnKey);
    });
  }

  function renderCellValue(row: DreRow, key: keyof DreRow) {
    if (key === "valor") {
      if (row.valor === null || row.valor === undefined) {
        return "-";
      }

      return Number(row.valor).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }

    return row[key] ?? "-";
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full flex-col gap-2 md:w-auto">
          <input
            placeholder="Buscar conta, grupo, subgrupo..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-red-500 focus:ring md:w-80"
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
          />

          <details className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 md:w-80">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              Selecionar colunas
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {columns.map((column) => {
                const checked = visibleColumns.includes(column.key);

                return (
                  <label key={column.key} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleColumn(column.key)}
                    />
                    {column.label}
                  </label>
                );
              })}
            </div>
          </details>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => void fetchData()}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Recarregar
          </button>
          <button
            onClick={() => {
              void clearData().catch((error) => {
                const message = error instanceof Error ? error.message : "Erro ao remover dados.";
                setErrorMessage(message);
              });
            }}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Remover dados
          </button>
        </div>
      </div>

      {errorMessage && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {visibleColumnsConfig.map((column) => (
                <th key={column.key} className="px-3 py-2 font-semibold">
                  <button
                    className="flex items-center gap-1"
                    onClick={() => {
                      if (sortBy === column.key) {
                        setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
                      } else {
                        setSortBy(column.key);
                        setSortOrder("asc");
                      }
                    }}
                  >
                    {column.label}
                    {sortBy === column.key ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-t border-slate-100">
                <td colSpan={visibleColumnsConfig.length} className="px-3 py-6 text-center text-slate-500">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={`${row.conta}-${row.data}-${index}`} className="border-t border-slate-100">
                  {visibleColumnsConfig.map((column) => (
                    <td key={column.key} className="px-3 py-2">
                      {renderCellValue(row, column.key)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
        <p>
          Total: {total} | Última atualização: {lastUpdate ?? "-"}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"
            disabled={page === 1}
          >
            Anterior
          </button>
          <span>
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"
            disabled={page >= totalPages}
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
