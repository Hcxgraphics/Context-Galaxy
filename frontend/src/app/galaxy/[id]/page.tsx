"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Orbit,
  Sparkles,
  ArrowLeft,
  Loader2,
  Compass,
  Edit2,
  Check,
  Zap,
  Activity,
  Star,
  Eye,
  EyeOff
} from "lucide-react";

// Dynamically import GalaxyVisualizer to avoid SSR issues
const GalaxyVisualizer = dynamic(() => import("@/components/GalaxyVisualizer"), { ssr: false });

interface ContextNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    priority: string;
    is_active: boolean;
    summary: string;
    activation_score: number;
    frequency_score: number;
    depth_level: number;
  };
}

interface EdgeItem {
  id: string;
  source: string;
  target: string;
  type: string;
  animated: boolean;
  data: {
    relationship_type: string;
    weight: number;
  };
}

export default function GalaxyExplorer() {
  const params = useParams();
  const searchParams = useSearchParams();
  const viewMode = searchParams.get("view") || "focus";
  const chatId = params.id as string;

  const [chatTitle, setChatTitle] = useState("Loading Coordinates...");
  const [nodes, setNodes] = useState<ContextNode[]>([]);
  const [edges, setEdges] = useState<EdgeItem[]>([]);
  
  // Selection & Loading States
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingNodeId, setUpdatingNodeId] = useState<string | null>(null);

  // Inspector Editor states
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryText, setSummaryText] = useState("");

  const [stars, setStars] = useState<{ id: number; size: number; left: number; top: number; opacity: number; duration: number; delay: number }[]>([]);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Generate twinkling stars only on client side to avoid Next.js hydration mismatch
  useEffect(() => {
    const generatedStars = Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      size: Math.random() * 1.5 + 0.5,
      left: Math.random() * 200,
      top: Math.random() * 200,
      opacity: Math.random() * 0.7 + 0.3,
      duration: Math.random() * 3 + 2,
      delay: Math.random() * 4,
    }));
    setStars(generatedStars);
  }, []);

  // Fetch full galaxy coordinates (nodes, edges)
  const fetchGalaxyData = async (activeChatId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${apiBase}/context/all/graph`);
      if (!response.ok) throw new Error("Failed to load galaxy structure");
      const data = await response.json();
      
      // Fetch user's active sidebar chat history
      const chatsResponse = await fetch(`${apiBase}/chat/all`);
      if (chatsResponse.ok) {
        const chats = await chatsResponse.json();
        
        // Filter out deleted chats from localStorage
        const deletedIds = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("deleted_chat_ids") || "[]") : [];
        const activeChats = (chats || []).filter((c: any) => !deletedIds.includes(c.id));
        const activeChatIds = activeChats.map((c: any) => c.id);
        
        // Filter out nodes and galaxies that do not belong to active chat IDs
        const filteredNodes = (data.nodes || []).filter((node: any) => 
          node.data && activeChatIds.includes(node.data.chat_id)
        );
        
        // Filter edges to only link active nodes
        const activeNodeIds = filteredNodes.map((n: any) => n.id);
        const filteredEdges = (data.edges || []).filter((edge: any) => 
          activeNodeIds.includes(edge.source) && activeNodeIds.includes(edge.target)
        );

        setNodes(filteredNodes);
        setEdges(filteredEdges);

        if (activeChatId === "all" || viewMode === "all") {
          setChatTitle("Knowledge Universe Map");
        } else {
          const matched = activeChats.find((c: any) => c.id === activeChatId);
          if (matched) {
            setChatTitle(matched.title);
          }
        }
      } else {
        setNodes([]);
        setEdges([]);
      }
    } catch (err) {
      console.error("Error loading galaxy graph:", err);
      setNodes([]);
      setEdges([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (chatId) {
      fetchGalaxyData(chatId);
    }
  }, [chatId, viewMode]);

  // Find currently selected node representation
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // Update selection properties in inspector
  useEffect(() => {
    if (selectedNode) {
      setSummaryText(selectedNode.data.summary);
      setIsEditingSummary(false);
    }
  }, [selectedNodeId, selectedNode]);

  // Override handlers
  const handleUpdatePriority = async (priority: string) => {
    if (!selectedNodeId) return;
    setUpdatingNodeId(selectedNodeId);
    try {
      const response = await fetch(`${apiBase}/context/node/${selectedNodeId}/priority`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority })
      });
      if (response.ok) {
        await fetchGalaxyData(chatId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingNodeId(null);
    }
  };

  const handleToggleActive = async () => {
    if (!selectedNodeId) return;
    setUpdatingNodeId(selectedNodeId);
    try {
      const response = await fetch(`${apiBase}/context/node/${selectedNodeId}/toggle_active`, {
        method: "POST"
      });
      if (response.ok) {
        await fetchGalaxyData(chatId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingNodeId(null);
    }
  };

  const handleSaveSummary = async () => {
    if (!selectedNodeId) return;
    setUpdatingNodeId(selectedNodeId);
    try {
      const response = await fetch(`${apiBase}/context/node/${selectedNodeId}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: summaryText })
      });
      if (response.ok) {
        await fetchGalaxyData(chatId);
        setIsEditingSummary(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingNodeId(null);
    }
  };

  // Group items for layout statistics
  const activeCount = nodes.filter((n) => n.data.is_active).length;
  const archivedCount = nodes.filter((n) => !n.data.is_active).length;

  return (
    <main className="relative w-full h-screen overflow-hidden flex flex-col bg-gradient-to-br from-[#020917] to-[#040d24] text-slate-100">
      
      {/* 60-100 client-side scattered twinkling stars */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
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

      {/* 2-3 large blurred nebula divs using filter: blur(60px) and radial-gradients with violet/blue at ~8% opacity that drift with nebula-drift animation */}
      <div 
        className="absolute w-[600px] h-[600px] rounded-full blur-[60px] pointer-events-none top-[10%] left-[20%] animate-nebula-drift z-0 opacity-80"
        style={{
          background: "radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)"
        }}
      />
      <div 
        className="absolute w-[500px] h-[500px] rounded-full blur-[60px] pointer-events-none bottom-[20%] right-[15%] animate-nebula-drift z-0 opacity-80"
        style={{
          background: "radial-gradient(circle, rgba(29,78,216,0.08) 0%, transparent 70%)",
          animationDelay: "-7s"
        }}
      />
      <div 
        className="absolute w-[450px] h-[450px] rounded-full blur-[60px] pointer-events-none top-[50%] left-[60%] animate-nebula-drift z-0 opacity-80"
        style={{
          background: "radial-gradient(circle, rgba(8,145,178,0.08) 0%, transparent 70%)",
          animationDelay: "-14s"
        }}
      />

      {/* FULLSCREEN HEADER DOCK */}
      <header className="glass-panel border-b border-[rgba(59,130,246,0.12)] px-6 py-4 flex items-center justify-between shrink-0 z-10 m-3 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.4)] select-none">
        <div className="flex items-center gap-4">
          <Link
            href={`/chat/${chatId}`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#030c1f]/60 border border-[rgba(59,130,246,0.12)] hover:bg-[#0a1535] text-slate-400 hover:text-white transition-colors text-[10px] font-bold uppercase rounded-lg shadow"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Return to Chat
          </Link>

          <div className="h-6 w-px bg-slate-800" />

          <div>
            <span className="text-[8px] font-bold text-[#7c3aed] uppercase tracking-widest block mb-0.5">
              Fullscreen Explorer
            </span>
            <h1 className="text-xs font-black text-white uppercase tracking-wider truncate max-w-[400px]">
              {chatTitle}
            </h1>
          </div>
        </div>

        {/* Dynamic Telemetry Stats */}
        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500">
          <div className="flex items-center gap-1.5">
            <Orbit className="w-4 h-4 text-[#7c3aed] animate-spin-slow" />
            <span>Active Planet/Moons: <strong className="text-white">{activeCount}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-slate-600" />
            <span>Deep Space Archives: <strong className="text-white">{archivedCount}</strong></span>
          </div>
          {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />}
        </div>
      </header>

      {/* FULL SCREEN CANVAS WORKSPACE */}
      <div className="flex-1 min-h-0 relative z-10">
        <GalaxyVisualizer
          nodes={nodes}
          edges={edges}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          activeChatId={chatId}
          viewMode={viewMode}
        />

        {/* BOTTOM INSPECTOR SHEET OVERLAY (Fades and slides open on-node click) */}
        {selectedNode && (
          <div className="absolute bottom-6 left-6 right-6 max-w-4xl mx-auto glass-panel p-5 rounded-2xl border border-[rgba(59,130,246,0.22)] shadow-[0_0_40px_rgba(124,58,237,0.18)] z-20 select-none text-xs flex gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Left Col Node Type Badge */}
            <div className="flex flex-col items-center shrink-0 w-24 border-r border-slate-900 pr-5 py-1 justify-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border animate-pulse ${
                  selectedNode.type === "planet"
                    ? "bg-rose-950/40 border-rose-500/30 text-rose-400"
                    : "bg-violet-950/40 border-violet-500/30 text-violet-400"
                }`}
              >
                <Orbit className="w-5 h-5 animate-spin-slow" />
              </div>
              <span className="mt-2 text-[8px] font-extrabold uppercase tracking-widest text-slate-500">
                {selectedNode.type === "planet" ? "Galaxy Core" : "Solar Moon"}
              </span>
            </div>

            {/* Middle Col Node Details & Manual Overrides */}
            <div className="flex-1 space-y-3.5">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm font-black text-white uppercase tracking-wider">
                  {selectedNode.data.label}
                </h2>

                {/* Overrides control block */}
                <div className="flex items-center gap-2">
                  {/* Priority Select */}
                  <div className="flex items-center gap-1 bg-[#060e25] px-2 py-1 rounded border border-[rgba(59,130,246,0.12)]">
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mr-1">Priority:</span>
                    {["high", "medium", "low"].map((p) => {
                      const isMatch = selectedNode.data.priority.toLowerCase() === p;
                      const activeColor = p === "high"
                        ? "bg-rose-600 text-white"
                        : p === "low"
                          ? "bg-cyan-600 text-white"
                          : "bg-violet-600 text-white";

                      return (
                        <button
                          key={p}
                          onClick={() => handleUpdatePriority(p)}
                          disabled={updatingNodeId === selectedNodeId}
                          className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase transition-colors ${
                            isMatch
                              ? activeColor
                              : "text-slate-600 hover:text-slate-400"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Toggle */}
                  <button
                    onClick={handleToggleActive}
                    disabled={updatingNodeId === selectedNodeId}
                    className={`px-2.5 py-1 rounded-lg border font-bold text-[9px] uppercase flex items-center gap-1.5 transition-all shadow ${
                      selectedNode.data.is_active
                        ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-400"
                        : "bg-[#060e25] border-slate-800 text-slate-500"
                    }`}
                  >
                    {selectedNode.data.is_active ? (
                      <>
                        <Eye className="w-3.5 h-3.5" /> Active Orbit
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" /> Deep Space
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Node Summary Text Box */}
              <div className="space-y-1 bg-[#060e25]/40 border border-[rgba(59,130,246,0.12)] rounded-xl p-3 shadow-inner">
                <div className="flex items-center justify-between text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                  <span>Semantic Context Summary</span>
                  {updatingNodeId === selectedNodeId && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />}
                </div>

                {isEditingSummary ? (
                  <div className="mt-1.5 space-y-1.5">
                    <textarea
                      value={summaryText}
                      onChange={(e) => setSummaryText(e.target.value)}
                      className="w-full text-xs bg-[#060e25] border border-[rgba(59,130,246,0.22)] rounded-lg p-2 text-slate-200 outline-none focus:border-[#7c3aed]/40 h-16 resize-none shadow-inner"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => setIsEditingSummary(false)}
                        className="px-2 py-0.5 rounded text-[9px] bg-slate-900 hover:bg-slate-800 border border-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveSummary}
                        className="px-2.5 py-0.5 rounded text-[9px] bg-[#7c3aed] hover:brightness-110 text-white font-extrabold flex items-center gap-0.5 shadow"
                        disabled={updatingNodeId === selectedNodeId}
                      >
                        <Check className="w-3.5 h-3.5" /> Save Override
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 mt-1 group">
                    <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                      {selectedNode.data.summary}
                    </p>
                    <button
                      onClick={() => setIsEditingSummary(true)}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-[#7c3aed] transition-all p-0.5 self-center"
                      title="Edit summary manually"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
