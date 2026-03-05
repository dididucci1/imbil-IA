import { Header } from "@/components/Header";
import { UsersManager } from "@/components/UsersManager";
import { getServerSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default function UsuariosPage() {
  const session = getServerSession();

  if (!session) {
    redirect("/login");
  }

  if (session.perfil !== "Admin") {
    redirect("/");
  }

  return (
    <div>
      <Header title="Usuários" subtitle="Gerenciamento de perfis e links de dashboard" />
      <UsersManager />
    </div>
  );
}
