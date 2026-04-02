"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow, Node, Edge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, BackgroundVariant, MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getPageStatus, STATUS_COLORS } from "@/types";

interface PageNode {
  id: string; url: string; title: string | null; statusCode: number | null;
  responseTime: number | null; parentPageId: string | null;
  linksFrom: { href: string; toPageId: string | null }[];
}

interface SiteTreeGraphProps { pages: PageNode[]; onNodeClick: (pageId: string) => void; }

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

    nodes.push({
      id: nodeId,
      position: { x, y: nodeY },
      data: {
        label: (
          <div className="text-center px-2 py-1">
            <div className="text-[11px] font-semibold truncate" style={{ color: colors.text }}>{truncLabel}</div>
            <div className="text-[9px] mt-0.5 opacity-80" style={{ color: colors.text }}>
              {page.statusCode === null ? "Pendente" : page.statusCode === 0 ? "ERR" : `${page.statusCode} | ${page.responseTime || "?"}ms`}
            </div>
          </div>
        ),
      },
      style: {
        background: colors.bg, border: "none", borderRadius: "10px",
        width: NODE_W, height: NODE_H, display: "flex", alignItems: "center",
        justifyContent: "center", boxShadow: "0 3px 10px rgba(0,0,0,0.12)", cursor: "pointer",
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

export default function SiteTreeGraph({ pages, onNodeClick }: SiteTreeGraphProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => buildHorizontalTreeLayout(pages), [pages]);
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => { onNodeClick(node.id); }, [onNodeClick]);

  if (pages.length === 0) {
    return (<div className="h-[500px] flex items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200"><p className="text-gray-400">Nenhuma pagina encontrada. Execute um crawl primeiro.</p></div>);
  }

  return (
    <div className="h-[700px] rounded-2xl overflow-hidden border border-gray-200 bg-white">
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={handleNodeClick} fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.05} maxZoom={2}>
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} className="!bg-white !border-gray-200 !rounded-xl !shadow-lg" />
        <MiniMap nodeColor={(node) => { const s = node.style as Record<string, string> | undefined; return s?.background || "#94a3b8"; }} className="!bg-gray-50 !border-gray-200 !rounded-xl" />
      </ReactFlow>
    </div>
  );
}
