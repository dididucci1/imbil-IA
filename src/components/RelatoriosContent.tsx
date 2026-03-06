"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

type ChartData = {
  ano: number;
  ebitda?: number;
  roe?: number;
};

const MONTHS = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];

export function RelatoriosContent() {
  const [selectedMonth, setSelectedMonth] = useState(1);
  const [yearFrom, setYearFrom] = useState(2020);
  const [yearTo, setYearTo] = useState(2025);
  const [ebitdaData, setEbitdaData] = useState<ChartData[]>([]);
  const [roeData, setRoeData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [chartHeight, setChartHeight] = useState(300);
  const chartsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateChartHeight = () => {
      setChartHeight(window.innerWidth < 768 ? 200 : 300);
    };
    
    updateChartHeight();
    window.addEventListener('resize', updateChartHeight);
    return () => window.removeEventListener('resize', updateChartHeight);
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const response = await fetch(`/api/relatorios?month=${selectedMonth}&yearFrom=${yearFrom}&yearTo=${yearTo}`);
      if (!response.ok) throw new Error("Erro ao carregar dados");
      
      const data = await response.json();
      setEbitdaData(data.ebitda);
      setRoeData(data.roe);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      alert("Erro ao carregar dados dos relatórios");
    } finally {
      setLoading(false);
    }
  }

  async function generatePDF() {
    if (!chartsRef.current) return;
    
    setGeneratingPdf(true);
    try {
      const canvas = await html2canvas(chartsRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Adicionar título
      pdf.setFontSize(18);
      const monthName = MONTHS.find(m => m.value === selectedMonth)?.label || "";
      pdf.text(`Relatório de EBITDA e ROE - ${monthName} (${yearFrom} a ${yearTo})`, pdfWidth / 2, 15, { align: "center" });
      
      // Adicionar gráficos
      pdf.addImage(imgData, "PNG", 10, 25, imgWidth, Math.min(imgHeight, pdfHeight - 35));
      
      // Salvar PDF
      pdf.save(`relatorio-${monthName.toLowerCase()}-${yearFrom}-${yearTo}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Erro ao gerar PDF");
    } finally {
      setGeneratingPdf(false);
    }
  }

  const monthName = MONTHS.find(m => m.value === selectedMonth)?.label || "";

  // Função para formatar números no padrão brasileiro
  const formatNumber = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(value));
  };

  const formatPercent = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value) + '%';
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800">Relatórios Financeiros</h2>
          <p className="text-xs md:text-sm text-slate-600">Comparativo anual de EBITDA e ROE</p>
        </div>
        
        <div className="flex flex-wrap items-end gap-2 md:gap-4 w-full lg:w-auto">
          <div className="flex-1 min-w-[120px] sm:flex-initial">
            <label className="block text-xs md:text-sm font-semibold text-slate-700 mb-2">
              Mês:
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 md:px-4 py-2 text-xs md:text-sm font-medium outline-none ring-red-500 focus:ring"
            >
              {MONTHS.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[100px] sm:flex-initial">
            <label className="block text-xs md:text-sm font-semibold text-slate-700 mb-2">
              De:
            </label>
            <select
              value={yearFrom}
              onChange={(e) => setYearFrom(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 md:px-4 py-2 text-xs md:text-sm font-medium outline-none ring-red-500 focus:ring"
            >
              {YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[100px] sm:flex-initial">
            <label className="block text-xs md:text-sm font-semibold text-slate-700 mb-2">
              Até:
            </label>
            <select
              value={yearTo}
              onChange={(e) => setYearTo(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 md:px-4 py-2 text-xs md:text-sm font-medium outline-none ring-red-500 focus:ring"
            >
              {YEARS.filter(y => y >= yearFrom).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          
          <button
            onClick={loadData}
            disabled={loading}
            className="flex-1 sm:flex-initial rounded-lg bg-blue-600 px-4 md:px-6 py-2 text-xs md:text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? "Carregando..." : "📊 Gerar Gráficos"}
          </button>
          
          {(ebitdaData.length > 0 || roeData.length > 0) && (
            <button
              onClick={generatePDF}
              disabled={generatingPdf || loading}
              className="flex-1 sm:flex-initial rounded-lg bg-red-600 px-4 md:px-6 py-2 text-xs md:text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
            >
              {generatingPdf ? "Gerando PDF..." : "📄 Gerar PDF"}
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-slate-600">Carregando dados...</div>
        </div>
      )}

      {!loading && (ebitdaData.length > 0 || roeData.length > 0) && (
        <div ref={chartsRef} className="space-y-4 md:space-y-8 rounded-xl border border-slate-200 bg-white p-3 md:p-8">
          {/* Gráfico EBITDA */}
          <div>
            <h3 className="mb-2 md:mb-4 text-sm md:text-lg font-semibold text-slate-800">
              EBITDA - {monthName} (Comparativo Anual)
            </h3>
            {ebitdaData.length === 0 ? (
              <div className="flex items-center justify-center py-6 md:py-12 text-xs md:text-sm text-slate-500">
                Nenhum dado disponível para o mês selecionado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={ebitdaData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ano" />
                  <YAxis hide />
                  <Tooltip 
                    formatter={(value: number | undefined) => 
                      value !== undefined ? formatNumber(value) : ""
                    }
                  />
                  <Legend />
                  <Bar dataKey="ebitda" name="EBITDA" fill="#dc2626">
                    <LabelList 
                      dataKey="ebitda" 
                      position="top" 
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any) => 
                        value != null ? formatNumber(value) : ""
                      }
                      style={{ fontSize: '11px', fontWeight: 'bold', fill: '#1f2937' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Gráfico ROE */}
          <div>
            <h3 className="mb-2 md:mb-4 text-sm md:text-lg font-semibold text-slate-800">
              ROE - {monthName} (Comparativo Anual)
            </h3>
            {roeData.length === 0 ? (
              <div className="flex items-center justify-center py-6 md:py-12 text-xs md:text-sm text-slate-500">
                Nenhum dado disponível para o mês selecionado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={roeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ano" />
                  <YAxis hide />
                  <Tooltip 
                    formatter={(value: number | undefined) => 
                      value !== undefined ? formatPercent(value) : ""
                    }
                  />
                  <Legend />
                  <Bar dataKey="roe" name="ROE (%)" fill="#059669">
                    <LabelList 
                      dataKey="roe" 
                      position="top" 
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any) => 
                        value != null ? formatPercent(value) : ""
                      }
                      style={{ fontSize: '11px', fontWeight: 'bold', fill: '#1f2937' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
