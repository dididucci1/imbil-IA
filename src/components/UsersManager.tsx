"use client";

import { FormEvent, useEffect, useState } from "react";

type UserDashboard = {
  id?: number;
  nome: string;
  link: string;
};

type User = {
  id: number;
  nome: string;
  email: string;
  perfil: "Admin" | "User";
  status: "Ativo" | "Inativo";
  dashboards: UserDashboard[];
};

type FormState = {
  id?: number;
  nome: string;
  email: string;
  senha: string;
  perfil: "Admin" | "User";
  status: "Ativo" | "Inativo";
  dashboards: UserDashboard[];
};

const initialForm: FormState = {
  nome: "",
  email: "",
  senha: "",
  perfil: "User",
  status: "Ativo",
  dashboards: [{ nome: "", link: "" }],
};

export function UsersManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetchUsers();
  }, []);

  async function fetchUsers() {
    const response = await fetch("/api/users");
    const data = await response.json();
    setUsers(data.users ?? []);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);

    const method = form.id ? "PUT" : "POST";
    const payload = { ...form };

    const response = await fetch("/api/users", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (response.ok) {
      setForm(initialForm);
      await fetchUsers();
    }
  }

  async function removeUser(id: number) {
    await fetch(`/api/users?id=${id}`, { method: "DELETE" });
    await fetchUsers();
  }

  function editUser(user: User) {
    setForm({
      id: user.id,
      nome: user.nome,
      email: user.email,
      senha: "",
      perfil: user.perfil,
      status: user.status,
      dashboards:
        user.dashboards && user.dashboards.length > 0
          ? user.dashboards.map((dashboard) => ({ nome: dashboard.nome, link: dashboard.link }))
          : [{ nome: "", link: "" }],
    });
  }

  function addDashboardField() {
    setForm((prev) => ({
      ...prev,
      dashboards: [...prev.dashboards, { nome: "", link: "" }],
    }));
  }

  function removeDashboardField(index: number) {
    setForm((prev) => {
      const nextDashboards = prev.dashboards.filter((_, currentIndex) => currentIndex !== index);
      return {
        ...prev,
        dashboards: nextDashboards.length > 0 ? nextDashboards : [{ nome: "", link: "" }],
      };
    });
  }

  function updateDashboardField(index: number, key: "nome" | "link", value: string) {
    setForm((prev) => {
      const nextDashboards = [...prev.dashboards];
      nextDashboards[index] = { ...nextDashboards[index], [key]: value };
      return { ...prev, dashboards: nextDashboards };
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 text-lg font-semibold text-slate-800">Cadastro de Usuário</h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={form.perfil}
            onChange={(event) => setForm((prev) => ({ ...prev, perfil: event.target.value as "Admin" | "User" }))}
          >
            <option value="Admin">Admin</option>
            <option value="User">User</option>
          </select>

          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={form.status}
            onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as "Ativo" | "Inativo" }))}
          >
            <option value="Ativo">Ativo</option>
            <option value="Inativo">Inativo</option>
          </select>

          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Nome"
            value={form.nome}
            onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
            required
          />

          <input
            type="email"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            required
          />

          <input
            type="password"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Senha"
            value={form.senha}
            onChange={(event) => setForm((prev) => ({ ...prev, senha: event.target.value }))}
            required={!form.id}
          />

        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-700">Dashboards do usuário</h4>
            <button
              type="button"
              onClick={addDashboardField}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              + Adicionar dashboard
            </button>
          </div>

          <div className="space-y-3">
            {form.dashboards.map((dashboard, index) => (
              <div key={`dashboard-${index}`} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_2fr_auto]">
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Nome do dashboard"
                  value={dashboard.nome}
                  onChange={(event) => updateDashboardField(index, "nome", event.target.value)}
                />
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="https://app.powerbi.com/view/..."
                  value={dashboard.link}
                  onChange={(event) => updateDashboardField(index, "link", event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeDashboardField(index)}
                  className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {form.id ? "Salvar edição" : "Cadastrar usuário"}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Perfil</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Dashboards</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{user.nome}</td>
                <td className="px-3 py-2">{user.email}</td>
                <td className="px-3 py-2">{user.perfil}</td>
                <td className="px-3 py-2">{user.status}</td>
                <td className="px-3 py-2">
                  {user.dashboards && user.dashboards.length > 0 ? (
                    <div className="space-y-1">
                      {user.dashboards.map((dashboard, index) => (
                        <a
                          key={`${user.id}-dashboard-${index}`}
                          href={dashboard.link}
                          target="_blank"
                          className="block text-red-600 hover:underline"
                          rel="noreferrer"
                        >
                          {dashboard.nome}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400">Sem dashboards</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => editUser(user)}
                      className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => void removeUser(user.id)}
                      className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
