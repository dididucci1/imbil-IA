"use client";

import { FormEvent, useState } from "react";

type Message = {
  role: "user" | "assistant";
  text: string;
};

export function ChatFinanceiro() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Faça perguntas como: Qual o EBITDA em Jan/25? ou Qual o ROE do último mês?",
    },
  ]);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;

    const userMessage = question;
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat-financeiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userMessage }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Falha ao consultar chat financeiro.");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.answer,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: error instanceof Error ? error.message : "Erro inesperado no chat.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-lg font-semibold text-slate-800">Chat Financeiro</h3>

      <div className="mb-3 min-h-0 flex-1 space-y-3 overflow-auto rounded-lg bg-slate-50 p-3">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
              message.role === "user"
                ? "ml-8 bg-red-600 text-white"
                : "mr-8 bg-white text-slate-700"
            }`}
          >
            {message.text}
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-2">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Digite sua pergunta sobre a DRE"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-red-500 focus:ring"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "Consultando..." : "Perguntar"}
        </button>
      </form>
    </section>
  );
}
