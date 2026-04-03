"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow, Node, Edge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, BackgroundVariant, MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getPageStatus, STATUS_COLORS, getStatusLabel } from "@/types";

interface PageNode {
  id: string; url: string; title: string | null; statusCode: number | null;
  responseTime: number | null; parentPageId: string | null;
  linksFrom: { href: string; toPageId: string | null }[];
  groupMembers?: { group: { id: string; name: string; color: string } }[];
}

interface SiteTreeGraphProps { pages: PageNode[]; onNodeClick: (pageId: string) => void; domainId?: string; focusNodeId?: string; }

const NODE_W = 180;
const NODE_H = 60;
const H_GAP = 50;
const V_GAP = 30;

function getUrlDepth(url: string): number {
  try {
    const path = new URL(url).pathname.replace(/\/$/, "");
    if (!path || path === "") return 0;
    return path.split("/").filter(Boolean).length;
  } catch { return 0; }
}

function getUrlParentPath(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean);
    if (parts.length <= 1) return u.origin + "/";
    parts.pop();
    return u.origin + "/" + parts.join("/");
  } catch { return ""; }
}

function buildHorizontalTreeLayout(pages: PageNode[]) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  if (pages.length === 0) return { nodes, edges };

  const pageById = new Map(pages.map((p) => [p.id, p]));
  const pageByUrl = new Map<string, PageNode>();
  for (const p of pages) {
    pageByUrl.set(p.url.replace(/\/$/, ""), p);
    pageByUrl.set(p.url, p);
  }

  const children = new Map<string, string[]>();
  const parentOf = new Map<string, string>();
  const roots: string[] = [];
  const assigned = new Set<string>();

  // Sort pages by URL depth (shallowest first)
  const sorted = [...pages].sort((a, b) => getUrlDepth(a.url) - getUrlDepth(b.url));

  // Helper: add child to parent
  const addChild = (parentId: string, childId: string) => {
    if (assigned.has(childId)) return false;
    parentOf.set(childId, parentId);
    const ch = children.get(parentId) || [];
    ch.push(childId);
    children.set(parentId, ch);
    assigned.add(childId);
    return true;
  };

  // Pass 1: find roots (depth 0)
  for (const page of sorted) {
    if (getUrlDepth(page.url) === 0) {
      roots.push(page.id);
      assigned.add(page.id);
    }
  }
  if (roots.length === 0 && pages.length > 0) {
    roots.push(sorted[0].id);
    assigned.add(sorted[0].id);
  }

  // Pass 2: use parentPageId from crawl data (most reliable)
  for (const page of sorted) {
    if (assigned.has(page.id)) continue;
    if (page.parentPageId && pageById.has(page.parentPageId) && page.parentPageId !== page.id) {
      addChild(page.parentPageId, page.id);
    }
  }

  // Pass 3: use URL hierarchy for remaining unassigned pages
  for (const page of sorted) {
    if (assigned.has(page.id)) continue;

    // Try progressively shorter URL paths to find an ancestor
    let found = false;
    let currentUrl = page.url;
    for (let i = 0; i < 10; i++) {
      const parentPath = getUrlParentPath(currentUrl);
      if (!parentPath || parentPath === currentUrl) break;
      const parentPage = pageByUrl.get(parentPath.replace(/\/$/, "")) || pageByUrl.get(parentPath);
      if (parentPage && parentPage.id !== page.id) {
        addChild(parentPage.id, page.id);
        found = true;
        break;
      }
      currentUrl = parentPath;
    }

    // Last resort: attach to first root
    if (!found) {
      addChild(roots[0], page.id);
    }
  }

  // Calculate subtree sizes for layout
  const subtreeSize = new Map<string, { w: number; h: number }>();
  const visited = new Set<string>();

  function calcSize(nodeId: string): { w: number; h: number } {
    if (visited.has(nodeId)) return { w: NODE_W, h: NODE_H };
    visited.add(nodeId);
    const ch = children.get(nodeId) || [];
    if (ch.length === 0) {
      const size = { w: NODE_W, h: NODE_H };
      subtreeSize.set(nodeId, size);
      return size;
    }

    const childSizes = ch.map((c) => calcSize(c));
    const totalChildH = childSizes.reduce((sum, s) => sum + s.h, 0) + (ch.length - 1) * V_GAP;
    const maxChildW = Math.max(...childSizes.map((s) => s.w));
    const size = { w: NODE_W + H_GAP + maxChildW, h: Math.max(NODE_H, totalChildH) };
    subtreeSize.set(nodeId, size);
    return size;
  }

  // Position nodes recursively (horizontal tree: x = depth, y = spread)
  function positionNode(nodeId: string, x: number, y: number, positioned: Set<string>) {
    if (positioned.has(nodeId)) return;
    positioned.add(nodeId);
    const page = pageById.get(nodeId)!;
    if (!page) return;
    const status = getPageStatus(page.statusCode, page.responseTime);
    const colors = STATUS_COLORS[status];

    let displayPath = page.url;
    try {
      const u = new URL(page.url);
      displayPath = u.pathname === "/" ? "/" : u.pathname;
    } catch {}
    const truncLabel = displayPath.length > 22 ? "..." + displayPath.slice(-19) : displayPath;

    // Center node vertically in its allocated space
    const mySize = subtreeSize.get(nodeId) || { w: NODE_W, h: NODE_H };
    const nodeY = y + mySize.h / 2 - NODE_H / 2;

    const groupColors = page.groupMembers?.map((m) => m.group.color) || [];

    nodes.push({
      id: nodeId,
      type: "tile",
      position: { x, y: nodeY },
      data: {
        truncLabel,
        statusLabel: getStatusLabel(page.statusCode),
        responseTime: page.responseTime,
        textColor: colors.text,
        groupColors,
        isFocused: false,
      },
      style: {
        background: colors.bg, border: "none", borderRadius: "10px",
        width: NODE_W, height: NODE_H, display: "flex", alignItems: "center",
        justifyContent: "center", boxShadow: "0 3px 10px rgba(0,0,0,0.12)", cursor: "pointer",
        padding: 0,
      },
    });

    // Position children
    const ch = children.get(nodeId) || [];
    if (ch.length > 0) {
      const childX = x + NODE_W + H_GAP;
      let childY = y;

      for (const childId of ch) {
        const childSize = subtreeSize.get(childId) || { w: NODE_W, h: NODE_H };

        const edgeColor = STATUS_COLORS[status].bg;
        edges.push({
          id: `${nodeId}->${childId}`,
          source: nodeId, target: childId,
          type: "smoothstep",
          style: { stroke: edgeColor, strokeWidth: 2, opacity: 0.5 },
          markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: edgeColor },
        });

        positionNode(childId, childX, childY, positioned);
        childY += childSize.h + V_GAP;
      }
    }
  }

  // Layout all roots
  let rootY = 0;
  for (const rootId of roots) { calcSize(rootId); }

  const positioned = new Set<string>();
  for (const rootId of roots) {
    const size = subtreeSize.get(rootId) || { w: NODE_W, h: NODE_H };
    positionNode(rootId, 0, rootY, positioned);
    rootY += size.h + V_GAP * 2;
  }

  return { nodes, edges };
}

