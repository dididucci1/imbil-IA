import { ChatFinanceiro } from "@/components/ChatFinanceiro";
import { DashboardAccess } from "@/components/DashboardAccess";
import { getServerSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default function Home() {
  const session = getServerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="h-full min-h-0">
      <div className="grid h-full min-h-0 grid-cols-1 items-stretch gap-6 xl:grid-cols-3">
        <section className="flex h-full min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-6 xl:col-span-2">
          <h3 className="mb-4 text-3xl font-bold text-slate-800">Dashboard</h3>

          <DashboardAccess session={session} />
        </section>

        <ChatFinanceiro />
      </div>
    </div>
  );
}
