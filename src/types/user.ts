export type UserProfile = "Admin" | "User";
export type UserStatus = "Ativo" | "Inativo";

export type SystemUser = {
  id: number;
  nome: string;
  email: string;
  senha?: string;
  perfil: UserProfile;
  status: UserStatus;
  dashboards?: Array<{
    id?: number;
    nome: string;
    link: string;
  }>;
};
