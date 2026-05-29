"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Orbit, Sparkles, LogIn, Lock, Mail, ArrowRight } from "lucide-react";
import GalaxyBackground from "@/components/GalaxyBackground";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a fully deployed context, handle backend session auth.
    // In this sprint, we provide direct client transitions to explore the LLM.
    window.location.href = "/chat";
  };

  return (
    <main className="relative w-full h-screen overflow-hidden flex items-center justify-center bg-[#050816] text-slate-100">
      <GalaxyBackground />

      <div className="w-full max-w-md glass-panel p-8 rounded-2xl border border-slate-800/80 shadow-[0_0_50px_rgba(109,93,254,0.15)] z-10 select-none">
        {/* Branding Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative w-16 h-16 mb-3 flex items-center justify-center">
            <Orbit className="absolute w-16 h-16 text-primary animate-spin-slow opacity-65" />
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <h1 className="text-xl font-black tracking-widest uppercase mb-1 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent filter drop-shadow-[0_0_12px_rgba(109,93,254,0.3)]">
            Context Galaxy
          </h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Memory-controlled LLM Workspace
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-500">
              Cosmic ID (Email)
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-600" />
              <input
                type="email"
                placeholder="pilot@context-galaxy.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-700 outline-none focus:border-primary/40 transition-colors"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-500">
                Access Key (Password)
              </label>
              <Link
                href="/forgot-password"
                className="text-[9px] font-bold text-primary hover:underline"
              >
                Forgot Key?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-600" />
              <input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-700 outline-none focus:border-primary/40 transition-colors"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-3 bg-gradient-to-r from-primary to-accent hover:brightness-110 active:brightness-95 transition-all text-white font-extrabold rounded-lg flex items-center justify-center gap-1.5 shadow-lg cursor-pointer"
          >
            <LogIn className="w-4 h-4" /> Enter Workspace <ArrowRight className="w-4 h-4" />
          </button>
          
          <p className="text-[9px] text-primary/70 text-center mt-2.5 font-semibold animate-pulse">
            🚀 Access Code Verified: You can use any email and password to enter!
          </p>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-900 text-center text-[10px] text-slate-500">
          New to the cosmos?{" "}
          <Link href="/signup" className="font-extrabold text-primary hover:underline">
            Establish Access Link (Sign Up)
          </Link>
        </div>
      </div>
    </main>
  );
}