// Anti-collision: push overlapping nodes away (with cascading)
function resolveCollisions(nodes: Node[], movedId: string): Node[] {
  const PADDING = 12;
  const result = nodes.map((n) => ({ ...n, position: { ...n.position } }));
  const moved = result.find((n) => n.id === movedId);
  if (!moved) return result;

  const getRect = (n: Node) => {
    const w = (n.style?.width as number) || NODE_W;
    const h = (n.style?.height as number) || NODE_H;
    return { x: n.position.x, y: n.position.y, w, h, r: n.position.x + w, b: n.position.y + h };
  };

  const overlaps = (a: ReturnType<typeof getRect>, b: ReturnType<typeof getRect>) =>
    a.x < b.r + PADDING && a.r + PADDING > b.x && a.y < b.b + PADDING && a.b + PADDING > b.y;

  // Iterative: repeat until no more collisions or max passes
  for (let pass = 0; pass < 15; pass++) {
    let hadCollision = false;

    for (const current of result) {
      const currentRect = getRect(current);

      for (const other of result) {
        if (other.id === current.id) continue;
        const otherRect = getRect(other);

        if (!overlaps(currentRect, otherRect)) continue;

        // Only push "other" if it's NOT the dragged node
        const pusher = current.id === movedId ? current : other.id === movedId ? null : current;
        const pushed = current.id === movedId ? other : other.id === movedId ? null : other;
        if (!pusher || !pushed || pushed.id === movedId) continue;

        const pusherRect = getRect(pusher);
        const pushedRect = getRect(pushed);

        // Calculate overlap amounts to find minimum push direction
        const overlapX = Math.min(pusherRect.r - pushedRect.x, pushedRect.r - pusherRect.x);
        const overlapY = Math.min(pusherRect.b - pushedRect.y, pushedRect.b - pusherRect.y);

        // Push in direction of least overlap (minimum displacement)
        if (overlapX < overlapY) {
          const centerDx = (pusherRect.x + pusherRect.w / 2) - (pushedRect.x + pushedRect.w / 2);
          if (centerDx > 0) {
            pushed.position.x = pusherRect.x - pushedRect.w - PADDING;
          } else {
            pushed.position.x = pusherRect.r + PADDING;
          }
        } else {
          const centerDy = (pusherRect.y + pusherRect.h / 2) - (pushedRect.y + pushedRect.h / 2);
          if (centerDy > 0) {
            pushed.position.y = pusherRect.y - pushedRect.h - PADDING;
          } else {
            pushed.position.y = pusherRect.b + PADDING;
          }
        }

        hadCollision = true;
      }
    }

    if (!hadCollision) break;
  }

  return result;
}

