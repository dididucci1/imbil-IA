export type FinancialIndicator =
  | "EBITDA"
  | "ROE"
  | "PATRIMONIO_LIQUIDO"
  | "EBITDA_12M"
  | "EBITDA_6M";

export type ChatRequest = {
  question: string;
};

export type ChatResponse = {
  indicator: FinancialIndicator;
  answer: string;
  value: number | null;
  spokenAnswer?: string;
};
