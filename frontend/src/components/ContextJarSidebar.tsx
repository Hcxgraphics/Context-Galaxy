"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Orbit,
  Star,
  Edit2,
  Trash2,
  Check,
  Eye,
  EyeOff,
  GripVertical,
  Calendar,
  X,
  Loader2,
  Plus,
  PanelRightClose
} from "lucide-react";

interface ContextNode {
  id: string;
  type: string;
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

interface CandidateTopic {
  id: string;
  topic: string;
  mention_count: number;
  semantic_relevance: number;
  persistence_score: number;
}

interface ContextJarSidebarProps {
  nodes: ContextNode[];
  candidates: CandidateTopic[];
  onUpdatePriority: (nodeId: string, priority: string) => Promise<void>;
  onToggleActive: (nodeId: string) => Promise<void>;
  onUpdateSummary: (nodeId: string, summary: string) => Promise<void>;
  onRenameNode: (nodeId: string, label: string) => Promise<void>;
  onDeleteNode: (nodeId: string) => Promise<void>;
  onReorderNodes: (reorderedNodes: ContextNode[]) => void;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  isLoading: boolean;
  onAddCustomNode?: (label: string, summary: string) => Promise<void>;
  onCollapse?: () => void;
}

export default function ContextJarSidebar({
  nodes,
  candidates,
  onUpdatePriority,
  onToggleActive,
  onUpdateSummary,
  onRenameNode,
  onDeleteNode,
  onReorderNodes,
  selectedNodeId,
  onSelectNode,
  isLoading,
  onAddCustomNode,
  onCollapse
}: ContextJarSidebarProps) {
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");

  // Custom hook for delayed hover tooltips
  const useDelayedTooltip = (text: string, delayMs = 2500) => {
    const [visible, setVisible] = useState(false);
    const timerRef = React.useRef<NodeJS.Timeout | null>(null);

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

    React.useEffect(() => {
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }, []);

    return { visible, onMouseEnter, onMouseLeave };
  };

  const activeCoreTooltip = useDelayedTooltip("Active Core represents the currently activated semantic memories loaded into the system prompt.");
  const deepSpaceTooltip = useDelayedTooltip("Deep Space represents the archived semantic memories that are persisted but currently bypassed in reasoning.");
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editSummaryText, setEditSummaryText] = useState("");
  const [updatingNodeId, setUpdatingNodeId] = useState<string | null>(null);

  // Rename states
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");

  // Custom Node manual creation states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [isAddingNode, setIsAddingNode] = useState(false);

