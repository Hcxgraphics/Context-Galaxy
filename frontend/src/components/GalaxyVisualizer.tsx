"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  EyeOff, 
  Orbit, 
  Activity, 
  Zap, 
  ArrowRight, 
  Clock,
  X 
} from "lucide-react";

// Class merging helper
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

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
    chat_id?: string;
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

interface GalaxyVisualizerProps {
  nodes: ContextNode[];
  edges: EdgeItem[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  activeRetrievedNodeIds?: string[];
  activeChatId?: string;
  viewMode?: string; // "focus" or "all"
}

// Stable deterministic string hashing
const hashString = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
};

// Deterministic pseudorandom values matching seeds
const getDeterministicRandom = (seed: string, min: number, max: number) => {
  const hash = hashString(seed);
  const val = Math.abs(Math.sin(hash)) * 1000;
  return min + (val % (max - min));
};

// Sentence Case Formatter: first letter capitalized, rest lowercase
const formatPlanetLabel = (label: string) => {
  if (!label) return "";
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
};

// High contrast dark core custom themes (intense border glows + almost black backgrounds)
const GALAXY_THEMES = [
  { // Violet/Indigo
    core: "radial-gradient(circle, #0e0524 0%, #060114 100%)",
    border: "border-violet-500/80 hover:border-violet-400",
    glow: "shadow-[0_0_40px_rgba(124,58,237,0.85),_inset_0_0_15px_rgba(167,139,250,0.4)] text-violet-100",
    glowColor: "rgba(124, 58, 237, 0.85)",
    ripple: "border-violet-500/20"
  },
  { // Cyan/Teal
    core: "radial-gradient(circle, #021217 0%, #000508 100%)",
    border: "border-cyan-500/80 hover:border-cyan-400",
    glow: "shadow-[0_0_40px_rgba(6,182,212,0.85),_inset_0_0_15px_rgba(103,232,249,0.4)] text-cyan-100",
    glowColor: "rgba(6, 182, 212, 0.85)",
    ripple: "border-cyan-500/15"
  },
  { // Amber/Gold
    core: "radial-gradient(circle, #1c0f02 0%, #0a0500 100%)",
    border: "border-amber-500/80 hover:border-amber-400",
    glow: "shadow-[0_0_40px_rgba(245,158,11,0.85),_inset_0_0_15px_rgba(253,230,138,0.4)] text-amber-100",
    glowColor: "rgba(245, 158, 11, 0.85)",
    ripple: "border-amber-500/15"
  },
  { // Pink/Rose
    core: "radial-gradient(circle, #1a0410 0%, #080105 100%)",
    border: "border-pink-500/80 hover:border-pink-400",
    glow: "shadow-[0_0_40px_rgba(236,72,153,0.85),_inset_0_0_15px_rgba(244,143,177,0.4)] text-pink-100",
    glowColor: "rgba(236, 72, 153, 0.85)",
    ripple: "border-pink-500/15"
  },
  { // Emerald/Teal
    core: "radial-gradient(circle, #02140a 0%, #000502 100%)",
    border: "border-emerald-500/80 hover:border-emerald-400",
    glow: "shadow-[0_0_40px_rgba(16,185,129,0.85),_inset_0_0_15px_rgba(110,231,183,0.4)] text-emerald-100",
    glowColor: "rgba(16, 185, 129, 0.85)",
    ripple: "border-emerald-500/15"
  },
  { // Blue/Royal
    core: "radial-gradient(circle, #030b24 0%, #010412 100%)",
    border: "border-blue-500/80 hover:border-blue-400",
    glow: "shadow-[0_0_40px_rgba(59,130,246,0.85),_inset_0_0_15px_rgba(147,197,253,0.4)] text-blue-100",
    glowColor: "rgba(59, 130, 246, 0.85)",
    ripple: "border-blue-500/15"
  }
];

const getGalaxyTheme = (cId?: string) => {
  if (!cId) return GALAXY_THEMES[0];
  const idx = Math.abs(hashString(cId)) % GALAXY_THEMES.length;
  return GALAXY_THEMES[idx];
};

