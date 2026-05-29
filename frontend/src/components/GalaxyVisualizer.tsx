"use client";

import React, { useEffect, useState, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  Edge,
  Node
} from "reactflow";
import "reactflow/dist/style.css";
import { Sparkles, EyeOff, Radio } from "lucide-react";

// PlanetNode: Custom Planet component for Root Context
const PlanetNode = ({ data }: any) => {
  return (
    <div className="relative flex flex-col items-center justify-center select-none cursor-pointer group">
      <Handle type="target" position={Position.Top} className="opacity-0 pointer-events-none" />
      
      {/* Outer orbit ring */}
      <div 
        className="absolute w-[100px] h-[100px] border border-violet-500/30 rounded-full pointer-events-none" 
        style={{ animation: "spin-slow 20s linear infinite" }}
      />

      {/* Glowing Sphere */}
      <div 
        className="w-20 h-20 rounded-full flex flex-col items-center justify-center text-center font-bold px-2 leading-tight text-white transition-all duration-300 group-hover:scale-108"
        style={{
          background: "radial-gradient(circle, #7c3aed 0%, #1a0830 100%)",
          boxShadow: "0 0 20px rgba(124, 58, 237, 0.5)",
          borderRadius: "50%",
        }}
      >
        <span className="truncate max-w-[70px] text-xs font-black tracking-wide text-violet-100">{data.label}</span>
      </div>
      <span className="mt-4 text-[9px] font-extrabold tracking-widest text-violet-400 uppercase opacity-90 drop-shadow-[0_0_3px_#7c3aed80]">Galaxy Core</span>
      <Handle type="source" position={Position.Bottom} className="opacity-0 pointer-events-none" />
    </div>
  );
};

// MoonNode: Custom Moon component for Subtopics
const MoonNode = ({ data }: any) => {
  return (
    <div className={`relative flex flex-col items-center justify-center select-none cursor-pointer group transition-opacity duration-300 ${data.is_active ? "opacity-100" : "opacity-40"}`}>
      <Handle type="target" position={Position.Top} className="opacity-0 pointer-events-none" />
      <div 
        className="w-[60px] h-[60px] rounded-full flex flex-col items-center justify-center text-center p-1 leading-tight text-white transition-all duration-300 group-hover:scale-108"
        style={{
          background: "radial-gradient(circle, #3b82f6 0%, #06112c 100%)",
          boxShadow: "0 0 15px rgba(59, 130, 246, 0.5)",
          borderRadius: "50%",
        }}
      >
        <span className="truncate max-w-[45px] text-[10px] font-bold text-blue-100">{data.label}</span>
      </div>
      {!data.is_active && (
        <span className="mt-2 flex items-center bg-slate-950/80 border border-slate-800 px-1 py-0.5 rounded text-[7px] text-slate-500 font-bold uppercase tracking-wider gap-0.5">
          <EyeOff className="w-2 h-2" /> Deep Space
        </span>
      )}
      <Handle type="source" position={Position.Bottom} className="opacity-0 pointer-events-none" />
    </div>
  );
};

// CandidateNode: Custom Candidate component for Forming Topics
const CandidateNode = ({ data }: any) => {
  const mentions = Math.round(data.mention_count || data.mentions || 1);
  const isCrystallized = mentions >= 3;

  return (
    <div className="relative flex flex-col items-center justify-center select-none cursor-pointer group">
      <Handle type="target" position={Position.Top} className="opacity-0 pointer-events-none" />
      <div 
        className="w-[44px] h-[44px] rounded-full flex flex-col items-center justify-center text-center p-1 leading-tight text-slate-400 transition-all duration-300 group-hover:scale-108"
        style={{
          background: isCrystallized 
            ? "radial-gradient(circle, #3b82f6 0%, #06112c 100%)" 
            : "radial-gradient(circle, #374151 0%, #0f172a 100%)",
          boxShadow: isCrystallized ? "0 0 15px rgba(59, 130, 246, 0.6)" : "none",
          border: isCrystallized ? "none" : "1px dashed rgba(255, 255, 255, 0.2)",
          borderRadius: "50%",
        }}
      >
        <span className="truncate max-w-[32px] text-[8px] font-medium text-slate-300">{data.label}</span>
      </div>
      <div className="mt-1.5 flex flex-col items-center">
        <span className="text-[7px] text-cyan-500/80 font-bold uppercase tracking-wider leading-none">Forming</span>
        <span className="text-[8px] font-black text-slate-500 mt-0.5">{mentions}/3</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0 pointer-events-none" />
    </div>
  );
};

// Bind custom types OUTSIDE the component body (module level) to prevent infinite render loops
const nodeTypes = {
  planet: PlanetNode,
  moon: MoonNode,
  candidate: CandidateNode
};

interface GalaxyVisualizerProps {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  activeRetrievedNodeIds?: string[];
}

