"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

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
  const [isListening, setIsListening] = useState(false);
  const [currentSpeaking, setCurrentSpeaking] = useState<number | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Carrega vozes disponíveis
    function loadVoices() {
      const availableVoices = window.speechSynthesis.getVoices();
      const portugueseVoices = availableVoices.filter(
        (voice) => voice.lang.startsWith("pt")
      );
      setVoices(portugueseVoices.length > 0 ? portugueseVoices : availableVoices);
      
      // Seleciona voz em português por padrão
      const defaultVoice = portugueseVoices.find(v => v.lang === "pt-BR") || portugueseVoices[0];
      if (defaultVoice) {
        setSelectedVoice(defaultVoice.name);
      }
    }

    if (typeof window !== "undefined" && window.speechSynthesis) {
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Inicializa reconhecimento de voz
    if (typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "pt-BR";

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setQuestion(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  function toggleListening() {
    if (!recognitionRef.current) {
      alert("Reconhecimento de voz não suportado neste navegador.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }

  function processTextForSpeech(text: string): string {
    // Remove "e" entre números para soar mais natural
    // Ex: "8 milhões e 500" -> "8 milhões 500"
    return text
      .replace(/(\d+)\s+e\s+(\d+)/gi, "$1 $2")
      .replace(/(\d+)\s+E\s+(\d+)/g, "$1 $2")
      // Melhora pronúncia de siglas financeiras
      .replace(/EBITDA/g, "é bi ti dá")
      .replace(/ROE/g, "ró i");
  }

  function speakText(text: string, messageIndex: number) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      alert("Síntese de voz não suportada neste navegador.");
      return;
    }

    // Para qualquer fala anterior
    window.speechSynthesis.cancel();

    const processedText = processTextForSpeech(text);
    const utterance = new SpeechSynthesisUtterance(processedText);
    
    // Configurações para voz mais fluida e natural
    const voice = voices.find((v) => v.name === selectedVoice);
    if (voice) {
      utterance.voice = voice;
    }
    
    utterance.lang = "pt-BR";
    utterance.rate = 0.95; // Um pouco mais devagar para melhor compreensão
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => setCurrentSpeaking(messageIndex);
    utterance.onend = () => setCurrentSpeaking(null);
    utterance.onerror = () => setCurrentSpeaking(null);

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setCurrentSpeaking(null);
    }
  }

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

      const assistantMessage = data.answer;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: assistantMessage,
        },
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro inesperado no chat.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: errorMessage,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Chat Financeiro</h3>
        
        {voices.length > 0 && (
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none ring-red-500 focus:ring"
          >
            {voices.map((voice) => (
              <option key={voice.name} value={voice.name}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mb-3 min-h-0 flex-1 space-y-3 overflow-auto rounded-lg bg-slate-50 p-3">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`flex items-start gap-2 ${
              message.role === "user" ? "ml-8" : "mr-8"
            }`}
          >
            <div
              className={`flex-1 rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                message.role === "user"
                  ? "bg-red-600 text-white"
                  : "bg-white text-slate-700"
              }`}
            >
              {message.text}
            </div>
            {message.role === "assistant" && (
              <div className="flex gap-1">
                {currentSpeaking === index ? (
                  <button
                    onClick={stopSpeaking}
                    className="rounded-lg bg-slate-600 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700"
                    type="button"
                    title="Parar reprodução"
                  >
                    ✕
                  </button>
                ) : (
                  <button
                    onClick={() => speakText(message.text, index)}
                    className="rounded-lg bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700"
                    type="button"
                    title="Ouvir resposta"
                  >
                    ▶
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-2">
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={isListening ? "🎤 Ouvindo..." : "Digite ou fale sua pergunta"}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-red-500 focus:ring"
          />
          <button
            type="button"
            onClick={toggleListening}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              isListening
                ? "bg-red-600 text-white animate-pulse"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
            }`}
          >
            {isListening ? "🎤 Gravando..." : "🎤"}
          </button>
        </div>
        
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
