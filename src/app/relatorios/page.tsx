import { redirect } from "next/navigation";

import { RelatoriosContent } from "@/components/RelatoriosContent";
import { getServerSession } from "@/lib/session";

export default function RelatoriosPage() {
  const session = getServerSession();

  if (!session) {
    redirect("/login");
  }

  return <RelatoriosContent />;
}
