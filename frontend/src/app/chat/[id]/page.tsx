"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Orbit,
  Sparkles,
  Plus,
  Loader2,
  MessageSquare,
  History,
  Settings,
  User,
  Compass,
  ArrowLeft,
  PanelLeftOpen,
  PanelLeftClose,
  PanelRightOpen,
  PanelRightClose,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  X
} from "lucide-react";

import GalaxyBackground from "@/components/GalaxyBackground";
import ContextJarSidebar from "@/components/ContextJarSidebar";
import ChatPanel from "@/components/ChatPanel";

interface ChatItem {
  id: string;
  title: string;
  created_at: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

interface ChatListItemProps {
  chat: ChatItem;
  isActive: boolean;
  onRename: (chatId: string, newTitle: string) => Promise<void>;
  onDelete: (chatId: string) => Promise<void>;
}

const ChatListItem = ({ chat, isActive, onRename, onDelete }: ChatListItemProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(chat.title);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    // Use capture phase + slight delay so the opening click doesn't immediately close
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

        {/* Vertical three-dot button — CLICK to toggle, NOT hover */}
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
          {/* Vertical dots — 3 stacked circles */}
          <svg width="3" height="13" viewBox="0 0 3 13" fill="currentColor">
            <circle cx="1.5" cy="1.5" r="1.5" />
            <circle cx="1.5" cy="6.5" r="1.5" />
            <circle cx="1.5" cy="11.5" r="1.5" />
          </svg>
        </button>
      </div>

      {/* Dropdown — absolutely positioned inside the sidebar bounds to avoid horizontal scrolling */}
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

export default function ChatThread() {
  const params = useParams();
  const chatId = params.id as string;
  const router = useRouter();

  // Collapsible Sidebar States
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  // State Management
  const [chatTitle, setChatTitle] = useState("Loading Orbit...");
  const [chatHistory, setChatHistory] = useState<ChatItem[]>([]);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  
  // Graph States
  const [nodes, setNodes] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [activeRetrievedNodeIds, setActiveRetrievedNodeIds] = useState<string[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Loading States
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Custom hook for delayed hover tooltips
  const useDelayedTooltip = (text: string, delayMs = 2500) => {
    const [visible, setVisible] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const onMouseEnter = () => {
      timerRef.current = setTimeout(() => {
        setVisible(true);
      }, delayMs);
    };

    const onMouseLeave = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setVisible(false);
    };

    useEffect(() => {
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }, []);

    return { visible, onMouseEnter, onMouseLeave };
  };

  const galaxyMapTooltip = useDelayedTooltip("Galaxy Map provides an interactive React Flow 3D projection of active semantic memory planets and orbiting subtopic moons.");

  // Fetch Left Sidebar Chat history logs
  const fetchChatHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`${apiBase}/chat/all`, {
        signal: AbortSignal.timeout(5000), // don't hang forever
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const historyData = await response.json();
      
      // Filter out deleted chats from localStorage
      const deletedIds = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("deleted_chat_ids") || "[]") : [];
      const filtered = (historyData || []).filter((chat: any) => !deletedIds.includes(chat.id));
      
      setChatHistory(filtered);
    } catch (err) {
      console.warn("Chat history unavailable:", err);
      setChatHistory([]); // graceful fallback — don't crash the UI
    } finally {
      setHistoryLoading(false);
    }
  };

