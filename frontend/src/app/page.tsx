"use client";

import React, { useState, useEffect, useRef, useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Orbit,
  Sparkles,
  Plus,
  Loader2,
  MessageSquare,
  History,
  Settings,
  User,
  PanelLeftOpen,
  PanelLeftClose,
  Pencil,
  Trash2,
  Compass,
  ArrowRight,
  Paperclip,
  Command,
  X as XIcon,
  ImageIcon,
  Search,
  Layers,
  Send as SendIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import GalaxyBackground from "@/components/GalaxyBackground";
import { ShaderAnimation } from "@/components/ShaderAnimation";
import { HoverButton } from "@/components/HoverButton";
import { SparklesCore } from "@/components/SparklesCore";


// Helper function for class merging to guarantee compilation without external libraries
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

interface ChatItem {
  id: string;
  title: string;
  created_at: string;
}

interface ChatListItemProps {
  chat: ChatItem;
  isActive: boolean;
  onRename: (chatId: string, newTitle: string) => Promise<void>;
  onDelete: (chatId: string) => Promise<void>;
}

// Custom click-toggle vertical dots menu with capture-phase click handler
const ChatListItem = ({ chat, isActive, onRename, onDelete }: ChatListItemProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(chat.title);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [menuOpen]);

  const handleSaveRename = async () => {
    if (!draftName.trim() || draftName.trim() === chat.title) {
      setRenaming(false);
      return;
    }
    await onRename(chat.id, draftName.trim());
    setRenaming(false);
  };

  return (
    <div ref={containerRef} className="group relative w-full">
      <div
        className={`w-full text-left py-2 px-3 rounded-lg text-xs flex items-center justify-between border transition-all ${
          isActive
            ? "bg-primary/10 border-primary/20 text-white font-bold"
            : "bg-transparent border-transparent hover:bg-slate-900/30 hover:text-slate-200"
        }`}
      >
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-primary-light" : "text-slate-600"}`} />
          {renaming ? (
            <input
              autoFocus
              value={draftName}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { handleSaveRename(); }
                if (e.key === "Escape") { setDraftName(chat.title); setRenaming(false); }
              }}
              onBlur={handleSaveRename}
              className="flex-1 bg-transparent border-b border-blue-500/50 text-xs text-slate-200 outline-none w-full"
            />
          ) : (
            <Link
              href={`/chat/${chat.id}`}
              className="flex-1 text-left truncate text-xs text-slate-400 hover:text-slate-200 block"
            >
              {chat.title}
            </Link>
          )}
        </div>

        {/* Vertical stacked orbit dots */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
          className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center transition-all cursor-pointer ${
            menuOpen
              ? "opacity-100 text-slate-300 bg-white/[0.08]"
              : "opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300"
          }`}
        >
          <svg width="3" height="13" viewBox="0 0 3 13" fill="currentColor">
            <circle cx="1.5" cy="1.5" r="1.5" />
            <circle cx="1.5" cy="6.5" r="1.5" />
            <circle cx="1.5" cy="11.5" r="1.5" />
          </svg>
        </button>
      </div>

      {/* Pop up options menu — positioned relative to triggers, staying within bounds */}
      {menuOpen && (
        <div
          className="absolute right-2 top-full mt-1 z-[100] w-40 bg-[#0a1535] border border-blue-900/50 rounded-xl shadow-2xl shadow-black/60 overflow-hidden py-1 text-left font-bold uppercase text-[8px] tracking-wider animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { setRenaming(true); setMenuOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-slate-300 hover:bg-blue-900/30 transition-colors text-left cursor-pointer"
          >
            <Pencil size={11} className="text-cyan-400" />
            Rename galaxy
          </button>
          <div className="h-px bg-blue-900/30 mx-2 my-0.5" />
          <button
            onClick={async () => {
              if (confirm("Are you sure you want to delete this chat thread and all its nodes/messages? This cannot be undone.")) {
                await onDelete(chat.id);
              }
              setMenuOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-rose-450 hover:bg-red-950/40 transition-colors text-left cursor-pointer"
          >
            <Trash2 size={11} className="text-rose-500" />
            Delete galaxy
          </button>
        </div>
      )}
    </div>
  );
};

// Textarea auto-resize hook
interface UseAutoResizeTextareaProps {
  minHeight: number;
  maxHeight?: number;
}

function useAutoResizeTextarea({ minHeight, maxHeight }: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY)
      );

      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = `${minHeight}px`;
    }
  }, [minHeight]);

  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

interface CommandSuggestion {
  icon: React.ReactNode;
  label: string;
  description: string;
  prefix: string;
}

export default function Home() {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [activeSuggestion, setActiveSuggestion] = useState<number>(-1);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [recentCommand, setRecentCommand] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [inputFocused, setInputFocused] = useState(false);
  
  // Sidebar and History States
  const [leftOpen, setLeftOpen] = useState(true);
  const [chatHistory, setChatHistory] = useState<ChatItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const commandPaletteRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Cinematic Galaxy Landing States
  const [hasStarted, setHasStarted] = useState(false);
  const [landingStage, setLandingStage] = useState<"hidden" | "emerge" | "drift">("hidden");
  const [isLandingTransitioning, setIsLandingTransitioning] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const started = sessionStorage.getItem("landing_started");
      if (started === "true") {
        setHasStarted(true);
      } else {
        setLandingStage("emerge");
        const timer = setTimeout(() => {
          setLandingStage("drift");
        }, 2200);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleGetStarted = () => {
    setIsLandingTransitioning(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("landing_started", "true");
    }
    setTimeout(() => {
      setHasStarted(true);
      setIsLandingTransitioning(false);
    }, 800);
  };

  const handleExploreUniverse = () => {
    router.push("/galaxy/all");
  };
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 60,
    maxHeight: 200,
  });

  const commandSuggestions: CommandSuggestion[] = [
    { 
      icon: <Compass className="w-4 h-4 text-violet-400" />, 
      label: "Discover Galaxy", 
      description: "Inspect the semantic map and node orbits", 
      prefix: "/galaxy" 
    },
    { 
      icon: <Orbit className="w-4 h-4 text-cyan-400" />, 
      label: "Explore Planet", 
      description: "Deep-dive into a primary memory core", 
      prefix: "/planet" 
    },
    { 
      icon: <History className="w-4 h-4 text-blue-400" />, 
      label: "Old memories", 
      description: "Browse cold-storage conversational paths", 
      prefix: "/archive" 
    },
    { 
      icon: <Sparkles className="w-4 h-4 text-fuchsia-400" />, 
      label: "Connect stars", 
      description: "Establish gravitational links between contexts", 
      prefix: "/link" 
    },
  ];

  // Fetch Left Sidebar Chat history logs
  const fetchChatHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`${apiBase}/chat/all`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const historyData = await response.json();
      
      // Filter out deleted chats from localStorage
      const deletedIds = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("deleted_chat_ids") || "[]") : [];
      const filtered = (historyData || []).filter((chat: any) => !deletedIds.includes(chat.id));
      
      setChatHistory(filtered);
    } catch (err) {
      console.warn("Chat history unavailable:", err);
      setChatHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchChatHistory();
  }, []);

  // Mouse tracking spotlight positioning
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // Toggle Command Palette
  useEffect(() => {
    if (value.startsWith("/") && !value.includes(" ")) {
      setShowCommandPalette(true);
      const matchingSuggestionIndex = commandSuggestions.findIndex((cmd) =>
        cmd.prefix.startsWith(value)
      );
      if (matchingSuggestionIndex >= 0) {
        setActiveSuggestion(matchingSuggestionIndex);
      } else {
        setActiveSuggestion(-1);
      }
    } else {
      setShowCommandPalette(false);
    }
  }, [value]);

  // Click outside to collapse command suggestions menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const commandButton = document.querySelector("[data-command-button]");
      if (
        commandPaletteRef.current &&
        !commandPaletteRef.current.contains(target) &&
        !commandButton?.contains(target)
      ) {
        setShowCommandPalette(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommandPalette) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSuggestion((prev) =>
          prev < commandSuggestions.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSuggestion((prev) =>
          prev > 0 ? prev - 1 : commandSuggestions.length - 1
        );
      } else if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        if (activeSuggestion >= 0) {
          const selectedCommand = commandSuggestions[activeSuggestion];
          setValue(selectedCommand.prefix + " ");
          setShowCommandPalette(false);
          setRecentCommand(selectedCommand.label);
          setTimeout(() => setRecentCommand(null), 3500);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowCommandPalette(false);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        handleSubmit();
      }
    }
  };

  // Chat/Orbit Workspace Ignition
  const handleSubmit = async () => {
    if (!value.trim() || isLoading) return;

    setIsLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`${apiBase}/chat/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: value.slice(0, 60),
          first_message: value,
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

  const handleRenameChat = async (id: string, newTitle: string) => {
    try {
      const response = await fetch(`${apiBase}/chat/${id}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      if (response.ok) {
        await fetchChatHistory();
      } else {
        throw new Error(`Server returned status ${response.status}`);
      }
    } catch (err) {
      console.warn("Failed to rename chat on backend, falling back to local rename:", err);
      setChatHistory((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
      );
    }
  };

  const handleDeleteChat = async (id: string) => {
    // Add to deleted_chat_ids in localStorage to keep it permanently deleted for this user
    if (typeof window !== "undefined") {
      try {
        const deletedIds = JSON.parse(localStorage.getItem("deleted_chat_ids") || "[]");
        if (!deletedIds.includes(id)) {
          deletedIds.push(id);
          localStorage.setItem("deleted_chat_ids", JSON.stringify(deletedIds));
        }
      } catch (e) {
        console.error(e);
      }
    }
    
    // Update UI immediately
    setChatHistory((prev) => prev.filter((c) => c.id !== id));
    
    try {
      const response = await fetch(`${apiBase}/chat/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        await fetchChatHistory();
      } else {
        throw new Error(`Server returned status ${response.status}`);
      }
    } catch (err) {
      console.warn("Failed to delete chat on backend, falling back to local delete:", err);
    }
  };

  const handleAttachFile = () => {
    const mockFileName = `context-source-${Math.floor(Math.random() * 1000)}.pdf`;
    setAttachments((prev) => [...prev, mockFileName]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const selectCommandSuggestion = (index: number) => {
    const selectedCommand = commandSuggestions[index];
    setValue(selectedCommand.prefix + " ");
    setShowCommandPalette(false);
    setRecentCommand(selectedCommand.label);
    setTimeout(() => setRecentCommand(null), 2000);
  };

  // Galaxy core animation stages
  const galaxyVariants: any = {
    hidden: { scale: 0.01, opacity: 0, y: "0vh", filter: "blur(20px)" },
    emerge: { 
      scale: 1.0, 
      opacity: 1, 
      y: "0vh", 
      filter: "blur(0px)",
      transition: { duration: 2.2, ease: "easeOut" } 
    },
    drift: { 
      scale: 0.85, 
      opacity: 1, 
      y: "-26vh", 
      filter: "blur(0px)",
      transition: { duration: 2.8, ease: [0.16, 1, 0.3, 1] } 
    }
  };

  const containerVariants: any = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.25,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 1.0, ease: [0.16, 1, 0.3, 1] } 
    }
  };

  return (
    <main className="relative w-full h-screen overflow-hidden flex bg-[#020917] text-slate-100 font-sans">
      <AnimatePresence>
        {!hasStarted && (
          <motion.div
            key="cinematic-landing"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.03 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-0 z-50 bg-[#02050d] flex flex-col items-center justify-center overflow-hidden"
          >
            {/* Cinematic Background Shader & Overlay */}
            <div className="absolute inset-0 pointer-events-none z-0">
              <ShaderAnimation className="absolute inset-0 w-full h-full z-0" />
              {/* Slight dark blue gradient overlay heavier on the right side */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#02050d]/20 via-[#02050d]/50 to-[#02081d]/90 z-10 pointer-events-none" />
              <div className="absolute inset-0 bg-radial-at-c from-transparent via-[#02050d]/30 to-[#02050d] z-20 pointer-events-none" />
            </div>

            {/* Glowing Nebulas in background */}
            <div className="absolute w-[600px] h-[600px] rounded-full bg-violet-900/10 blur-[130px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0 animate-pulse" style={{ animationDuration: "8s" }} />
            <div className="absolute w-[500px] h-[500px] rounded-full bg-cyan-900/10 blur-[110px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0" />

            {/* Galaxy Container (Emerges then drifts upward - Represents newborn galaxy core) */}
            <motion.div
              className="absolute z-10 flex items-center justify-center pointer-events-none"
              initial="hidden"
              animate={landingStage}
              variants={galaxyVariants}
              style={{
                width: "480px",
                height: "480px"
              }}
            >
              {/* Layers of Glowing Nebulas & cores */}
              <div className="absolute w-24 h-24 rounded-full bg-white blur-xl opacity-85 mix-blend-screen" />
              <div 
                className="absolute w-[100%] h-[100%] rounded-full border border-dashed border-violet-500/20" 
                style={{
                  transform: "rotate(0deg)",
                  animation: "spin-clockwise 35s linear infinite"
                }}
              />
              <div 
                className="absolute w-[135%] h-[135%] rounded-full border border-dotted border-cyan-400/15" 
                style={{
                  transform: "rotate(0deg)",
                  animation: "spin-counter 50s linear infinite"
                }}
              />
              <div className="absolute w-60 h-60 rounded-full bg-violet-600/35 blur-2xl animate-pulse" style={{ animationDuration: "5s" }} />
              <div className="absolute w-80 h-80 rounded-full bg-cyan-500/15 blur-3xl" />
            </motion.div>

            {/* Staggered text reveal below the galaxy core */}
            {landingStage === "drift" && (
              <motion.div
                className="relative z-20 max-w-2xl text-center px-6 mt-[6vh] flex flex-col items-center"
                initial="hidden"
                animate="visible"
                variants={containerVariants}
              >
                {/* Title wrapped in a SparklesCore overlay */}
                <motion.div 
                  variants={itemVariants}
                  className="relative w-full py-1 flex flex-col items-center justify-center overflow-hidden rounded-lg select-none"
                >
                  <div className="absolute inset-0 w-full h-full pointer-events-none z-10">
                    <SparklesCore
                      id="landing-title-sparkles"
                      background="transparent"
                      minSize={0.6}
                      maxSize={1.6}
                      particleDensity={45}
                      speed={1.2}
                      particleColor="#22d3ee"
                      className="w-full h-full"
                    />
                  </div>
                  <h1 className="relative z-10 text-7xl font-extrabold  select-none leading-none bg-gradient-to-b from-white to-white bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(34,211,238,0.25)]">
                    Context Galaxy
                  </h1>
                  
                </motion.div>

                  {/*LINE (Tightly bound below title) */}
                <motion.div
                  variants={itemVariants}
                  className="relative mx-auto mt-2 mb-4 h-px w-100"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent" />
                  <div className="absolute inset-0 blur-sm bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
                </motion.div>

                {/* Description (Positioned below the line) */}
                <motion.p 
                  variants={itemVariants}
                  className="text-sm text-slate-350 max-w-lg leading-relaxed select-text font-small text-center mt-4"
                >
                  A personalized semantic memory universe where conversations evolve into galaxies, ideas become planets, and knowledge forms living constellations.
                </motion.p>

                {/* Glassmorphic HoverButtons double-actions (Positioned further down with an elegant gap) */}
                <motion.div 
                  variants={itemVariants}
                  className="flex items-center justify-between w-full max-w-md mt-10 gap-6 relative select-none"
                >
                  {/* Explore the universe button on the left */}
                  <div className="flex-1 flex justify-start">
                    <HoverButton
                      onClick={handleExploreUniverse}
                      className="w-full text-slate-100 hover:text-white font-sans text-xs uppercase tracking-wider font-bold border border-white/10 hover:border-white/20 shadow-md hover:scale-102 active:scale-98 transition-all duration-300"
                      style={{
                        "--circle-start": "#0d9488",
                        "--circle-end": "#0284c7"
                      } as React.CSSProperties}
                    >
                      Explore the Universe
                    </HoverButton>
                  </div>

                  {/* Get Started button on the right with a slight dark blue glowing background overlay */}
                  <div className="flex-1 flex justify-end relative">
                    <div className="absolute -inset-1.5 bg-blue-500/10 rounded-full blur-md opacity-60 pointer-events-none" />
                    <HoverButton
                      onClick={handleGetStarted}
                      className="w-full text-slate-100 hover:text-white font-sans text-xs uppercase tracking-wider font-bold bg-[#0d1e3d] border border-blue-500/25 hover:border-blue-400/50 shadow-lg hover:scale-102 active:scale-98 transition-all duration-300"
                      style={{
                        "--circle-start": "#3b82f6",
                        "--circle-end": "#1e3a8a"
                      } as React.CSSProperties}
                    >
                      Get Started
                    </HoverButton>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main dashboard workspace */}
      <div className={cn("w-full h-full flex transition-opacity duration-1000", !hasStarted ? "opacity-0 pointer-events-none" : "opacity-100")}>
        {/* Dynamic Moving Starfield Background */}
        <GalaxyBackground speedMultiplier={0.8} />

        {/* Lighter blue black overlay for visibility and contrast */}
        <div className="absolute inset-0 bg-[#02050c]/45 pointer-events-none z-0 backdrop-blur-[0.5px]" />

        {/* Galaxy Nebula Glows */}
        <div className="absolute w-[600px] h-[600px] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-nebula-drift" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-blue-600/5 blur-[90px] pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-nebula-drift" style={{ animationDelay: "-5s" }} />

        {/* COLUMN 1: LEFT SIDEBAR (Persists Chat History) */}
        <aside
          className={`${
            leftOpen ? "w-60" : "w-12"
          } h-full flex flex-col bg-slate-950/40 border-r border-slate-900/60 z-10 text-slate-400 shrink-0 select-none transition-all duration-300 ease-in-out overflow-hidden backdrop-blur-md`}
        >
        {leftOpen ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-slate-900/60 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-0.2">
                <button
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      sessionStorage.removeItem("landing_started");
                    }
                    setHasStarted(false);
                    setLandingStage("emerge");
                    setTimeout(() => {
                      setLandingStage("drift");
                    }, 2200);
                  }}
                  className="flex items-center gap-2 hover:opacity-80 transition-all cursor-pointer text-left focus:outline-none"
                  title="Return to Landing Page"
                >
                  <div className="relative w-7 h-7 flex items-center justify-center">
                    <Orbit className="absolute w-7 h-7 text-primary animate-spin-slow opacity-60" />
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                  <h1 className="text-xs font-black tracking-widest uppercase text-white bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Context Galaxy
                  </h1>
                </button>
                <button
                  onClick={() => setLeftOpen(false)}
                  className="p-1 hover:bg-slate-900/60 text-slate-500 hover:text-white rounded-lg transition-all cursor-pointer border border-transparent hover:border-slate-800"
                  title="Collapse Sidebar"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={() => setValue("")}
                className="w-full mt-2 py-2 px-3 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 hover:text-white transition-all text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> New Galaxy
              </button>
            </div>

            {/* Chat list history */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div>
                <h3 className="text-[9px] font-extrabold uppercase text-slate-600 tracking-wider mb-2 flex items-center gap-1.5 px-1">
                  <History className="w-3.5 h-3.5" /> Galaxy Orbits
                </h3>
                {historyLoading ? (
                  <div className="flex items-center justify-center py-8 text-xs gap-1.5">
                    <Loader2 className="w-4 h-4 animate-spin text-slate-600" /> Connecting...
                  </div>
                ) : chatHistory.length === 0 ? (
                  <div className="text-center py-8 text-[10px] text-slate-600 border border-dashed border-slate-900/40 rounded-lg">
                    No past galaxies found
                  </div>
                ) : (
                  <div className="space-y-1">
                    {chatHistory.map((chat) => (
                      <ChatListItem
                        key={chat.id}
                        chat={chat}
                        isActive={false}
                        onRename={handleRenameChat}
                        onDelete={handleDeleteChat}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer pilot status */}
            <div className="p-3 border-t border-slate-900/60 flex items-center justify-between text-[11px] font-semibold text-slate-500 bg-slate-950/20">
              <button className="flex items-center gap-1 hover:text-slate-300 cursor-pointer">
                <Settings className="w-3.5 h-3.5" /> Settings
              </button>
              <div className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 rounded-full border border-slate-850 bg-slate-900 p-0.5" />
                <span>Pilot</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full items-center justify-between py-4 select-none">
            <div className="flex flex-col items-center gap-4 w-full">
              <button
                onClick={() => setLeftOpen(true)}
                className="p-1.5 hover:bg-slate-900/60 text-slate-500 hover:text-white rounded-lg transition-all cursor-pointer border border-transparent hover:border-slate-800"
                title="Expand Sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>

              <button
                onClick={() => setValue("")}
                className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850 flex items-center justify-center transition-all cursor-pointer shadow-md"
                title="New Galaxy"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-4 w-full">
              <button className="text-slate-600 hover:text-slate-300 transition-colors cursor-pointer" title="Settings">
                <Settings className="w-4 h-4" />
              </button>
              <div className="w-6 h-6 rounded-full border border-slate-850 bg-slate-900 flex items-center justify-center p-0.5" title="Pilot">
                <User className="w-3.5 h-3.5 text-slate-500" />
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* COLUMN 2: CENTER WORKSPACE (TRANSFORMED ANIMATED AI CHAT) */}
      <div className="flex-1 h-full flex flex-col items-center justify-center p-6 relative overflow-hidden z-10">
        <div className="w-full max-w-2xl mx-auto relative">
          <motion.div
            className="relative z-10 space-y-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            {/* Header / Hero Texts */}
            <div className="text-center space-y-3">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="inline-block"
              >
                {/* <h1 className="text-3xl font-medium tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white/95 to-white/40 pb-1"> */}
                <h1 className="text-3xl font-medium tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white/95 via-white/90 to-purple-300 pb-1">
                  What would you like to explore today?
                </h1>
                <motion.div
                  className="h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent"
                  initial={{ width: 0, opacity: 0.1 }}
                  animate={{ width: "100%", opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                />
              </motion.div>
              <motion.p
                className="text-sm text-slate-400 font-medium tracking-wide"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                Every conversation begins in this universe.
              </motion.p>
            </div>

            {/* Glowing Prompter Area */}
            <motion.div
              className="relative backdrop-blur-2xl bg-slate-950/30 rounded-2xl border border-white/[0.15] shadow-[0_12px_40px_rgba(0,0,0,0.4)]"
              initial={{ scale: 0.98 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              {/* Command suggestions palette dropdown */}
              <AnimatePresence>
                {showCommandPalette && (
                  <motion.div
                    ref={commandPaletteRef}
                    className="absolute left-4 right-4 bottom-full mb-2 backdrop-blur-xl bg-black/90 rounded-lg z-50 shadow-lg border border-white/10 overflow-hidden"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="py-1 bg-black/95">
                      {commandSuggestions.map((suggestion, index) => (
                        <motion.div
                          key={suggestion.prefix}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 text-xs transition-colors cursor-pointer",
                            activeSuggestion === index
                              ? "bg-white/10 text-white"
                              : "text-white/70 hover:bg-white/5"
                          )}
                          onClick={() => selectCommandSuggestion(index)}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.03 }}
                        >
                          <div className="w-5 h-5 flex items-center justify-center text-white/60">
                            {suggestion.icon}
                          </div>
                          <div className="font-semibold text-white/80">{suggestion.label}</div>
                          <div className="text-white/40 text-xs ml-1 font-mono">
                            {suggestion.prefix}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Textarea Prompter */}
              <div className="p-4 relative">
                <textarea
                  ref={textareaRef}
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    adjustHeight();
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  placeholder="Starting a new journey?"
                  className={cn(
                    "w-full px-4 py-3 resize-none bg-transparent border-none text-white/90 text-sm focus:outline-none placeholder:text-white/20 min-h-[60px] leading-relaxed transition-all duration-200"
                  )}
                  style={{ overflow: "hidden" }}
                  disabled={isLoading}
                />

                {/* Glowing border outline spotlight when focused */}
                {inputFocused && (
                  <motion.span 
                    className="absolute inset-0 rounded-2xl pointer-events-none ring-2 ring-violet-500/25"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  />
                )}
              </div>

              {/* PDF / Context Sources drawer */}
              <AnimatePresence>
                {attachments.length > 0 && (
                  <motion.div
                    className="px-4 pb-3 flex gap-2 flex-wrap"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    {attachments.map((file, index) => (
                      <motion.div
                        key={index}
                        className="flex items-center gap-2 text-xs bg-violet-950/20 border border-violet-800/30 py-1.5 px-3 rounded-lg text-violet-300 shadow-sm"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                      >
                        <span>{file}</span>
                        <button
                          onClick={() => removeAttachment(index)}
                          className="text-white/40 hover:text-white transition-colors cursor-pointer"
                        >
                          <XIcon className="w-3 h-3" />
                        </button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Lower promt deck actions */}
              <div className="p-4 border-t border-white/[0.05] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <motion.button
                    type="button"
                    onClick={handleAttachFile}
                    whileTap={{ scale: 0.94 }}
                    className="p-2 text-white/40 hover:text-white/90 rounded-lg transition-colors relative group cursor-pointer"
                    title="Attach Context Source"
                  >
                    <Paperclip className="w-4 h-4 text-slate-400" />
                    <motion.span
                      className="absolute inset-0 bg-white/[0.05] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      layoutId="button-highlight"
                    />
                  </motion.button>
                  <motion.button
                    type="button"
                    data-command-button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCommandPalette((prev) => !prev);
                    }}
                    whileTap={{ scale: 0.94 }}
                    className={cn(
                      "p-2 text-white/40 hover:text-white/90 rounded-lg transition-colors relative group cursor-pointer",
                      showCommandPalette && "bg-white/10 text-white/90"
                    )}
                    title="Open Star Commands"
                  >
                    <Command className="w-4 h-4 text-slate-400" />
                    <motion.span
                      className="absolute inset-0 bg-white/[0.05] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      layoutId="button-highlight"
                    />
                  </motion.button>
                </div>

                <motion.button
                  type="button"
                  onClick={handleSubmit}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isLoading || !value.trim()}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 cursor-pointer shadow-md",
                    value.trim()
                      ? "bg-white text-slate-950 shadow-lg shadow-white/5"
                      : "bg-white/[0.05] text-white/40 cursor-not-allowed"
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <SendIcon className="w-4 h-4" />
                  )}
                  <span>Start orbiting</span>
                </motion.button>
              </div>
            </motion.div>

            {/* Glowing Context/Planet Chips Below Input */}
            {chatHistory.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <span className="text-[10px] uppercase font-mono tracking-widest text-slate-500 mr-1 flex items-center gap-1 select-none">
                  <Orbit className="w-3.5 h-3.5 animate-spin-slow text-violet-400" />
                  Recent Active Cores:
                </span>
                {chatHistory.slice(0, 3).map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => router.push(`/chat/${chat.id}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-violet-950/20 border border-violet-800/30 text-violet-300 hover:bg-violet-900/30 hover:border-violet-400/50 shadow-md hover:shadow-[0_0_12px_rgba(167,139,250,0.15)] transition-all cursor-pointer animate-fade-in"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse shadow-[0_0_6px_#c084fc]" />
                    <span className="truncate max-w-[120px]">{chat.title}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Command shortcut chips */}
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {commandSuggestions.map((suggestion, index) => (
                <motion.button
                  key={suggestion.prefix}
                  onClick={() => selectCommandSuggestion(index)}
                  className="flex items-center gap-2 px-3 py-2 bg-[#060e25] hover:bg-slate-900/40 border border-white/[0.05] hover:border-violet-500/20 rounded-lg text-xs text-white/60 hover:text-white/90 transition-all relative group cursor-pointer"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  {suggestion.icon}
                  <span>{suggestion.label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Dynamic spotlights that follows cursor on focused prompter */}
        {inputFocused && (
          <motion.div
            className="fixed w-[50rem] h-[50rem] rounded-full pointer-events-none z-0 opacity-[0.03] bg-gradient-to-r from-violet-500 via-cyan-500 to-indigo-500 blur-[96px]"
            animate={{
              x: mousePosition.x - 400,
              y: mousePosition.y - 400,
            }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 150,
              mass: 0.5,
            }}
          />
        )}
      </div>

      {/* Dynamic Error HUD */}
      {errorMsg && (
        <div className="fixed bottom-6 right-6 z-50 text-xs font-bold uppercase tracking-wider text-rose-400 bg-rose-950/30 border border-rose-900/40 p-4 rounded-xl shadow-2xl backdrop-blur-md max-w-sm animate-pulse flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_#ef4444]" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="ml-auto text-slate-500 hover:text-white p-0.5 cursor-pointer">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      </div> {/* CLOSED DASHBOARD GALAXY WORKSPACE CONTAINER */}
    </main>
  );
}
