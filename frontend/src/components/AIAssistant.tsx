import { useState, useRef, useEffect } from "react";
import api from "../services/api";

type Msg = { role: "user" | "assistant"; content: string };

export default function AIAssistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setInput("");
    setLoading(true);
    try {
      const res = await api.post("/api/agent/chat", { message: msg, session_id: sessionId });
      const data = res.data;
      if (data.session_id) setSessionId(data.session_id);
      setMessages((m) => [...m, { role: "assistant", content: data.message || "No response" }]);
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.response?.data?.message || e.message || "Failed to reach assistant";
      setError(detail);
      setMessages((m) => [...m, { role: "assistant", content: `Error: ${detail}` }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    "How many incidents are there?",
    "How many incidents are pending?",
    "Show me pending incidents",
    "What work has been assigned?",
    "Show me the work statistics",
  ];

  return (
    <div className="bg-white border rounded-xl flex flex-col h-[520px]">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">🤖 AI GOVERNMENT ASSISTANT</h2>
        <span className="text-xs text-gray-400">READ-ONLY</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.length === 0 && (
          <div className="text-sm text-gray-500">
            <p className="mb-2">Ask about incidents, work orders, or employees. Answers come from live database.</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)} className="text-xs bg-white border px-2 py-1 rounded-full hover:bg-blue-50">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-blue-600 text-white" : "bg-white border text-gray-800"}`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && <div className="text-xs text-gray-400">Assistant is thinking…</div>}
        <div ref={endRef} />
      </div>
      {error && <div className="px-4 py-1 text-xs text-red-600 bg-red-50 border-t">{error}</div>}
      <div className="p-3 border-t flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="Ask: How many pending incidents?"
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">Send</button>
      </div>
    </div>
  );
}