  // Drag and Drop States
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);

  // Filter nodes into active and archived lists
  const activeNodes = nodes.filter((n) => n.data.is_active);
  const archivedNodes = nodes.filter((n) => !n.data.is_active);

  // Edit Description Summary Handlers
  const handleEditSummaryClick = (node: ContextNode) => {
    setEditingNodeId(node.id);
    setEditSummaryText(node.data.summary);
  };

  const handleSaveSummary = async (nodeId: string) => {
    setUpdatingNodeId(nodeId);
    await onUpdateSummary(nodeId, editSummaryText);
    setEditingNodeId(null);
    setUpdatingNodeId(null);
  };

  // Rename Label Handlers
  const handleRenameClick = (node: ContextNode) => {
    setRenamingNodeId(node.id);
    setRenameText(node.data.label);
  };

  const handleSaveRename = async (nodeId: string) => {
    if (!renameText.trim()) return;
    setUpdatingNodeId(nodeId);
    await onRenameNode(nodeId, renameText.trim());
    setRenamingNodeId(null);
    setUpdatingNodeId(null);
  };

  const handlePrioChange = async (nodeId: string, priority: string) => {
    setUpdatingNodeId(nodeId);
    await onUpdatePriority(nodeId, priority);
    setUpdatingNodeId(null);
  };

  const handleToggleClick = async (nodeId: string) => {
    setUpdatingNodeId(nodeId);
    await onToggleActive(nodeId);
    setUpdatingNodeId(null);
  };

  const handleDeleteClick = async (nodeId: string) => {
    if (confirm("Are you sure you want to delete this memory segment from this galaxy?")) {
      setUpdatingNodeId(nodeId);
      await onDeleteNode(nodeId);
      setUpdatingNodeId(null);
    }
  };

  // HTML5 Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, nodeId: string) => {
    setDraggedNodeId(nodeId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetNodeId: string) => {
    e.preventDefault();
    if (!draggedNodeId || draggedNodeId === targetNodeId) return;

    // Find indices
    const draggedIndex = nodes.findIndex((n) => n.id === draggedNodeId);
    const targetIndex = nodes.findIndex((n) => n.id === targetNodeId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Swap elements in the array
    const reordered = [...nodes];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    // Call reorder trigger
    onReorderNodes(reordered);
    setDraggedNodeId(null);
  };

  return (
    <aside className="w-72 h-full flex flex-col bg-[#060e25] border-l border-blue-900/20 z-10 select-none text-slate-300 shrink-0">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Orbit className="w-5 h-5 text-primary animate-spin-slow" />
          <h2 className="text-xs font-black tracking-widest uppercase text-white bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Context Jar
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "active" && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="py-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[10px] font-bold text-slate-400 hover:text-white flex items-center gap-1 transition-all cursor-pointer select-none"
              title="Add a manual context moon"
            >
              {showAddForm ? <X className="w-3 h-3 text-rose-400" /> : <Plus className="w-3 h-3 text-primary" />}
              <span>Add Moon</span>
            </button>
          )}
          {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />}
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="p-1 hover:bg-slate-850 text-slate-500 hover:text-white rounded-lg transition-all cursor-pointer border border-transparent hover:border-slate-800"
              title="Collapse Context Jar"
            >
              <PanelRightClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-900 bg-slate-950/20 text-[10px] font-bold uppercase tracking-wider relative select-none">
        <button
          onClick={() => setActiveTab("active")}
          onMouseEnter={activeCoreTooltip.onMouseEnter}
          onMouseLeave={activeCoreTooltip.onMouseLeave}
          className={`flex-1 py-3 text-center border-b-2 transition-all relative ${
            activeTab === "active"
              ? "text-primary border-primary bg-primary/5"
              : "text-slate-500 border-transparent hover:text-slate-300"
          }`}
        >
          Active Core ({activeNodes.length})
          {activeCoreTooltip.visible && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-48 p-2.5 bg-slate-950 border border-blue-900/40 text-[9px] text-slate-400 rounded-lg shadow-2xl z-50 normal-case select-none pointer-events-none leading-normal font-medium filter drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]">
              Active Core represents the currently activated semantic memories loaded into the system prompt.
            </div>
          )}
        </button>
        <button
          onClick={() => setActiveTab("archived")}
          onMouseEnter={deepSpaceTooltip.onMouseEnter}
          onMouseLeave={deepSpaceTooltip.onMouseLeave}
          className={`flex-1 py-3 text-center border-b-2 transition-all relative ${
            activeTab === "archived"
              ? "text-accent border-accent bg-accent/5"
              : "text-slate-500 border-transparent hover:text-slate-300"
          }`}
        >
          Deep Space ({archivedNodes.length})
          {deepSpaceTooltip.visible && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-48 p-2.5 bg-slate-950 border border-blue-900/40 text-[9px] text-slate-400 rounded-lg shadow-2xl z-50 normal-case select-none pointer-events-none leading-normal font-medium filter drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]">
              Deep Space represents the archived semantic memories that are persisted but currently bypassed in reasoning.
            </div>
          )}
        </button>
      </div>

      {/* Scrollable Overrides content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === "active" ? (
          <div>
            <h3 className="text-[9px] font-extrabold uppercase text-slate-600 tracking-wider mb-3 flex items-center gap-1.5 px-1">
              <Star className="w-3.5 h-3.5 text-primary" /> Active Memories
            </h3>

            {/* Collapsible Form for Manual Moon Creation */}
            {showAddForm && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newLabel.trim() || !newSummary.trim() || isAddingNode) return;
                  setIsAddingNode(true);
                  try {
                    if (onAddCustomNode) {
                      await onAddCustomNode(newLabel.trim(), newSummary.trim());
                      setNewLabel("");
                      setNewSummary("");
                      setShowAddForm(false);
                    }
                  } catch (err) {
                    console.error("Failed to add manual moon:", err);
                  } finally {
                    setIsAddingNode(false);
                  }
                }}
                className="mb-4 p-3 bg-slate-950/40 border border-primary/20 rounded-xl space-y-2.5 shadow-[inset_0_0_12px_rgba(109,93,254,0.05)] text-left select-text"
              >
                <div className="text-[9px] font-bold uppercase text-primary tracking-wider border-b border-slate-900/60 pb-1 flex justify-between items-center select-none">
                  <span>Crystallize Custom Moon</span>
                  <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-slate-500 tracking-wider block select-none">Moon Label</label>
                  <input
                    type="text"
                    placeholder="e.g. Postgres DB Sharding"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="w-full bg-[#060e25] border border-blue-900/40 text-xs text-white rounded-lg p-2 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 placeholder-slate-700 font-medium"
                    required
                    disabled={isAddingNode}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-slate-500 tracking-wider block select-none">Context Summary</label>
                  <textarea
                    placeholder="Describe this context details concise..."
                    value={newSummary}
                    onChange={(e) => setNewSummary(e.target.value)}
                    className="w-full bg-[#060e25] border border-blue-900/40 text-xs text-white rounded-lg p-2 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 placeholder-slate-700 font-medium min-h-[50px] max-h-[100px] resize-y leading-normal"
                    required
                    disabled={isAddingNode}
                  />
                </div>
                <div className="flex justify-end gap-1.5 text-[9px] font-bold uppercase pt-1 select-none">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-2.5 py-1 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-md transition-all cursor-pointer"
                    disabled={isAddingNode}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-gradient-to-r from-primary to-accent hover:brightness-110 text-white rounded-md transition-all flex items-center gap-1 shadow-[0_0_8px_rgba(109,93,254,0.2)] cursor-pointer"
                    disabled={isAddingNode}
                  >
                    {isAddingNode ? (
                      <>
                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Inserting...
                      </>
                    ) : (
                      <>
                        <Check className="w-2.5 h-2.5" /> Crystallize
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {activeNodes.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-600 border border-dashed border-slate-900 rounded-xl leading-relaxed bg-[#060e25]">
                Context core empty. Crystallize moons by discussing topics in chat!
              </div>
            ) : (
              <div className="space-y-3">
                {activeNodes.map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  const priorityLower = node.data.priority.toLowerCase();
                  
                  // Priority Badges: HIGH = red tint (rgba(239,68,68,0.12)), MEDIUM = blue tint (rgba(59,130,246,0.12)), LOW = gray tint
                  const badgeStyle = priorityLower === "high"
                    ? { color: "#f87171", borderColor: "rgba(239, 68, 68, 0.2)", backgroundColor: "rgba(239, 68, 68, 0.12)" }
                    : priorityLower === "low"
                      ? { color: "#94a3b8", borderColor: "rgba(148, 163, 184, 0.2)", backgroundColor: "rgba(148, 163, 184, 0.12)" }
                      : { color: "#60a5fa", borderColor: "rgba(59, 130, 246, 0.2)", backgroundColor: "rgba(59, 130, 246, 0.12)" };

                  return (
                    <div
                      key={node.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, node.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, node.id)}
                      onClick={() => onSelectNode(isSelected ? null : node.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer relative group/card flex gap-2.5 items-center ${
                        isSelected
                          ? "bg-[#060e25] border-primary/50 shadow-[0_0_12px_rgba(109,93,254,0.15)]"
                          : "bg-[#060e25] border-blue-800/25 hover:border-blue-800/50"
                      }`}
                    >
                      {/* Glowing Left Dot */}
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] shrink-0" />

                      {/* Drag Handle */}
                      <div className="flex items-center text-slate-700 hover:text-slate-500 cursor-grab shrink-0">
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Title block & rename toggle */}
                        <div className="flex items-center justify-between gap-2">
                          {renamingNodeId === node.id ? (
                            <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={renameText}
                                onChange={(e) => setRenameText(e.target.value)}
                                className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-white outline-none w-full"
                                required
                              />
                              <button
                                onClick={() => handleSaveRename(node.id)}
                                className="p-0.5 bg-primary/20 border border-primary/30 rounded text-emerald-400 hover:bg-primary/30"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setRenamingNodeId(null)}
                                className="p-0.5 bg-slate-900 border border-slate-800 rounded text-rose-400 hover:bg-slate-800"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-bold text-xs text-white truncate max-w-[110px]">
                                {node.data.label}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRenameClick(node);
                                }}
                                className="opacity-0 group-hover/card:opacity-100 text-slate-600 hover:text-primary transition-all p-0.5"
                                title="Rename topic"
                              >
                                <Edit2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )}

                          {/* Overrides Dropdowns */}
                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={priorityLower}
                              onChange={(e) => handlePrioChange(node.id, e.target.value)}
                              style={badgeStyle}
                              className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border outline-none cursor-pointer"
                              disabled={updatingNodeId === node.id}
                            >
                              <option value="high" className="bg-[#060e25] text-red-400">High</option>
                              <option value="medium" className="bg-[#060e25] text-blue-400">Medium</option>
                              <option value="low" className="bg-[#060e25] text-slate-400">Low</option>
                            </select>
                          </div>
                        </div>

                        {/* Inline Description summary editor */}
                        {editingNodeId === node.id ? (
                          <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                            <textarea
                              value={editSummaryText}
                              onChange={(e) => setEditSummaryText(e.target.value)}
                              className="w-full text-[10px] bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-300 outline-none focus:border-primary/40 h-12 resize-none leading-normal shadow-inner"
                            />
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => setEditingNodeId(null)}
                                className="px-2 py-0.5 rounded text-[8px] bg-slate-900 border border-slate-800"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveSummary(node.id)}
                                className="px-2.5 py-0.5 rounded text-[8px] bg-primary hover:brightness-110 text-white font-extrabold flex items-center gap-0.5"
                                disabled={updatingNodeId === node.id}
                              >
                                <Check className="w-3 h-3" /> Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-1 justify-between group/desc leading-normal text-[10px] text-slate-400 font-medium">
                            <p className="flex-1">{node.data.summary}</p>
                            <button
                              onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditSummaryClick(node);
                              }}
                              className="opacity-0 group-hover/card:opacity-100 text-slate-600 hover:text-primary transition-all p-0.5 shrink-0"
                              title="Edit summary"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )}

                        {/* Metadata display */}
                        <div className="pt-2 border-t border-slate-900/60 flex items-center justify-between text-[8px] font-bold text-slate-600 uppercase tracking-wide">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Active: 5m ago
                          </span>
                          
                          {/* Card actions */}
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleToggleClick(node.id)}
                              className="text-slate-600 hover:text-primary transition-all"
                              title="Archive to Deep Space"
                              disabled={updatingNodeId === node.id}
                            >
                              <EyeOff className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(node.id)}
                              className="text-slate-600 hover:text-rose-400 transition-all"
                              title="Wipe memory segment"
                              disabled={updatingNodeId === node.id}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Forming memory candidates Section */}
            {candidates && candidates.length > 0 && (() => {
              const sortedCandidates = [...candidates].sort((a, b) => {
                if (b.mention_count !== a.mention_count) {
                  return b.mention_count - a.mention_count;
                }
                return a.topic.localeCompare(b.topic);
              });
              const topCandidates = sortedCandidates.slice(0, 5);
              
              return (
                <div className="pt-4 border-t border-blue-900/20 mt-4">
                  <h3 className="text-[9px] font-extrabold uppercase text-slate-500 tracking-wider mb-3 flex items-center gap-1.5 px-1">
                    <Orbit className="w-3.5 h-3.5 text-cyan-500 animate-spin-slow" /> Forming Moons
                  </h3>
                  <div className="space-y-2 select-none">
                    {topCandidates.map((cand) => {
                      const mentions = Math.round(cand.mention_count);
                      const progressPercentage = Math.min((cand.mention_count / 3) * 100, 100);
                      return (
                        <div
                          key={cand.id}
                          className="p-3 rounded-xl border border-blue-900/20 bg-[#060e25] text-slate-400 flex flex-col gap-2 transition-all hover:border-blue-800/40"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs text-slate-200 truncate max-w-[155px]">{cand.topic}</span>
                            <span className="text-[9px] font-extrabold text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-900 shrink-0 font-mono">
                              {mentions}/3 MENTIONS
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1 font-mono text-[9px] text-blue-400 font-bold uppercase tracking-wider">
                            <Loader2 className="w-3 h-3 animate-spin text-blue-400 shrink-0" />
                            <span>CONDENSING ORBIT...</span>
                          </div>

                          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-blue-900/20">
                            <div 
                              className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${progressPercentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          /* ARCHIVED/DEEP SPACE TAB VIEW */
          <div>
            <h3 className="text-[9px] font-extrabold uppercase text-slate-600 tracking-wider mb-3 flex items-center gap-1.5 px-1">
              <EyeOff className="w-3.5 h-3.5 text-slate-500" /> Deep Space (Archived)
            </h3>
            {archivedNodes.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-600 border border-dashed border-slate-900 rounded-xl leading-relaxed bg-[#060e25]">
                Deep space is currently empty.
              </div>
            ) : (
              <div className="space-y-2 opacity-70">
                {archivedNodes.map((node) => (
                  <div
                    key={node.id}
                    className="p-3 rounded-lg bg-[#060e25] border border-blue-900/20 flex items-center justify-between gap-4 text-xs group hover:border-blue-800/40 transition-colors"
                  >
                    <div className="truncate max-w-[140px]">
                      <span className="font-bold text-slate-300 block truncate">{node.data.label}</span>
                      <span className="text-[8px] text-slate-600 uppercase font-bold tracking-wider">Archived orbit</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleClick(node.id)}
                        className="text-slate-600 hover:text-emerald-400 transition-colors p-1"
                        title="Reactivate memory node"
                        disabled={updatingNodeId === node.id}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(node.id)}
                        className="text-slate-600 hover:text-rose-400 transition-colors p-1"
                        title="Delete memory node"
                        disabled={updatingNodeId === node.id}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
