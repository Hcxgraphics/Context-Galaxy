"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Zap, BookOpen, Search, Layers, Loader2, Sparkles, Orbit } from "lucide-react";

const suggestions = [
  { icon: Zap, label: "LangGraph Architectures", desc: "Stateful memory agent networks" },
  { icon: BookOpen, label: "TS Utility Mechanics", desc: "Deconstruct strict generic typings" },
  { icon: Search, label: "RAG Pipeline Design", desc: "Vector retrieval & semantic chunking" },
  { icon: Layers, label: "Embeddings Deep Dive", desc: "Sentence transformers & similarity" },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [stars, setStars] = useState<{ id: number; size: number; left: number; top: number; opacity: number; duration: number; delay: number }[]>([]);
  const router = useRouter();
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  // Generate twinkling stars only on the client side to avoid Next.js hydration mismatch
  useEffect(() => {
    const generatedStars = Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      size: Math.random() * 1.8 + 0.6,
      left: Math.random() * 100,
      top: Math.random() * 100,
      opacity: Math.random() * 0.6 + 0.2,
      duration: Math.random() * 4 + 2,
      delay: Math.random() * 5,
    }));
    setStars(generatedStars);
  }, []);

  const handleSubmit = async () => {
    if (!query.trim() || isLoading) return;
    
    setIsLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`${apiBase}/chat/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          title: query.slice(0, 60), 
          first_message: query 
        }),
      });

      if (!res.ok) {
        throw new Error(`Workspace ignition failed (HTTP ${res.status}). Verify that the backend is running.`);
      }

      const data = await res.json();
      const chatId = data.chat_id ?? data.id;
      
      if (!chatId) {
        throw new Error("Invalid response received from Core engines.");
      }

      router.push(`/chat/${chatId}`);
    } catch (err: any) {
      console.error("Failed to ignite workspace galaxy:", err);
      setErrorMsg(err.message || "Unable to contact Core Engines. Verify port 8000 is active.");
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 py-16 bg-[#020917] relative overflow-hidden select-none">
      {/* Animated background stars */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {stars.map((star) => (
          <div
            key={star.id}
            className="absolute rounded-full bg-white animate-twinkle"
            style={{
              width: `${star.size}px`,
              height: `${star.size}px`,
              left: `${star.left}%`,
              top: `${star.top}%`,
              opacity: star.opacity,
              animationDuration: `${star.duration}s`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Decorative center cosmic glows */}
      <div className="absolute w-[600px] h-[600px] rounded-full bg-[#7c3aed]/5 blur-[120px] pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-nebula-drift" />
      <div className="absolute w-[400px] h-[400px] rounded-full bg-[#1d4ed8]/5 blur-[90px] pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-nebula-drift" style={{ animationDelay: "-5s" }} />

      <div className="relative z-10 w-full max-w-xl flex flex-col items-center gap-8">
        {/* Centered logo with spin animation */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <Orbit className="absolute w-16 h-16 text-[#7c3aed] animate-spin-slow opacity-80" />
            <Sparkles className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight text-slate-100 bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text">
              What shall we explore today?
            </h1>
            <p className="text-[10px] text-[#7c3aed] font-mono tracking-widest uppercase">
              // begin a new semantic orbit
            </p>
          </div>
        </div>

        {/* 2x2 Suggestion cards */}
        <div className="grid grid-cols-2 gap-3 w-full">
          {suggestions.map(({ icon: Icon, label, desc }) => (
            <button
              key={label}
              onClick={() => setQuery(label)}
              className="group text-left rounded-xl border border-[rgba(59,130,246,0.12)] bg-[#060e25] p-3.5 transition-all hover:bg-[#0a1535] hover:border-[rgba(59,130,246,0.35)] hover:-translate-y-0.5 shadow-[0_4px_12px_rgba(0,0,0,0.3)] cursor-pointer"
            >
              <Icon size={15} className="mb-2 text-[#7c3aed] opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" />
              <div className="text-xs font-bold text-slate-200 tracking-wide">{label}</div>
              <div className="text-[10px] text-slate-400 mt-1 leading-relaxed">{desc}</div>
            </button>
          ))}
        </div>

        {/* Input Prompter Dock (Single textarea, submitting on Enter, Shift+Enter for newlines) */}
        <div className="relative w-full">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Start a new orbit — what are you building or learning?"
            rows={1}
            disabled={isLoading}
            className="w-full resize-none rounded-2xl border border-[rgba(59,130,246,0.22)] bg-[#060e25] px-5 py-4 pr-14 text-sm text-slate-200 placeholder:text-white/20 outline-none focus:border-[#7c3aed]/60 focus:ring-2 focus:ring-[#7c3aed]/5 transition-all leading-relaxed shadow-[0_8px_32px_rgba(0,0,0,0.5)] disabled:opacity-60"
            style={{ minHeight: 56 }}
          />
          <button
            onClick={handleSubmit}
            disabled={!query.trim() || isLoading}
            className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#1d4ed8] text-white transition-all hover:scale-105 hover:shadow-lg hover:shadow-[#7c3aed]/20 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
            title="Ignite Core Orbit"
          >
            {isLoading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <ArrowRight size={15} />
            )}
          </button>
        </div>

        {/* Action pills */}
        <div className="flex flex-wrap gap-2 justify-center">
          {["Explore topic", "Learn & build", "Deep research", "Continue orbit"].map((p) => (
            <span
              key={p}
              onClick={() => !isLoading && setQuery(p)}
              className="rounded-full border border-[rgba(59,130,246,0.12)] bg-[#060e25] px-3.5 py-1.5 text-[10px] font-semibold text-slate-400 cursor-pointer hover:bg-[#0a1535] hover:text-slate-200 hover:border-[rgba(59,130,246,0.22)] transition-all shadow-sm"
            >
              {p}
            </span>
          ))}
        </div>

        {/* Dynamic Error State */}
        {errorMsg && (
          <div className="w-full text-center text-[11px] font-medium text-rose-400 bg-rose-950/20 border border-rose-950/40 p-3 rounded-xl animate-pulse">
            {errorMsg}
          </div>
        )}
      </div>
    </main>
  );
}