export default function GalaxyVisualizer({
  nodes: rawNodes,
  edges: rawEdges,
  selectedNodeId,
  onSelectNode,
  activeRetrievedNodeIds = [],
  activeChatId,
  viewMode = "focus"
}: GalaxyVisualizerProps) {
  // Animation loops
  const [rotationAngleInner, setRotationAngleInner] = useState<number>(0);
  const [rotationAngleMid, setRotationAngleMid] = useState<number>(0);
  const [rotationAngleOuter, setRotationAngleOuter] = useState<number>(0);
  const [time, setTime] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  
  // Interactive hovers
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Viewport offset panning & zooming
  const [zoomScale, setZoomScale] = useState<number>(0.9);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Astro background stars & dust (cached client-side)
  const [stars, setStars] = useState<{ id: number; size: number; distance: number; angle: number; opacity: number; duration: number }[]>([]);
  const [dustParticles, setDustParticles] = useState<{ id: number; size: number; x: number; y: number; opacity: number; duration: number }[]>([]);
  const [nebulae, setNebulae] = useState<{ id: number; size: number; x: number; y: number; color: string; duration: string; delay: string }[]>([]);

  useEffect(() => {
    // Generate star field (polar coordinates for rotational motion)
    const generatedStars = Array.from({ length: 180 }).map((_, i) => ({
      id: i,
      size: Math.random() * 2.4 + 0.6,
      distance: Math.random() * 1600 + 100,
      angle: Math.random() * 2 * Math.PI,
      opacity: Math.random() * 0.85 + 0.15,
      duration: Math.random() * 4 + 2
    }));
    setStars(generatedStars);

    // Generate stardust
    const generatedDust = Array.from({ length: 45 }).map((_, i) => ({
      id: i,
      size: Math.random() * 3.5 + 1.5,
      x: (Math.random() - 0.5) * 2000,
      y: (Math.random() - 0.5) * 1500,
      opacity: Math.random() * 0.5 + 0.1,
      duration: Math.random() * 30 + 20
    }));
    setDustParticles(generatedDust);

    // Generate nebulae
    const generatedNebulae = [
      { id: 1, size: 850, x: -450, y: -300, color: "rgba(124, 58, 237, 0.13)", duration: "25s", delay: "0s" },
      { id: 2, size: 750, x: 400, y: 250, color: "rgba(29, 78, 216, 0.11)", duration: "32s", delay: "-8s" },
      { id: 3, size: 600, x: -200, y: 400, color: "rgba(6, 182, 212, 0.09)", duration: "22s", delay: "-4s" },
      { id: 4, size: 900, x: 0, y: 0, color: "rgba(139, 92, 246, 0.09)", duration: "38s", delay: "-12s" }
    ];
    setNebulae(generatedNebulae);
  }, []);

  // Frame tick animation loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (timeMs: number) => {
      const delta = timeMs - lastTime;
      lastTime = timeMs;

      if (autoRotate) {
        setRotationAngleInner((prev) => (prev + delta * 0.015) % 360);
        setRotationAngleMid((prev) => (prev - delta * 0.009) % 360); // Reverse orbit
        setRotationAngleOuter((prev) => (prev + delta * 0.005) % 360);
      }
      setTime(timeMs);
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [autoRotate]);

  // Extract unique Chat ID orbits deterministic layout
  const chatIds = useMemo(() => {
    const ids = Array.from(
      new Set(
        rawNodes
          .map((n) => n.data.chat_id)
          .filter((cId): cId is string => !!cId && cId !== "all")
      )
    );
    if (ids.length === 0 && activeChatId && activeChatId !== "all") {
      ids.push(activeChatId);
    }
    ids.sort();
    return ids;
  }, [rawNodes, activeChatId]);

  // Dynamic scaling based on amount of crystallized knowledge in each chat
  const getChatSizeMultiplier = (cId: string) => {
    const chatNodesCount = rawNodes.filter((n) => (n.data.chat_id || (activeChatId !== "all" ? activeChatId : "")) === cId).length;
    // Base size is scaled: 1 node = 0.75 multiplier, 5 nodes = 1.15 multiplier, up to 1.4
    return Math.min(1.4, Math.max(0.75, 0.75 + chatNodesCount * 0.08));
  };

  // Dynamic system radius calculation based on outermost orbiting moons
  const getSystemRadius = (cId: string) => {
    const chatNodes = rawNodes.filter((n) => (n.data.chat_id || (activeChatId !== "all" ? activeChatId : "")) === cId);
    const hasRing3 = chatNodes.some((n) => n.type === "moon" && !n.data.is_active);
    const hasRing2 = chatNodes.some((n) => n.type === "candidate");
    const hasRing1 = chatNodes.some((n) => n.type === "moon" && n.data.is_active);
    
    if (hasRing3) return 445;
    if (hasRing2) return 315;
    if (hasRing1) return 195;
    
    // Default base planet size (scaled by amount of nodes in chat)
    const chatNodesCount = chatNodes.length;
    const chatSizeMult = Math.min(1.4, Math.max(0.75, 0.75 + chatNodesCount * 0.08));
    return (105 * chatSizeMult) / 2; // planet size / 2
  };

  // Calculate stable deterministic packed centers (using dynamic system radii + padding spacing)
  const packedCenters = useMemo(() => {
    const centers: Record<string, { x: number; y: number }> = {};
    if (chatIds.length <= 1) {
      if (chatIds[0]) centers[chatIds[0]] = { x: 0, y: 0 };
      return centers;
    }

    // 1. Initialize centers deterministically scattered in a circular cloud
    chatIds.forEach((cId) => {
      const seed = cId + "-galaxy-center-universe";
      const angle = getDeterministicRandom(seed + "-angle", 0, 2 * Math.PI);
      const radius = getDeterministicRandom(seed + "-radius", 350, 750);
      centers[cId] = {
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle)
      };
    });

    // 2. Perform Circle Packing collision resolution to guarantee spacing around orbit circles
    const padding = 160; // Spacing/padding between systems (or their outer orbit circles)
    const iterations = 12;
    
    for (let step = 0; step < iterations; step++) {
      for (let i = 0; i < chatIds.length; i++) {
        for (let j = i + 1; j < chatIds.length; j++) {
          const id1 = chatIds[i];
          const id2 = chatIds[j];
          const c1 = centers[id1];
          const c2 = centers[id2];
          
          const dx = c2.x - c1.x;
          const dy = c2.y - c1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const r1 = getSystemRadius(id1);
          const r2 = getSystemRadius(id2);
          const minDistance = r1 + r2 + padding;
          
          if (dist < minDistance) {
            const overlap = minDistance - dist;
            const pushX = (dx / dist) * overlap * 0.5;
            const pushY = (dy / dist) * overlap * 0.5;
            
            centers[id1] = { x: c1.x - pushX, y: c1.y - pushY };
            centers[id2] = { x: c2.x + pushX, y: c2.y + pushY };
          }
        }
      }
    }
    
    return centers;
  }, [chatIds, rawNodes, activeChatId]);

  const getGalaxyCenter = (cId?: string) => {
    if (!cId || !packedCenters[cId]) return { x: 0, y: 0 };
    return packedCenters[cId];
  };

  // Build coordinate positions for all celestial nodes
  const coordsMap: Record<string, { x: number; y: number; zIndex: number; opacity: number; scale: number; angle: number; galaxyX: number; galaxyY: number }> = {};

  // 1. Core Planets
  rawNodes.forEach((node) => {
    if (node.type === "planet") {
      const cId = node.data.chat_id || (activeChatId !== "all" ? activeChatId : undefined);
      if (!cId) return;
      const center = getGalaxyCenter(cId);
      coordsMap[node.id] = { 
        x: center.x, 
        y: center.y, 
        zIndex: 220, 
        opacity: 1, 
        scale: 1.35, 
        angle: 0,
        galaxyX: center.x,
        galaxyY: center.y
      };
    }
  });

  // 2. Solar Moons & Candidates orbiting symmetrically from center (perfect 2D circle, Y compression = 1)
  chatIds.forEach((cId) => {
    const center = getGalaxyCenter(cId);
    const chatNodes = rawNodes.filter((n) => (n.data.chat_id || (activeChatId !== "all" ? activeChatId : undefined)) === cId);
    const chatMoonsActive = chatNodes.filter((n) => n.type === "moon" && n.data.is_active);
    const chatCandidates = chatNodes.filter((n) => n.type === "candidate");
    const chatMoonsInactive = chatNodes.filter((n) => n.type === "moon" && !n.data.is_active);

    const mapOrbitLayer = (layerNodes: ContextNode[], ring: number) => {
      layerNodes.forEach((node, index) => {
        const baseAngle = (index / Math.max(layerNodes.length, 1)) * 360;
        let currentAngle = baseAngle;
        
        if (ring === 1) {
          currentAngle = (baseAngle + rotationAngleInner) % 360;
        } else if (ring === 2) {
          currentAngle = (baseAngle - rotationAngleMid) % 360;
        } else {
          currentAngle = (baseAngle + rotationAngleOuter) % 360;
        }

        const radian = (currentAngle * Math.PI) / 180;
        const radius = ring === 1 ? 195 : ring === 2 ? 315 : 445;

        // Symmetric centered circular coordinate (No sideways compression)
        const relX = radius * Math.cos(radian);
        const bobbing = Math.sin(time * 0.0025 + index * 2.0 + (cId ? cId.charCodeAt(0) : 0)) * 8;
        const relY = radius * Math.sin(radian) + bobbing;

        const x = center.x + relX;
        const y = center.y + relY;

        const zIndex = Math.round(100 + 80 * Math.cos(radian));
        const opacity = Math.max(0.4, Math.min(1, 0.5 + 0.5 * ((1 + Math.sin(radian)) / 2)));
        const scale = Math.max(0.8, Math.min(1.25, 0.85 + 0.3 * ((1 + Math.sin(radian)) / 2)));

        coordsMap[node.id] = {
          x,
          y,
          zIndex,
          opacity,
          scale,
          angle: currentAngle,
          galaxyX: center.x,
          galaxyY: center.y
        };
      });
    };

    mapOrbitLayer(chatMoonsActive, 1);
    mapOrbitLayer(chatCandidates, 2);
    mapOrbitLayer(chatMoonsInactive, 3);
  });

  // Focal auto zoom and viewport bound fitting
  const centeredRef = useRef<string | null>(null);
  useEffect(() => {
    if (chatIds.length > 0) {
      const centerKey = `${activeChatId}:${viewMode}:${chatIds.join(",")}`;
      if (centeredRef.current === centerKey) return;
      centeredRef.current = centerKey;

      if (viewMode === "focus" && activeChatId && activeChatId !== "all") {
        const center = getGalaxyCenter(activeChatId);
        setZoomScale(1.15);
        setPanOffset({ x: -center.x * 1.15, y: -center.y * 1.15 });
      } else {
        // Multi-galaxy view: Zoom out more dynamically depending on packed size/chat count to fit screen view perfectly
        const dynamicZoom = chatIds.length <= 1 
          ? 0.9 
          : chatIds.length <= 3 
            ? 0.42 
            : 0.32;
        setZoomScale(dynamicZoom);
        setPanOffset({ x: 0, y: 0 });
      }
    }
  }, [activeChatId, viewMode, chatIds, packedCenters]);

  // Drag panning mechanics
  const handleMouseDown = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest(".glass-info-card") || 
      (e.target as HTMLElement).closest(".planet-anchor-interactive") ||
      (e.target as HTMLElement).closest(".telemetry-dials")
    ) {
      return;
    }
    setIsDragging(true);
    dragStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const scaleFactor = 0.08;
    const nextZoom = e.deltaY < 0
      ? Math.min(zoomScale + scaleFactor, 1.8)
      : Math.max(zoomScale - scaleFactor, 0.4);
    setZoomScale(Number(nextZoom.toFixed(2)));
  };

  // High contrast colored celestial definitions (Dark cored spheres + Enhanced glowing borders)
  const getCelestialIdentity = (node: ContextNode) => {
    if (!node.data.is_active) {
      // Dull slate/grey = Archived (dark core, grey border glow, dead planet)
      return {
        gradient: "from-[#0f172a] via-[#020617] to-[#000000]",
        border: "border-slate-500/50 hover:border-slate-400",
        glow: "shadow-[0_0_15px_rgba(100,116,139,0.45),_inset_0_0_8px_rgba(100,116,139,0.18)]",
        text: "text-slate-400"
      };
    }

    const priority = node.data.priority?.toLowerCase();

    if (priority === "high") {
      // Gold = High Priority (dark gold core, gold border glow)
      return {
        gradient: "from-[#1c1202] via-[#0f0a00] to-[#040200]",
        border: "border-yellow-500/80 hover:border-yellow-400",
        glow: "shadow-[0_0_20px_rgba(234,179,8,0.85),_inset_0_0_8px_rgba(234,179,8,0.35)]",
        text: "text-yellow-400"
      };
    }

    if (node.type === "candidate") {
      // Blue = Learning (dark blue core, blue border glow)
      return {
        gradient: "from-[#020b24] via-[#010512] to-[#000207]",
        border: "border-blue-500/80 hover:border-blue-400",
        glow: "shadow-[0_0_20px_rgba(59,130,246,0.85),_inset_0_0_8px_rgba(59,130,246,0.3)]",
        text: "text-blue-400"
      };
    }

    if (priority === "medium") {
      // Purple = Research (dark purple core, purple border glow)
      return {
        gradient: "from-[#100424] via-[#090214] to-[#04010a]",
        border: "border-purple-500/80 hover:border-purple-400",
        glow: "shadow-[0_0_20px_rgba(168,85,247,0.85),_inset_0_0_8px_rgba(168,85,247,0.3)]",
        text: "text-purple-400"
      };
    }

    // Default: Cyan = Projects (dark cyan core, cyan border glow)
    return {
      gradient: "from-[#021217] via-[#000608] to-[#000203]",
      border: "border-cyan-500/80 hover:border-cyan-400",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.85),_inset_0_0_8px_rgba(6,182,212,0.3)]",
      text: "text-cyan-400"
    };
  };

  const hasStellarRings = (node: ContextNode, idx: number) => {
    return node.data.priority?.toLowerCase() === "high" || idx % 3 === 1;
  };

  const isConnected = (id1: string, id2: string) => {
    return rawEdges.some(
      (edge) => (edge.source === id1 && edge.target === id2) || (edge.source === id2 && edge.target === id1)
    );
  };

  const getRelatedNodes = (nodeId: string) => {
    const relatedIds = rawEdges
      .filter((e) => e.source === nodeId || e.target === nodeId)
      .map((e) => (e.source === nodeId ? e.target : e.source));
    return rawNodes.filter((n) => relatedIds.includes(n.id));
  };

  const selectedNode = rawNodes.find((n) => n.id === selectedNodeId);

  // Connection edges matching coordinate map definitions
  const activeEdges = rawEdges.filter((e) => coordsMap[e.source] && coordsMap[e.target]);

  return (
    <div
      className="w-full h-full relative overflow-hidden select-none cursor-grab active:cursor-grabbing z-10"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      style={{
        background: "radial-gradient(circle at center, #020716 0%, #000206 100%)"
      }}
    >
      {/* Inline styles for circular rotations, space particle drift, and connections */}
      <style>{`
        @keyframes spin-clockwise {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes spin-counter {
          from { transform: translate(-50%, -50%) rotate(360deg); }
          to { transform: translate(-50%, -50%) rotate(0deg); }
        }
        @keyframes float-nebula {
          0% { transform: translate(0px, 0px) scale(1); opacity: 0.8; }
          50% { transform: translate(30px, -20px) scale(1.05); opacity: 0.98; }
          100% { transform: translate(0px, 0px) scale(1); opacity: 0.8; }
        }
        @keyframes float-dust {
          0% { transform: translate(0px, 0px) rotate(0deg); }
          50% { transform: translate(40px, 40px) rotate(180deg); }
          100% { transform: translate(0px, 0px) rotate(360deg); }
        }
        @keyframes dashscroll {
          to {
            stroke-dashoffset: -20;
          }
        }
        @keyframes central-glow-pulse {
          0% { box-shadow: 0 0 60px rgba(124, 58, 237, 0.75), 0 0 120px rgba(124, 58, 237, 0.45), 0 0 180px rgba(236, 72, 153, 0.25); }
          50% { box-shadow: 0 0 95px rgba(124, 58, 237, 0.98), 0 0 160px rgba(124, 58, 237, 0.65), 0 0 250px rgba(236, 72, 153, 0.45); }
          100% { box-shadow: 0 0 60px rgba(124, 58, 237, 0.75), 0 0 120px rgba(124, 58, 237, 0.45), 0 0 180px rgba(236, 72, 153, 0.25); }
        }
      `}</style>

      {/* Galaxy Space Environment */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Slowly rotating star field */}
        {stars.map((star) => {
          const currentStarAngle = star.angle + time * 0.000015;
          const starX = star.distance * Math.cos(currentStarAngle);
          const starY = star.distance * Math.sin(currentStarAngle) * 0.75; // Squeezed 3D tilt

          return (
            <div
              key={star.id}
              className="absolute rounded-full bg-white animate-pulse"
              style={{
                width: `${star.size}px`,
                height: `${star.size}px`,
                left: `calc(50% + ${starX}px)`,
                top: `calc(50% + ${starY}px)`,
                opacity: star.opacity,
                animationDuration: `${star.duration}s`
              }}
            />
          );
        })}

        {/* Dynamic Nebulae Clouds */}
        {nebulae.map((cloud) => (
          <div
            key={cloud.id}
            className="absolute rounded-full blur-[96px]"
            style={{
              width: `${cloud.size}px`,
              height: `${cloud.size}px`,
              left: `calc(50% + ${cloud.x}px - ${cloud.size / 2}px)`,
              top: `calc(50% + ${cloud.y}px - ${cloud.size / 2}px)`,
              background: `radial-gradient(circle, ${cloud.color} 0%, transparent 70%)`,
              animation: `float-nebula ${cloud.duration} ease-in-out infinite`,
              animationDelay: cloud.delay
            }}
          />
        ))}

        {/* Giant blurred central galaxy glow spotlight */}
        <div 
          className="absolute w-[1000px] h-[1000px] rounded-full blur-[110px] pointer-events-none opacity-45 top-1/2 left-1/2"
          style={{
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.16) 0%, rgba(236, 72, 153, 0.08) 50%, transparent 70%)",
            transform: "translate(-50%, -50%) rotate(0deg)",
            animation: "spin-clockwise 70s linear infinite"
          }}
        />

        {/* Cosmic dust and soft moving particles */}
        {dustParticles.map((dust) => (
          <div
            key={dust.id}
            className="absolute rounded-full bg-cyan-400/25 shadow-[0_0_10px_rgba(34,211,238,0.25)]"
            style={{
              width: `${dust.size}px`,
              height: `${dust.size}px`,
              left: `calc(50% + ${dust.x}px)`,
              top: `calc(50% + ${dust.y}px)`,
              opacity: dust.opacity,
              animation: `float-dust ${dust.duration}s linear infinite`
            }}
          />
        ))}
      </div>

      {/* 3D Tilted Galaxy Space Chamber Container */}
      <div
        className="absolute top-1/2 left-1/2 w-0 h-0 transition-transform duration-100 ease-out z-10"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`
        }}
      >
        {/* Concentric orbital circular track lines per chat system (perfect circles centered directly around core) */}
        {chatIds.map((cId) => {
          const center = getGalaxyCenter(cId);
          return (
            <React.Fragment key={`tracks-${cId}`}>
              {/* Ring 1 Active track */}
              <div 
                className="absolute w-[390px] h-[390px] rounded-full border border-violet-500/10 pointer-events-none z-0" 
                style={{ transform: `translate(-50%, -50%) translate(${center.x}px, ${center.y}px)` }}
              />
              {/* Ring 2 Candidate track */}
              <div 
                className="absolute w-[630px] h-[630px] rounded-full border border-cyan-500/5 pointer-events-none z-0" 
                style={{ transform: `translate(-50%, -50%) translate(${center.x}px, ${center.y}px)` }}
              />
              {/* Ring 3 Inactive track */}
              <div 
                className="absolute w-[890px] h-[890px] rounded-full border border-rose-500/5 pointer-events-none z-0" 
                style={{ transform: `translate(-50%, -50%) translate(${center.x}px, ${center.y}px)` }}
              />
            </React.Fragment>
          );
        })}

        {/* SVG connection lines with flowing gradients and motion energy pulses */}
        <svg 
          className="absolute w-[4000px] h-[4000px] -left-[2000px] -top-[2000px] pointer-events-none z-0 overflow-visible"
        >
          <defs>
            {/* High intensity connection gradient */}
            <linearGradient id="glow-grad-high" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#d946ef" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.95" />
            </linearGradient>
            {/* Normal connection gradient */}
            <linearGradient id="glow-grad-normal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.55" />
            </linearGradient>
            {/* Dull grey archived connection gradient */}
            <linearGradient id="glow-grad-archived" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#475569" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#1e293b" stopOpacity="0.4" />
            </linearGradient>
          </defs>

          <g transform="translate(2000, 2000)">
            {activeEdges.map((edge) => {
              const src = coordsMap[edge.source];
              const tgt = coordsMap[edge.target];

              const isHoveredSrc = hoveredNodeId === edge.source;
              const isHoveredTgt = hoveredNodeId === edge.target;
              const isSelectedSrc = selectedNodeId === edge.source;
              const isSelectedTgt = selectedNodeId === edge.target;

              const srcNode = rawNodes.find((n) => n.id === edge.source);
              const tgtNode = rawNodes.find((n) => n.id === edge.target);
              const isArchivedConnection = (srcNode && !srcNode.data.is_active) || (tgtNode && !tgtNode.data.is_active);

              const isHighIntensity = isHoveredSrc || isHoveredTgt || isSelectedSrc || isSelectedTgt;
              const isDimmed = hoveredNodeId && !isHoveredSrc && !isHoveredTgt;

              let stroke = isArchivedConnection ? "url(#glow-grad-archived)" : "url(#glow-grad-normal)";
              let strokeWidth = isArchivedConnection ? 1.2 : 1.6;
              let glowFilter = "none";

              if (isHighIntensity) {
                stroke = "url(#glow-grad-high)";
                strokeWidth = 2.5;
                glowFilter = "drop-shadow(0 0 6px rgba(217,70,239,0.6))";
              } else if (isDimmed) {
                stroke = isArchivedConnection ? "url(#glow-grad-archived)" : "url(#glow-grad-normal)";
                strokeWidth = isArchivedConnection ? 0.6 : 0.8;
              }

              return (
                <g key={edge.id} className="transition-all duration-300" style={{ opacity: isDimmed ? 0.15 : 1 }}>
                  {/* Glowing structural trace path */}
                  <path
                    d={`M ${src.x} ${src.y} L ${tgt.x} ${tgt.y}`}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    filter={glowFilter}
                    className="galaxy-connection"
                  />

                  {/* Flowing energy pulses */}
                  <circle 
                    r={isArchivedConnection ? 2 : 3} 
                    fill={isHighIntensity ? "#ffffff" : (isArchivedConnection ? "#64748b" : "#22d3ee")} 
                    filter={isHighIntensity ? "drop-shadow(0 0 6px #f43f5e)" : (isArchivedConnection ? "none" : "drop-shadow(0 0 4px #06b6d4)")}
                  >
                    <animateMotion
                      dur={isHighIntensity ? "2.2s" : (isArchivedConnection ? "7.5s" : "4.5s")}
                      repeatCount="indefinite"
                      path={`M ${src.x} ${src.y} L ${tgt.x} ${tgt.y}`}
                    />
                  </circle>
                </g>
              );
            })}
          </g>
        </svg>

        {/* 1. CENTRAL SUN CORES: Root Context Planets (Highly legible dark core + Intense colorful glow borders) */}
        {rawNodes
          .filter((n) => n.type === "planet")
          .map((node) => {
            const coords = coordsMap[node.id];
            if (!coords) return null;

            const isSelected = selectedNodeId === node.id;
            const cId = node.data.chat_id || activeChatId || "default-galaxy";
            const theme = getGalaxyTheme(cId);

            // Dynamic scaling based on the volume of messages/knowledge in the chat
            const chatSizeMult = getChatSizeMultiplier(cId);
            const baseDiameter = 105;
            const planetSize = baseDiameter * chatSizeMult;

            return (
              <div
                key={node.id}
                className="absolute z-20"
                style={{
                  transform: `translate(${coords.x}px, ${coords.y}px) scale(${coords.scale})`
                }}
              >
                {/* Concentric rotating solar energy rings */}
                <div 
                  className={cn("absolute rounded-full border border-dashed w-[130%] h-[130%] left-1/2 top-1/2 pointer-events-none", theme.ripple)} 
                  style={{
                    transform: "translate(-50%, -50%)",
                    animation: "spin-clockwise 20s linear infinite"
                  }}
                />
                <div 
                  className="absolute rounded-full border border-double border-white/5 w-[145%] h-[145%] left-1/2 top-1/2 pointer-events-none" 
                  style={{
                    transform: "translate(-50%, -50%)",
                    animation: "spin-counter 30s linear infinite"
                  }}
                />

                {/* Layered glowing ripples */}
                <div className="absolute -inset-4 rounded-full border border-white/5 animate-ping opacity-25" style={{ animationDuration: "3.5s" }} />

                {/* Subtle dark core overlay to prevent washouts */}
                <div className="absolute inset-0 rounded-full bg-black/40 blur-[4px] pointer-events-none" />

                {/* Central root button body (dark cored for extreme text legibility) */}
                <button
                  type="button"
                  onClick={() => onSelectNode(node.id)}
                  className={cn(
                    "rounded-full relative flex items-center justify-center text-center font-bold px-3 transition-all duration-300 planet-anchor-interactive border-2",
                    theme.border,
                    theme.glow,
                    isSelected ? "scale-108 ring-2 ring-white/50" : "hover:scale-105 active:scale-95"
                  )}
                  style={{
                    width: `${planetSize}px`,
                    height: `${planetSize}px`,
                    background: theme.core,
                    transform: "translate(-50%, -50%)"
                  }}
                >
                  {/* Root title inside central planet (highly visible white sentence case text on dark core) */}
                  <span 
                    className="font-extrabold text-center leading-snug tracking-wide text-white drop-shadow-[0_1.5px_4px_rgba(0,0,0,0.95)] z-20 break-words select-text"
                    style={{
                      fontSize: `${Math.max(7.5, Math.min(10.5, planetSize * 0.095))}px`,
                      maxWidth: `${planetSize * 0.72}px`,
                      padding: "0 4px"
                    }}
                  >
                    {formatPlanetLabel(node.data.label)}
                  </span>
                </button>
              </div>
            );
          })}

        {/* 2. ORBITING PLANETS & SOLAR MOONS (Orbiting symmetrically from center) */}
        {rawNodes
          .filter((n) => n.type !== "planet")
          .map((node, index) => {
            const coords = coordsMap[node.id];
            if (!coords) return null;

            const isHovered = hoveredNodeId === node.id;
            const isRelated = hoveredNodeId && isConnected(hoveredNodeId, node.id);
            const isSelected = selectedNodeId === node.id;

            // Illumination values
            const isIlluminated = !hoveredNodeId || isHovered || isRelated;
            const isPulsing = isRelated;

            const baseSize = node.type === "candidate" ? 34 : 44;
            const activation = node.data.activation_score ?? 0.55;
            // Variable moon sizing based on its frequency (activation score)
            const planetSize = baseSize * (0.75 + activation * 0.75);

            const identity = getCelestialIdentity(node);
            const hasRings = hasStellarRings(node, index);

            return (
              <div
                key={node.id}
                className="absolute transition-transform duration-100 ease-out"
                style={{
                  transform: `translate(${coords.x}px, ${coords.y}px) scale(${coords.scale})`,
                  zIndex: isSelected ? 300 : coords.zIndex,
                  opacity: isIlluminated ? 1 : 0.25
                }}
              >
                {/* Orbital path segment highlight */}
                <div 
                  className={cn(
                    "absolute rounded-full -inset-4 transition-all duration-300 pointer-events-none opacity-0 scale-90",
                    isHovered && "opacity-100 scale-100 border border-violet-500/25 shadow-[0_0_20px_rgba(139,92,246,0.25)]"
                  )}
                />

                {/* Saturn planet rings */}
                {hasRings && (
                  <div
                    className={cn(
                      "absolute rounded-full border pointer-events-none transition-all duration-300",
                      node.data.is_active ? "border-violet-500/25" : "border-slate-800/40"
                    )}
                    style={{
                      width: `${planetSize * 2.2}px`,
                      height: `${planetSize * 0.42}px`,
                      transform: "translate(-50%, -50%) rotate(-18deg)",
                      boxShadow: node.data.is_active
                        ? "0 0 12px rgba(139, 92, 246, 0.08), inset 0 0 12px rgba(139, 92, 246, 0.08)"
                        : "none",
                      top: "50%",
                      left: "50%",
                      opacity: isIlluminated ? 0.65 : 0.2,
                      zIndex: -1
                    }}
                  />
                )}

                {/* Orbiting planet orb (dark cored for text legibility) */}
                <button
                  type="button"
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onClick={() => onSelectNode(node.id === selectedNodeId ? null : node.id)}
                  className={cn(
                    "rounded-full flex flex-col items-center justify-center text-center font-bold px-2 relative transition-all duration-300 border-2",
                    identity.gradient,
                    identity.border,
                    identity.glow,
                    isPulsing && "animate-pulse border-white/60",
                    isSelected ? "scale-115 border-white ring-2 ring-violet-500/40 shadow-[0_0_28px_rgba(255,255,255,0.35)]" : "hover:scale-108 active:scale-95"
                  )}
                  style={{
                    width: `${planetSize}px`,
                    height: `${planetSize}px`,
                    transform: "translate(-50%, -50%)"
                  }}
                >
                  <div className="absolute inset-1 rounded-full bg-white/5 blur-[1px] pointer-events-none" />

                  {/* Planet label inside sphere (highly legible sentence case text) */}
                  <span 
                    className="truncate w-full font-bold text-white leading-tight drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.95)]"
                    style={{
                      fontSize: `${Math.max(6.2, Math.min(8.5, planetSize * 0.155))}px`,
                      maxWidth: `${planetSize * 0.82}px`,
                      padding: "0 2px"
                    }}
                  >
                    {formatPlanetLabel(node.data.label)}
                  </span>
                </button>

                {/* Floating name tag underneath (highly visible white text) */}
                <div
                  className={cn(
                    "absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-black uppercase tracking-wider transition-all duration-300 bg-slate-950 border px-2 py-0.5 rounded-lg shadow-2xl pointer-events-none z-10",
                    isSelected 
                      ? "text-white border-violet-500 shadow-violet-950/50 scale-105" 
                      : isHovered 
                        ? "text-white border-slate-700 scale-100" 
                        : "text-slate-300 border-slate-900 opacity-90"
                  )}
                >
                  {node.type === "candidate" ? "Forming" : node.data.priority}
                </div>
              </div>
            );
          })}
      </div>

      {/* Premium Glassmorphic details overlay card */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="absolute top-6 right-6 w-80 glass-info-card glass-panel p-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8),_0_0_35px_rgba(124,58,237,0.2)] backdrop-blur-3xl z-50 text-slate-200 select-none overflow-visible border"
            style={{
              background: "linear-gradient(135deg, rgba(6, 12, 38, 0.9) 0%, rgba(2, 4, 16, 0.95) 100%)",
              borderColor: "rgba(139, 92, 246, 0.38)"
            }}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-3.5 border-b border-white/[0.08] pb-3">
              <div>
                <span className="text-[8px] font-extrabold uppercase tracking-widest text-[#a78bfa] block">
                  Stellar Memory Core
                </span>
                <h3 className="text-xs font-black text-white uppercase tracking-wider mt-1 max-w-[210px] truncate leading-normal">
                  {selectedNode.data.label}
                </h3>
              </div>
              <button 
                onClick={() => onSelectNode(null)}
                className="text-white/50 hover:text-white transition-colors p-1.5 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer border border-white/[0.05]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Properties */}
            <div className="space-y-4 text-[11px] font-semibold leading-relaxed">
              {/* Summary Paragraph */}
              {selectedNode.data.summary && (
                <p className="text-slate-350 text-[10px] leading-relaxed italic bg-[#01030b]/80 p-2.5 rounded-xl border border-white/[0.05] shadow-inner">
                  "{selectedNode.data.summary}"
                </p>
              )}

              {/* Grid Properties */}
              <div className="grid grid-cols-2 gap-3.5">
                {/* Priority */}
                <div>
                  <span className="text-[8.5px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">
                    Priority
                  </span>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[8px] font-black uppercase inline-block border shadow-sm",
                    selectedNode.data.priority?.toLowerCase() === "high"
                      ? "bg-rose-950/20 border-rose-500/40 text-rose-450 animate-pulse"
                      : selectedNode.data.priority?.toLowerCase() === "medium"
                        ? "bg-violet-950/20 border-violet-500/40 text-violet-400"
                        : "bg-cyan-950/20 border-cyan-500/40 text-cyan-400"
                  )}>
                    {selectedNode.data.priority || "MEDIUM"}
                  </span>
                </div>

                {/* Activation Score */}
                <div>
                  <span className="text-[8.5px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">
                    Frequency
                  </span>
                  <div className="flex flex-col gap-1 font-mono text-[10px] text-white">
                    <div className="flex items-center gap-1.5">
                      <Zap size={11} className="text-amber-400 fill-amber-500/10" />
                      <span>{Math.round((selectedNode.data.activation_score || 0.6) * 100)}%</span>
                    </div>
                    {/* Glowing progress bar */}
                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/[0.04] shadow-inner mt-1">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 shadow-[0_0_8px_#06b6d4]" 
                        style={{ width: `${Math.round((selectedNode.data.activation_score || 0.6) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Memory Status */}
                <div>
                  <span className="text-[8.5px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">
                    Memory Status
                  </span>
                  <span className="text-white font-black uppercase tracking-wider text-[9px] flex items-center gap-1">
                    {!selectedNode.data.is_active ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-red-400" /> Deep Space
                      </>
                    ) : selectedNode.type === "planet" ? (
                      "Galaxy Core"
                    ) : selectedNode.type === "candidate" ? (
                      "Forming"
                    ) : (
                      "Frequent Memory"
                    )}
                  </span>
                </div>

                {/* Last Activity */}
                <div>
                  <span className="text-[8.5px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">
                    Last Activity
                  </span>
                  <span className="text-white font-mono text-[9px] uppercase tracking-wide flex items-center gap-1">
                    <Clock size={11} className="text-slate-500" /> Synchronized
                  </span>
                </div>
              </div>

              {/* Related/Connected Contexts */}
              {getRelatedNodes(selectedNode.id).length > 0 && (
                <div className="border-t border-white/[0.08] pt-3.5">
                  <span className="text-[8.5px] uppercase tracking-wider font-extrabold text-slate-400 block mb-2">
                    Connected Stellar Systems
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                    {getRelatedNodes(selectedNode.id).map((rel) => (
                      <button
                        key={rel.id}
                        onClick={() => onSelectNode(rel.id)}
                        className="px-2 py-1 rounded bg-[#04081c]/80 border border-violet-500/25 hover:border-violet-500/50 text-[9px] font-bold text-slate-200 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow hover:scale-105"
                      >
                        <span>{rel.data.label}</span>
                        <ArrowRight size={8} className="text-slate-450" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium Floating Controller Map Panel */}
      <div className="absolute bottom-6 left-6 z-40 flex items-center gap-2 select-none telemetry-dials">
        <button
          onClick={() => {
            if (activeChatId && viewMode === "focus") {
              const center = getGalaxyCenter(activeChatId);
              setZoomScale(1.15);
              setPanOffset({ x: -center.x * 1.15, y: -center.y * 1.15 });
            } else {
              setZoomScale(chatIds.length <= 1 ? 0.9 : chatIds.length <= 3 ? 0.42 : 0.32);
              setPanOffset({ x: 0, y: 0 });
            }
          }}
          className="px-3.5 py-1.8 bg-[#030c1f]/85 hover:bg-[#0a1535] border border-white/[0.08] hover:border-violet-500/40 text-slate-200 hover:text-white text-[9.5px] font-black uppercase rounded-lg shadow-lg flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105 active:scale-95"
          title="Recenter Galaxy System"
        >
          <Orbit className="w-3.5 h-3.5 text-[#a78bfa]" /> Recenter
        </button>

        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={cn(
            "px-3.5 py-1.8 border text-[9.5px] font-black uppercase rounded-lg shadow-lg flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105 active:scale-95",
            autoRotate
              ? "bg-violet-950/25 border-violet-500/40 text-violet-400 hover:bg-violet-950/45"
              : "bg-[#030c1f]/85 border-white/[0.08] text-slate-350 hover:text-white"
          )}
          title="Toggle Celestial Rotation"
        >
          <Activity className={cn("w-3.5 h-3.5", autoRotate && "animate-pulse")} />
          <span>{autoRotate ? "Orbiting" : "Paused"}</span>
        </button>
      </div>
    </div>
  );
}
