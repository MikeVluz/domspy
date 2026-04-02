"use client";

import { useCallback, useMemo, useRef, useState } from "react";
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

interface SiteTreeGraphProps { pages: PageNode[]; onNodeClick: (pageId: string) => void; domainId?: string; }

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

  // Build URL-based tree structure
  const pageById = new Map(pages.map((p) => [p.id, p]));
  const pageByUrl = new Map(pages.map((p) => [p.url.replace(/\/$/, ""), p]));

  // Find parent for each page based on URL structure
  const children = new Map<string, string[]>(); // parentId -> childIds
  const parentOf = new Map<string, string>(); // childId -> parentId
  const roots: string[] = [];

  // Sort pages by URL depth (shallowest first)
  const sorted = [...pages].sort((a, b) => getUrlDepth(a.url) - getUrlDepth(b.url));

  for (const page of sorted) {
    const depth = getUrlDepth(page.url);
    if (depth === 0) {
      roots.push(page.id);
      continue;
    }

    // Try to find parent by URL path
    const parentPath = getUrlParentPath(page.url);
    const parentPage = pageByUrl.get(parentPath.replace(/\/$/, "")) || pageByUrl.get(parentPath);

    if (parentPage && parentPage.id !== page.id) {
      parentOf.set(page.id, parentPage.id);
      const ch = children.get(parentPage.id) || [];
      ch.push(page.id);
      children.set(parentPage.id, ch);
    } else {
      // No URL parent found - attach to first root or make it a root
      if (roots.length > 0 && !roots.includes(page.id)) {
        parentOf.set(page.id, roots[0]);
        const ch = children.get(roots[0]) || [];
        ch.push(page.id);
        children.set(roots[0], ch);
      } else {
        roots.push(page.id);
      }
    }
  }

  // If no roots found, use first page
  if (roots.length === 0 && pages.length > 0) {
    roots.push(pages[0].id);
  }

  // Calculate subtree sizes for layout
  const subtreeSize = new Map<string, { w: number; h: number }>();

  function calcSize(nodeId: string): { w: number; h: number } {
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
  function positionNode(nodeId: string, x: number, y: number) {
    const page = pageById.get(nodeId)!;
    const status = getPageStatus(page.statusCode, page.responseTime);
    const colors = STATUS_COLORS[status];

    let displayUrl = page.url;
    try {
      const u = new URL(page.url);
      displayUrl = u.pathname === "/" ? u.hostname : u.pathname;
    } catch {}
    const label = page.title || displayUrl;
    const truncLabel = label.length > 22 ? label.slice(0, 19) + "..." : label;

    // Center node vertically in its allocated space
    const mySize = subtreeSize.get(nodeId) || { w: NODE_W, h: NODE_H };
    const nodeY = y + mySize.h / 2 - NODE_H / 2;

    const groupColors = page.groupMembers?.map((m) => m.group.color) || [];

    nodes.push({
      id: nodeId,
      position: { x, y: nodeY },
      data: {
        label: (
          <div className="w-full h-full relative overflow-hidden rounded-[10px]">
            {groupColors.length > 0 && (
              <div className="absolute top-0 left-0 right-0 h-[6px] flex">
                {groupColors.map((c, i) => (
                  <div key={i} className="h-full flex-1" style={{ backgroundColor: c }} />
                ))}
              </div>
            )}
            <div className={`text-center px-2 flex flex-col items-center justify-center h-full ${groupColors.length > 0 ? "pt-1" : ""}`}>
              <div className="text-[11px] font-semibold truncate w-full" style={{ color: colors.text }}>{truncLabel}</div>
              <div className="text-[9px] mt-0.5 opacity-80" style={{ color: colors.text }}>
                {getStatusLabel(page.statusCode)} {page.responseTime ? `| ${page.responseTime}ms` : ""}
              </div>
            </div>
          </div>
        ),
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

        // Edge
        const parentStatus = status;
        const edgeColor = STATUS_COLORS[parentStatus].bg;
        edges.push({
          id: `${nodeId}->${childId}`,
          source: nodeId, target: childId,
          type: "smoothstep",
          style: { stroke: edgeColor, strokeWidth: 2, opacity: 0.5 },
          markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: edgeColor },
        });

        positionNode(childId, childX, childY);
        childY += childSize.h + V_GAP;
      }
    }
  }

  // Layout all roots
  let rootY = 0;
  for (const rootId of roots) {
    calcSize(rootId);
  }

  for (const rootId of roots) {
    const size = subtreeSize.get(rootId) || { w: NODE_W, h: NODE_H };
    positionNode(rootId, 0, rootY);
    rootY += size.h + V_GAP * 2;
  }

  return { nodes, edges };
}

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

export default function SiteTreeGraph({ pages, onNodeClick, domainId = "" }: SiteTreeGraphProps) {
  const [resetKey, setResetKey] = useState(0);

  const { nodes: layoutNodes, edges: initialEdges } = useMemo(() => buildHorizontalTreeLayout(pages), [pages, resetKey]);

  // Apply cached positions
  const initialNodes = useMemo(() => {
    if (!domainId) return layoutNodes;
    const cached = loadPositions(domainId);
    return layoutNodes.map((node) => {
      if (cached[node.id]) { return { ...node, position: cached[node.id] }; }
      return node;
    });
  }, [layoutNodes, domainId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // Save positions when nodes change (debounced)
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const handleNodesChange = useCallback((changes: any) => {
    onNodesChange(changes);
    if (domainId && saveTimeout.current) clearTimeout(saveTimeout.current);
    if (domainId) {
      saveTimeout.current = setTimeout(() => {
        // Access current nodes via the setter to get latest state
        setNodes((currentNodes) => { savePositions(domainId, currentNodes); return currentNodes; });
      }, 500);
    }
  }, [onNodesChange, domainId, setNodes]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => { onNodeClick(node.id); }, [onNodeClick]);

  const handleResetLayout = () => {
    if (domainId) { try { localStorage.removeItem(getCacheKey(domainId)); } catch {} }
    setResetKey((k) => k + 1);
  };

  if (pages.length === 0) {
    return (<div className="h-[500px] flex items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200"><p className="text-gray-400">Nenhuma pagina encontrada. Execute um crawl primeiro.</p></div>);
  }

  return (
    <div className="h-[700px] rounded-2xl overflow-hidden border border-gray-200 bg-white relative">
      <button onClick={handleResetLayout} className="absolute top-3 right-3 z-10 px-3 py-1.5 bg-white/90 border border-gray-200 rounded-lg text-xs text-gray-500 hover:text-[#1a1a2e] hover:bg-white shadow-sm">
        Resetar Layout
      </button>
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={handleNodesChange} onEdgesChange={onEdgesChange} onNodeClick={handleNodeClick} fitView={resetKey === 0 && Object.keys(loadPositions(domainId)).length === 0} fitViewOptions={{ padding: 0.2 }} minZoom={0.05} maxZoom={2} snapToGrid={true} snapGrid={[20, 20]}>
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} className="!bg-white !border-gray-200 !rounded-xl !shadow-lg" />
        <MiniMap nodeColor={(node) => { const s = node.style as Record<string, string> | undefined; return s?.background || "#94a3b8"; }} className="!bg-gray-50 !border-gray-200 !rounded-xl" />
      </ReactFlow>
    </div>
  );
}
