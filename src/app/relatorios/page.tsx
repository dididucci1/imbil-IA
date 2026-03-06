import { redirect } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { RelatoriosContent } from "@/components/RelatoriosContent";
import { getServerSession } from "@/lib/session";

export default function RelatoriosPage() {
  const session = getServerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <AppShell session={session}>
      <RelatoriosContent />
    </AppShell>
  );
}
