"use client";
import { useState, useEffect, useRef } from "react";

export default function ChatPage() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: newMessages }),
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let botReply = "";

    while (reader) {
      const { value, done } = await reader.read();
      if (done) break;
      botReply += decoder.decode(value);
      setMessages([...newMessages, { role: "assistant", content: botReply }]);
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
      {/* HEADER */}
      <header className="backdrop-blur-md bg-white/70 border-b border-slate-200 shadow-sm">
        <div className="max-w-3xl mx-auto py-4 text-center">
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">
            🌿 Ramayan Chat
          </h1>
          <p className="text-sm text-slate-500">
            Ask anything from the epic.
          </p>
        </div>
      </header>

      {/* CHAT MESSAGES */}
      <main className="flex-1 overflow-y-auto px-4 md:px-6 py-6 max-w-3xl w-full mx-auto space-y-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`px-4 py-2 rounded-2xl text-sm leading-relaxed shadow-sm max-w-[80%]
                ${
                  m.role === "user"
                    ? "bg-indigo-500 text-white rounded-br-none"
                    : "bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-800 rounded-bl-none"
                }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/80 border border-slate-200 text-slate-400 rounded-2xl px-4 py-2 text-sm shadow-sm">
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      {/* INPUT BAR */}
      <footer className="sticky bottom-0 backdrop-blur-md bg-white/80 border-t border-slate-200">
        <div className="max-w-3xl mx-auto flex items-center gap-3 p-4">
          <input
            className="flex-1 rounded-full border border-slate-300 bg-slate-50/80 px-4 py-2 text-sm text-slate-800
                       placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question…"
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-full px-5 py-2 text-sm font-medium shadow-md transition disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </footer>
    </div>
  );
}
