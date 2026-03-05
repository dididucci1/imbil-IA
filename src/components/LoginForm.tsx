"use client";

import { FormEvent, useState } from "react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Falha ao autenticar.");
      }

      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado no login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="mb-2 text-2xl font-bold text-slate-800">Acessar Painel</h1>
      <p className="mb-6 text-sm text-slate-500">Entre com seu usuário para acessar o sistema.</p>

      <div className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-red-500 focus:ring"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Senha"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-red-500 focus:ring"
          value={senha}
          onChange={(event) => setSenha(event.target.value)}
          required
        />
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
