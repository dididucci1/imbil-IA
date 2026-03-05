import { parse } from "csv-parse/sync";

type CsvRow = {
  conta: string | null;
  id1: string | null;
  id2: string | null;
  id3: string | null;
  data: string | null;
  valor: number | null;
};

const MONTH_MAP: Record<string, string> = {
  jan: "01",
  fev: "02",
  mar: "03",
  abr: "04",
  mai: "05",
  jun: "06",
  jul: "07",
  ago: "08",
  set: "09",
  out: "10",
  nov: "11",
  dez: "12",
};

function cleanText(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
}

function normalizeHeaderName(value: string) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function stripExcelSeparatorDirective(csvContent: string) {
  return csvContent.replace(/^\uFEFF?sep\s*=\s*[;,\t]\r?\n/i, "");
}

function detectDelimiter(csvContent: string): ";" | "," | "\t" {
  const firstLine = csvContent.split(/\r?\n/, 1)[0] ?? "";
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const tabCount = (firstLine.match(/\t/g) ?? []).length;

  if (tabCount > semicolonCount && tabCount > commaCount) return "\t";

  if (semicolonCount > commaCount) return ";";
  return ",";
}

function normalizeDate(input: string): string {
  const value = cleanText(input).toLowerCase();
  const match = value.match(/^(\d{1,2})[\/-]([a-z]{3}|\d{1,2})[\/-](\d{2,4})$/i);

  if (!match) {
    const tryDate = new Date(value);
    if (Number.isNaN(tryDate.getTime())) {
      throw new Error(`Data inválida: ${input}`);
    }
    return tryDate.toISOString().split("T")[0];
  }

  const day = match[1].padStart(2, "0");
  const monthRaw = match[2].toLowerCase();
  const month = MONTH_MAP[monthRaw] ?? monthRaw.padStart(2, "0");
  const yearRaw = match[3];
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;

  return `${year}-${month}-${day}`;
}

function normalizeNumber(input: string): number {
  const clean = cleanText(input)
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/[^\d.-]/g, "");

  const value = Number.parseFloat(clean);
  if (Number.isNaN(value)) {
    throw new Error(`Valor inválido: ${input}`);
  }

  return value;
}

function normalizeDateOrNull(input: string): string | null {
  const clean = cleanText(input);
  if (!clean) return null;

  try {
    return normalizeDate(clean);
  } catch {
    return null;
  }
}

function normalizeNumberOrNull(input: string): number | null {
  const clean = cleanText(input);
  if (!clean) return null;

  try {
    return normalizeNumber(clean);
  } catch {
    return null;
  }
}

export function parseDreCsv(csvContent: string): CsvRow[] {
  const normalizedContent = stripExcelSeparatorDirective(csvContent);

  if (!normalizedContent.trim()) {
    throw new Error("Arquivo CSV vazio.");
  }

  const delimiters: Array<";" | "," | "\t"> = [detectDelimiter(normalizedContent), ";", "\t", ","]
    .filter((value, index, source) => source.indexOf(value) === index) as Array<";" | "," | "\t">;

  let records: string[][] | null = null;

  for (const delimiter of delimiters) {
    try {
      const parsed = parse(normalizedContent, {
        bom: true,
        columns: false,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        delimiter,
      }) as string[][];

      if (parsed.length >= 2) {
        records = parsed;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!records || records.length < 2) {
    throw new Error("CSV inválido ou sem linhas de dados.");
  }

  const header = records[0].map((cell) => normalizeHeaderName(cell));

  function findHeaderIndex(aliases: string[]) {
    return header.findIndex((cell) => aliases.includes(cell));
  }

  const contaIndex = findHeaderIndex(["conta"]);
  const id1Index = findHeaderIndex(["id1", "grupo"]);
  const id2Index = findHeaderIndex(["id2", "subgrupo"]);
  const id3Index = findHeaderIndex(["id3", "categoria"]);
  const dataIndex = findHeaderIndex(["data", "periodo", "atributo"]);
  const valorIndex = findHeaderIndex(["valor"]);

  if (contaIndex === -1 || dataIndex === -1 || valorIndex === -1) {
    throw new Error("Cabeçalho inválido. Esperado: Conta, ID 1, ID 2, ID 3, Atributo/Data e Valor.");
  }

  const output: CsvRow[] = [];

  for (let rowIndex = 1; rowIndex < records.length; rowIndex += 1) {
    const row = records[rowIndex];

    const contaRaw = cleanText(row[contaIndex]);
    const dataRaw = cleanText(row[dataIndex]);
    const valorRaw = cleanText(row[valorIndex]);
    const id1 = id1Index >= 0 ? cleanText(row[id1Index]) || null : null;
    const id2 = id2Index >= 0 ? cleanText(row[id2Index]) || null : null;
    const id3 = id3Index >= 0 ? cleanText(row[id3Index]) || null : null;

    if (!contaRaw && !dataRaw && !valorRaw && !id1 && !id2 && !id3) {
      continue;
    }

    output.push({
      conta: contaRaw || null,
      id1,
      id2,
      id3,
      data: normalizeDateOrNull(dataRaw),
      valor: normalizeNumberOrNull(valorRaw),
    });
  }

  if (output.length === 0) {
    throw new Error("Nenhum registro válido encontrado no CSV.");
  }

  return output;
}
