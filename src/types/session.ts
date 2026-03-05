export type SessionUser = {
  id: number;
  nome: string;
  email: string;
  perfil: "Admin" | "User";
  status: "Ativo" | "Inativo";
  expiresAt: number;
};
