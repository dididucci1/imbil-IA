export type DreRecord = {
  conta: string | null;
  id1: string | null;
  id2: string | null;
  id3: string | null;
  data: string | null;
  valor: number | null;
};

export type DreQueryParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: "data" | "conta" | "id1" | "id2" | "id3" | "valor";
  sortOrder?: "asc" | "desc";
};