export default function GalaxyVisualizer({
  nodes: rawNodes,
  edges: rawEdges,
  selectedNodeId,
  onSelectNode,
  activeRetrievedNodeIds = []
}: GalaxyVisualizerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Strict Update Guard: Use a ref to store a serialized key of rawNodes and rawEdges to exit early if equal
  const prevNodesKey = useRef<string>("");

  // Compute procedurally generated galaxy orbits layout
  useEffect(() => {
    const currentKey = JSON.stringify({ rawNodes, rawEdges, selectedNodeId, activeRetrievedNodeIds });
    if (currentKey === prevNodesKey.current) {
      return;
    }
    prevNodesKey.current = currentKey;

    if (rawNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const rootNode = rawNodes.find((n) => n.type === "planet");
    if (!rootNode) return;

    // Direct children (active first-level moons)
    const directChildren = rawNodes.filter(
      (n) => n.type === "moon" && n.data.is_active && (!n.data.parent_id || n.data.parent_id === rootNode.id)
    );

    // Candidate nodes
    const candidateNodes = rawNodes.filter((n) => n.type === "candidate");

    // Deep Space / Inactive moons
    const archivedNodes = rawNodes.filter((n) => n.type === "moon" && !n.data.is_active);

    // Position Root planet in coordinate center
    const positionedNodes: Node[] = [
      {
        ...rootNode,
        position: { x: 0, y: 0 }
      }
    ];

    // Compute direct children orbit rings
    const R1 = 180;
    directChildren.forEach((node, index) => {
      const angle = (index * 2 * Math.PI) / Math.max(directChildren.length, 1);
      const x = R1 * Math.cos(angle);
      const y = R1 * Math.sin(angle);

      positionedNodes.push({
        ...node,
        position: { x, y }
      });
    });

    // Compute Candidate orbit rings
    const R_cand = 270;
    candidateNodes.forEach((node, index) => {
      const angle = (index * 2 * Math.PI) / Math.max(candidateNodes.length, 1) + Math.PI / 6;
      const x = R_cand * Math.cos(angle);
      const y = R_cand * Math.sin(angle);

      positionedNodes.push({
        ...node,
        position: { x, y }
      });
    });

    // Compute Deep Space outer shell circles
    const R2 = 380;
    archivedNodes.forEach((node, index) => {
      const angle = (index * 2 * Math.PI) / Math.max(archivedNodes.length, 1) + Math.PI / 4; // Shift angle slightly
      const x = R2 * Math.cos(angle);
      const y = R2 * Math.sin(angle);

      positionedNodes.push({
        ...node,
        position: { x, y }
      });
    });

    // Style edges with animations and colors depending on state
    const styledEdges = rawEdges.map((edge) => {
      const isRetrieved = activeRetrievedNodeIds.includes(edge.source) || activeRetrievedNodeIds.includes(edge.target);
      const isSelected = selectedNodeId === edge.source || selectedNodeId === edge.target;

      let strokeColor = "rgba(59, 130, 246, 0.25)";
      let strokeWidth = 1.5;

      if (isRetrieved) {
        strokeColor = "rgba(236, 72, 153, 0.8)"; // Highlight active pink
        strokeWidth = 2.5;
      } else if (isSelected) {
        strokeColor = "rgba(139, 92, 246, 0.8)"; // Highlight active purple
        strokeWidth = 2.0;
      }

      return {
        ...edge,
        style: {
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: "6",
          animation: "dash 15s linear infinite"
        }
      };
    });

    // Sync state
    setNodes(positionedNodes);
    setEdges(styledEdges);
  }, [rawNodes, rawEdges, selectedNodeId, activeRetrievedNodeIds, setNodes, setEdges]);

  // Click node handler
  const handleNodeClick = (_: any, node: Node) => {
    onSelectNode(node.id === selectedNodeId ? null : node.id);
  };

  const handlePaneClick = () => {
    onSelectNode(null);
  };

  return (
    <div className="w-full h-full relative" style={{ background: "transparent" }}>
      {activeRetrievedNodeIds.length > 0 && (
        <div className="absolute top-4 left-4 z-10 glass-panel border border-pink-500/30 rounded px-2.5 py-1 text-[10px] font-bold text-pink-400 flex items-center gap-1.5 shadow-[0_0_10px_rgba(236,72,153,0.2)]">
          <Sparkles className="w-3.5 h-3.5 animate-spin" /> Memory Orbits Active
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.5}
        className="w-full h-full"
      >
        <Background color="#ffffff" gap={60} size={0.5} style={{ opacity: 0.05 }} />
        <Controls className="!bg-slate-950/80 !border-slate-800 !text-slate-400 [&_button]:!bg-transparent [&_button]:!border-slate-800/50 [&_svg]:!fill-slate-400 [&_button:hover]:!bg-slate-900" />
      </ReactFlow>
    </div>
  );
}
