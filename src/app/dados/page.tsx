import { DadosPageContent } from "@/components/DadosPageContent";
import { getServerSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default function DadosPage() {
  const session = getServerSession();

  if (!session) {
    redirect("/login");
  }

  if (session.perfil !== "Admin") {
    redirect("/");
  }

  return <DadosPageContent />;
}