function TileNode({ data }: { data: Record<string, unknown> }) {
  const { truncLabel, statusLabel, responseTime, textColor, groupColors, isFocused } = data as {
    truncLabel: string; statusLabel: string; responseTime: number | null;
    textColor: string; groupColors: string[]; isFocused: boolean;
  };
  return (
    <div className="w-full h-full relative overflow-hidden rounded-[10px]">
      {groupColors.length > 0 && (
        <div className="absolute top-0 left-0 right-0 h-[6px] flex">
          {groupColors.map((c: string, i: number) => (
            <div key={i} className="h-full flex-1" style={{ backgroundColor: c }} />
          ))}
        </div>
      )}
      {isFocused && (
        <div className="absolute top-1/2 left-2 -translate-y-1/2 w-[10px] h-[10px] rounded-full border-2 border-white bg-white/30" style={{ boxShadow: "0 0 4px rgba(255,255,255,0.8)" }} />
      )}
      <div className={`text-center flex flex-col items-center justify-center h-full ${groupColors.length > 0 ? "pt-1" : ""} ${isFocused ? "pl-4 pr-2" : "px-2"}`}>
        <div className="text-[11px] font-semibold truncate w-full" style={{ color: textColor }}>{truncLabel}</div>
        <div className="text-[9px] mt-0.5 opacity-80" style={{ color: textColor }}>
          {statusLabel} {responseTime ? `| ${responseTime}ms` : ""}
        </div>
      </div>
    </div>
  );
}

const nodeTypes = { tile: TileNode };

function getCacheKey(domainId: string) { return `domspy-tree-positions-${domainId}`; }

function loadPositions(domainId: string): Record<string, { x: number; y: number }> {
  if (typeof window === "undefined") return {};
  try { const data = localStorage.getItem(getCacheKey(domainId)); return data ? JSON.parse(data) : {}; } catch { return {}; }
}

function savePositions(domainId: string, nodes: Node[]) {
  if (typeof window === "undefined") return;
  const positions: Record<string, { x: number; y: number }> = {};
  for (const node of nodes) { positions[node.id] = node.position; }
  try { localStorage.setItem(getCacheKey(domainId), JSON.stringify(positions)); } catch {}
}

