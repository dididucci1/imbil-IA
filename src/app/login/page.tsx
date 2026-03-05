import { LoginForm } from "@/components/LoginForm";
import { getServerSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default function LoginPage() {
  const session = getServerSession();

  if (session) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <LoginForm />
    </div>
  );
}