  // Fetch specific graph structures (nodes, candidates)
  const fetchGalaxyData = async (activeChatId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${apiBase}/context/${activeChatId}/graph`);
      if (!response.ok) throw new Error("Failed to load galaxy structure");
      const data = await response.json();
      setNodes(data.nodes || []);
      setCandidates(data.candidates || []);
    } catch (err) {
      console.error("Error loading galaxy graph:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch ordered raw message history list
  const fetchMessages = async (activeChatId: string) => {
    try {
      const response = await fetch(`${apiBase}/chat/${activeChatId}/messages`);
      if (response.ok) {
        const msgs = await response.json();
        setActiveMessages(msgs);
      }
    } catch (err) {
      console.error("Error loading message history:", err);
      setActiveMessages([]);
    }
  };

  useEffect(() => {
    if (chatId) {
      fetchChatHistory();
      fetchMessages(chatId);
      fetchGalaxyData(chatId);

      // Extract specific chat title from history once loaded
      const matched = chatHistory.find((c) => c.id === chatId);
      if (matched) {
        setChatTitle(matched.title);
      }
    }
  }, [chatId]);

  // 5-second polling keeps forming moons fresh during active chat.
  useEffect(() => {
    if (!chatId) return;

    const intervalId = setInterval(() => {
      fetchGalaxyData(chatId);
      fetchMessages(chatId);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [chatId]);

  // Sync title once history array updates
  useEffect(() => {
    if (chatId && chatHistory.length > 0) {
      const matched = chatHistory.find((c) => c.id === chatId);
      if (matched) {
        setChatTitle(matched.title);
      }
    }
  }, [chatHistory, chatId]);

  // Sidebar Overrides
  const handleUpdatePriority = async (nodeId: string, priority: string) => {
    try {
      const response = await fetch(`${apiBase}/context/node/${nodeId}/priority`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority })
      });
      if (response.ok && chatId) {
        await fetchGalaxyData(chatId);
      }
    } catch (err) {
      console.error("Failed to update priority override:", err);
    }
  };

  const handleToggleActive = async (nodeId: string) => {
    try {
      const response = await fetch(`${apiBase}/context/node/${nodeId}/toggle_active`, {
        method: "POST"
      });
      if (response.ok && chatId) {
        await fetchGalaxyData(chatId);
      }
    } catch (err) {
      console.error("Failed to toggle node activation status:", err);
    }
  };

  const handleUpdateSummary = async (nodeId: string, summary: string) => {
    try {
      const response = await fetch(`${apiBase}/context/node/${nodeId}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary })
      });
      if (response.ok && chatId) {
        await fetchGalaxyData(chatId);
      }
    } catch (err) {
      console.error("Failed to update summary override:", err);
    }
  };

  const handleRenameNode = async (nodeId: string, label: string) => {
    try {
      const response = await fetch(`${apiBase}/context/node/${nodeId}/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label })
      });
      if (response.ok && chatId) {
        await fetchGalaxyData(chatId);
      }
    } catch (err) {
      console.error("Failed to rename memory node:", err);
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    try {
      const response = await fetch(`${apiBase}/context/node/${nodeId}`, {
        method: "DELETE"
      });
      if (response.ok && chatId) {
        await fetchGalaxyData(chatId);
        setSelectedNodeId(null);
      }
    } catch (err) {
      console.error("Failed to delete memory node:", err);
    }
  };

  const handleAddCustomNode = async (label: string, summary: string) => {
    try {
      const response = await fetch(`${apiBase}/chat/${chatId}/node`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, summary })
      });
      if (response.ok) {
        await fetchGalaxyData(chatId);
      } else {
        throw new Error("Failed to insert custom moon node");
      }
    } catch (err) {
      console.error("Error creating custom moon:", err);
    }
  };

  const handleRenameChat = async (id: string, newTitle: string) => {
    try {
      const response = await fetch(`${apiBase}/chat/${id}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle })
      });
      if (response.ok) {
        await fetchChatHistory();
        if (id === chatId) {
          setChatTitle(newTitle);
        }
      } else {
        throw new Error(`Server returned status ${response.status}`);
      }
    } catch (err) {
      console.warn("Failed to rename chat on backend, falling back to local rename:", err);
      // Fallback: update state locally so the user is not blocked
      setChatHistory((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
      );
      if (id === chatId) {
        setChatTitle(newTitle);
      }
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
    
    // Update local state immediately
    setChatHistory((prev) => prev.filter((c) => c.id !== id));
    
    try {
      const response = await fetch(`${apiBase}/chat/${id}`, {
        method: "DELETE"
      });
      if (response.ok) {
        if (id === chatId) {
          window.location.href = "/";
        }
      } else {
        throw new Error(`Server returned status ${response.status}`);
      }
    } catch (err) {
      console.warn("Failed to delete chat on backend, falling back to local delete:", err);
      if (id === chatId) {
        router.push("/");
      }
    }
  };

  const handleReorderNodes = (reorderedNodes: any) => {
    setNodes(reorderedNodes);
  };

  const activeNodesCount = nodes.filter((n) => n.data.is_active).length;

  return (
    <main className="relative w-full h-screen overflow-hidden flex bg-[#050816] text-slate-100">
      <GalaxyBackground speedMultiplier={0.15} />

      {/* Dark overlay for chat visibility and contrast */}
      <div className="absolute inset-0 bg-[#02050c]/70 pointer-events-none z-0 backdrop-blur-[0.5px]" />

      {/* COLUMN 1: LEFT SIDEBAR */}
      <aside 
        className={`${
          leftOpen ? "w-60" : "w-12"
        } h-full flex flex-col glass-panel border-r border-slate-800/80 z-10 text-slate-400 shrink-0 select-none transition-all duration-300 ease-in-out overflow-hidden`}
      >
        {leftOpen ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header Action */}
            <div className="p-4 border-b border-slate-900 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href="/"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      sessionStorage.removeItem("landing_started");
                    }
                  }}
                  className="flex items-center gap-2 hover:opacity-80 transition-all cursor-pointer text-left"
                  title="Return to Landing Page"
                >
                  <div className="relative w-7 h-7 flex items-center justify-center">
                    <Orbit className="absolute w-7 h-7 text-primary animate-spin-slow opacity-60" />
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                  <h1 className="text-xs font-black tracking-widest uppercase text-white bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Context Galaxy
                  </h1>
                </Link>
                <button
                  onClick={() => setLeftOpen(false)}
                  className="p-1 hover:bg-slate-850 text-slate-500 hover:text-white rounded-lg transition-all cursor-pointer border border-transparent hover:border-slate-800"
                  title="Collapse Sidebar"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              </div>

              <Link
                href="/"
                className="w-full mt-2 py-2 px-3 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 hover:text-white transition-all text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> New Galaxy
              </Link>

              {/* ACTIVE ROUTE: Dedicated Open Galaxy Canvas route button */}
              <div className="relative w-full">
                <Link
                  href={`/galaxy/${chatId}?view=all`}
                  onMouseEnter={galaxyMapTooltip.onMouseEnter}
                  onMouseLeave={galaxyMapTooltip.onMouseLeave}
                  className="w-full mt-1 py-2 px-3 bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 hover:border-primary/60 text-white font-extrabold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(109,93,254,0.15)] animate-pulse"
                >
                  <Compass className="w-4 h-4 text-accent" /> Open Galaxy Map
                </Link>
                {galaxyMapTooltip.visible && (
                  <div className="absolute top-10 left-1/2 -translate-x-1/2 w-48 p-2.5 bg-slate-950 border border-blue-900/40 text-[9px] text-slate-400 rounded-lg shadow-2xl z-50 normal-case select-none pointer-events-none leading-normal font-medium filter drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]">
                    Galaxy Map provides an interactive React Flow 3D projection of active semantic memory planets and orbiting subtopic moons.
                  </div>
                )}
              </div>
            </div>

            {/* History logs */}
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
                  <div className="text-center py-8 text-[10px] text-slate-600 border border-dashed border-slate-900 rounded-lg">
                    No past galaxies found
                  </div>
                ) : (
                  <div className="space-y-1">
                    {chatHistory.map((chat) => (
                      <ChatListItem
                        key={chat.id}
                        chat={chat}
                        isActive={chatId === chat.id}
                        onRename={handleRenameChat}
                        onDelete={handleDeleteChat}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer info */}
            <div className="p-3 border-t border-slate-900 flex items-center justify-between text-[11px] font-semibold text-slate-500 bg-slate-950/20">
              <button className="flex items-center gap-1 hover:text-slate-300">
                <Settings className="w-3.5 h-3.5" /> Settings
              </button>
              <div className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 rounded-full border border-slate-800 bg-slate-900 p-0.5" />
                <span>Pilot</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full items-center justify-between py-4 select-none">
            {/* Collapsed top items */}
            <div className="flex flex-col items-center gap-4 w-full">
              <button
                onClick={() => setLeftOpen(true)}
                className="p-1.5 hover:bg-slate-850 text-slate-500 hover:text-white rounded-lg transition-all cursor-pointer border border-transparent hover:border-slate-800"
                title="Expand Sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>

              <Link
                href="/"
                className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850 flex items-center justify-center transition-all cursor-pointer shadow-md"
                title="New Galaxy"
              >
                <Plus className="w-4 h-4" />
              </Link>

              <Link
                href={`/galaxy/${chatId}?view=all`}
                className="w-7 h-7 rounded-lg bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 text-accent hover:border-primary/60 flex items-center justify-center transition-all animate-pulse shadow-md"
                title="Open Galaxy Map"
              >
                <Compass className="w-4 h-4" />
              </Link>
            </div>

            {/* Collapsed bottom items */}
            <div className="flex flex-col items-center gap-4 w-full">
              <button className="text-slate-600 hover:text-slate-300 transition-colors" title="Settings">
                <Settings className="w-4 h-4" />
              </button>
              <div className="w-6 h-6 rounded-full border border-slate-800 bg-slate-900 flex items-center justify-center p-0.5" title="Pilot">
                <User className="w-3.5 h-3.5 text-slate-500" />
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* COLUMN 2: CENTER WORKSPACE */}
      <div className="flex-1 h-full flex flex-col z-10 min-w-0 max-w-4xl mx-auto px-6 transition-all duration-300 ease-in-out">
        {/* Chat Thread Title Bar */}
        <header className="flex items-center gap-3 px-5 py-3.5 border-b border-blue-900/25 bg-[#050816]/60 backdrop-blur-sm mt-2 rounded-b-xl shadow-lg select-none">
          {/* 1. Back arrow */}
          <button 
            onClick={() => router.back()}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1 cursor-pointer"
            title="Back"
          >
            <ArrowLeft size={15} />
          </button>

          {/* 2. Chat title */}
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-mono text-blue-700 tracking-widest uppercase mb-0.5">
              Active Galaxy Orbit
            </div>
            <h1 className="text-sm font-semibold text-slate-200 truncate">{chatTitle}</h1>
          </div>

          {/* 3. Right side — Galaxy Map + Live Telemetry ONLY */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-950/50 border border-teal-800/30 shadow-inner shrink-0 select-none">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse shadow-[0_0_8px_#2dd4bf]" />
              <span className="text-[10px] text-teal-400 font-mono tracking-wide">
                Live Telemetry
              </span>
            </div>

            <button
              onClick={() => router.push(`/galaxy/${chatId}?view=focus`)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-violet-600/20 border border-violet-500/40 text-violet-300 hover:bg-violet-600/30 transition-all text-xs font-semibold tracking-wide cursor-pointer shadow-md"
            >
              <div className="w-3.5 h-3.5 relative shrink-0">
                {/* Clear orbit icon — 2 rings + center dot, no blur */}
                <div className="absolute inset-0 rounded-full border border-violet-400/70" />
                <div className="absolute inset-[3px] rounded-full border border-violet-300/50" />
                <div className="absolute inset-[5px] rounded-full bg-violet-300/80" />
              </div>
              Galaxy Map
            </button>
          </div>
        </header>

        <section className="flex-1 min-h-0 py-4">
          <ChatPanel
            chatId={chatId}
            onGalaxyUpdate={() => fetchGalaxyData(chatId)}
            onSetActiveRetrievals={setActiveRetrievedNodeIds}
            messages={activeMessages}
            setMessages={setActiveMessages}
          />
        </section>
      </div>

      {/* COLUMN 3: RIGHT CONTEXT JAR */}
      {rightOpen ? (
        <ContextJarSidebar
          nodes={nodes}
          candidates={candidates}
          onUpdatePriority={handleUpdatePriority}
          onToggleActive={handleToggleActive}
          onUpdateSummary={handleUpdateSummary}
          onRenameNode={handleRenameNode}
          onDeleteNode={handleDeleteNode}
          onReorderNodes={handleReorderNodes}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          isLoading={isLoading}
          onAddCustomNode={handleAddCustomNode}
          onCollapse={() => setRightOpen(false)}
        />
      ) : (
        <aside className="w-12 h-full flex flex-col items-center bg-[#060e25] border-l border-blue-900/20 z-10 py-4 gap-4 shrink-0 transition-all duration-300 ease-in-out overflow-hidden select-none">
          <button
            onClick={() => setRightOpen(true)}
            className="p-1.5 hover:bg-slate-850 text-slate-500 hover:text-white rounded-lg transition-all cursor-pointer border border-transparent hover:border-slate-800 relative shadow-md"
            title="Expand Context Jar"
          >
            <PanelRightOpen className="w-4 h-4" />
            {activeNodesCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-white text-[8px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-[#060e25] scale-90">
                {activeNodesCount}
              </span>
            )}
          </button>
          
          <div className="flex-1 flex flex-col items-center gap-3 overflow-y-auto w-full px-1 py-2">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] mb-1 shrink-0 animate-pulse" />
            {nodes.filter(n => n.data.is_active).slice(0, 8).map((node) => (
              <div 
                key={node.id} 
                onClick={() => { setRightOpen(true); setSelectedNodeId(node.id); }}
                className="w-7 h-7 rounded-full bg-slate-900/80 border border-blue-900/20 flex items-center justify-center text-[9px] font-black text-slate-400 hover:text-white hover:border-primary/50 cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-inner"
                title={`${node.data.label} (Click to inspect)`}
              >
                {node.data.label.substring(0, 2).toUpperCase()}
              </div>
            ))}
          </div>
        </aside>
      )}
    </main>
  );
}