export default function SiteTreeGraph({ pages, onNodeClick, domainId = "", focusNodeId }: SiteTreeGraphProps) {
  const [resetKey, setResetKey] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(focusNodeId);
  const reactFlowRef = useRef<HTMLDivElement>(null);
  const pagesKey = useMemo(() => pages.map((p) => p.id).sort().join(","), [pages]);

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(() => buildHorizontalTreeLayout(pages), [pagesKey, resetKey]);

  // Apply cached positions over computed layout
  const initialNodes = useMemo(() => {
    if (!domainId) return layoutNodes;
    const cached = loadPositions(domainId);
    return layoutNodes.map((node) => {
      if (cached[node.id]) { return { ...node, position: cached[node.id] }; }
      return node;
    });
  }, [layoutNodes, domainId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  // Apply radio button indicator to focused/selected node
  useEffect(() => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        const isFocused = node.id === selectedNodeId;
        const currentStyle = node.style || {};
        return {
          ...node,
          style: {
            ...currentStyle,
            boxShadow: isFocused
              ? "0 0 0 3px rgba(255,255,255,0.9), 0 0 0 5px rgba(59,130,246,0.5), 0 3px 10px rgba(0,0,0,0.12)"
              : "0 3px 10px rgba(0,0,0,0.12)",
          },
          data: {
            ...node.data,
            isFocused,
          },
        };
      })
    );
  }, [selectedNodeId, setNodes]);

  // Sync focusNodeId from parent
  useEffect(() => {
    if (focusNodeId) setSelectedNodeId(focusNodeId);
  }, [focusNodeId]);

  // Sync state when pages change (e.g., after crawl) or on reset
  const prevPagesKey = useRef(pagesKey);
  const prevResetKey = useRef(resetKey);
  useEffect(() => {
    if (prevPagesKey.current !== pagesKey || prevResetKey.current !== resetKey) {
      prevPagesKey.current = pagesKey;
      prevResetKey.current = resetKey;
      setNodes(initialNodes);
      setEdges(layoutEdges);
    }
  }, [pagesKey, resetKey, initialNodes, layoutEdges, setNodes, setEdges]);

  // Save positions when nodes change (debounced)
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  // Save on unmount
  useEffect(() => {
    return () => {
      if (domainId && nodesRef.current.length > 0) {
        savePositions(domainId, nodesRef.current);
      }
    };
  }, [domainId]);

  const handleNodesChange = useCallback((changes: any) => {
    onNodesChange(changes);
    if (!domainId) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      setNodes((currentNodes) => { savePositions(domainId, currentNodes); return currentNodes; });
    }, 500);
  }, [onNodesChange, domainId, setNodes]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    onNodeClick(node.id);
  }, [onNodeClick]);

  const handleNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    setNodes((currentNodes) => {
      const resolved = resolveCollisions(currentNodes, node.id);
      if (domainId) savePositions(domainId, resolved);
      return resolved;
    });
  }, [setNodes, domainId]);

  const handleResetLayout = () => {
    if (domainId) { try { localStorage.removeItem(getCacheKey(domainId)); } catch {} }
    setResetKey((k) => k + 1);
  };

  const hasCachedPositions = useMemo(() => domainId ? Object.keys(loadPositions(domainId)).length > 0 : false, [domainId, resetKey]);

  if (pages.length === 0) {
    return (<div className="h-[500px] flex items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200"><p className="text-gray-400">Nenhuma pagina encontrada. Execute um crawl primeiro.</p></div>);
  }

  return (
    <div ref={reactFlowRef} className="h-[700px] rounded-2xl overflow-hidden border border-gray-200 bg-white relative">
      <button onClick={handleResetLayout} className="absolute top-3 right-3 z-10 px-3 py-1.5 bg-white/90 border border-gray-200 rounded-lg text-xs text-gray-500 hover:text-[#1a1a2e] hover:bg-white shadow-sm">
        Resetar Layout
      </button>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={handleNodesChange} onEdgesChange={onEdgesChange} onNodeClick={handleNodeClick} onNodeDragStop={handleNodeDragStop} fitView={resetKey === 0 && !hasCachedPositions} fitViewOptions={{ padding: 0.2 }} minZoom={0.05} maxZoom={2} snapToGrid={true} snapGrid={[20, 20]}>
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} className="!bg-white !border-gray-200 !rounded-xl !shadow-lg" />
        <MiniMap nodeColor={(node) => { const s = node.style as Record<string, string> | undefined; return s?.background || "#94a3b8"; }} className="!bg-gray-50 !border-gray-200 !rounded-xl" />
      </ReactFlow>
    </div>
  );
}
