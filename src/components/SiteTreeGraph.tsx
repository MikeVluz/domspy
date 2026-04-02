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

const NODE_WIDTH = 200;
const NODE_HEIGHT = 70;

function buildMindMapLayout(pages: PageNode[]) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  if (pages.length === 0) return { nodes, edges };

  const pageById = new Map(pages.map((p) => [p.id, p]));
  const adjacency = new Map<string, Set<string>>();

  for (const page of pages) {
    if (!adjacency.has(page.id)) adjacency.set(page.id, new Set());
    for (const link of page.linksFrom) {
      if (link.toPageId && pageById.has(link.toPageId)) {
        adjacency.get(page.id)!.add(link.toPageId);
        if (!adjacency.has(link.toPageId)) adjacency.set(link.toPageId, new Set());
      }
    }
  }

  let rootId = pages[0].id;
  let maxLinks = 0;
  for (const page of pages) {
    const linkCount = page.linksFrom.filter((l) => l.toPageId && pageById.has(l.toPageId)).length;
    if (linkCount > maxLinks) { maxLinks = linkCount; rootId = page.id; }
  }
  for (const page of pages) {
    try { const u = new URL(page.url); if (u.pathname === "/" || u.pathname === "") { rootId = page.id; break; } } catch {}
  }

  const levels = new Map<string, number>();
  const parentMap = new Map<string, string>();
  const queue: string[] = [rootId];
  levels.set(rootId, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = levels.get(current)!;
    const neighbors = adjacency.get(current) || new Set();
    for (const neighbor of neighbors) {
      if (!levels.has(neighbor)) { levels.set(neighbor, currentLevel + 1); parentMap.set(neighbor, current); queue.push(neighbor); }
    }
  }

  for (const page of pages) {
    if (!levels.has(page.id)) { levels.set(page.id, 1); parentMap.set(page.id, rootId); }
  }

  const levelGroups = new Map<number, string[]>();
  for (const [pageId, level] of levels) {
    if (!levelGroups.has(level)) levelGroups.set(level, []);
    levelGroups.get(level)!.push(pageId);
  }

  const maxLevel = Math.max(...levelGroups.keys());
  const H_SPACING = NODE_WIDTH + 60;
  const V_SPACING = NODE_HEIGHT + 100;

  for (let level = 0; level <= maxLevel; level++) {
    const group = levelGroups.get(level) || [];
    const totalHeight = group.length * V_SPACING;
    const startY = -totalHeight / 2 + V_SPACING / 2;

    group.forEach((pageId, index) => {
      const page = pageById.get(pageId)!;
      const status = getPageStatus(page.statusCode, page.responseTime);
      const colors = STATUS_COLORS[status];
      let displayUrl = page.url;
      try { const u = new URL(page.url); displayUrl = u.pathname === "/" ? u.hostname : u.pathname; } catch {}
      const label = page.title || displayUrl;
      const truncatedLabel = label.length > 25 ? label.slice(0, 22) + "..." : label;

      nodes.push({
        id: pageId, position: { x: level * H_SPACING, y: startY + index * V_SPACING },
        data: { label: (<div className="text-center px-2 py-1"><div className="text-xs font-semibold truncate" style={{ color: colors.text }}>{truncatedLabel}</div><div className="text-[10px] mt-0.5 opacity-80" style={{ color: colors.text }}>{page.statusCode === null ? "Pendente" : page.statusCode === 0 ? "ERR" : `${page.statusCode} | ${page.responseTime || "?"}ms`}</div></div>) },
        style: { background: colors.bg, border: "none", borderRadius: "12px", width: NODE_WIDTH, height: NODE_HEIGHT, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", cursor: "pointer" },
      });
    });
  }

  const edgeSet = new Set<string>();
  for (const [childId, pId] of parentMap) {
    const edgeKey = `${pId}->${childId}`;
    if (!edgeSet.has(edgeKey)) {
      edgeSet.add(edgeKey);
      const pp = pageById.get(pId);
      const ps = pp ? getPageStatus(pp.statusCode, pp.responseTime) : "info";
      const ec = STATUS_COLORS[ps].bg;
      edges.push({ id: edgeKey, source: pId, target: childId, type: "smoothstep", style: { stroke: ec, strokeWidth: 2, opacity: 0.6 }, markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: ec } });
    }
  }

  return { nodes, edges };
}

export default function SiteTreeGraph({ pages, onNodeClick }: SiteTreeGraphProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => buildMindMapLayout(pages), [pages]);
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => { onNodeClick(node.id); }, [onNodeClick]);

  if (pages.length === 0) {
    return (<div className="h-[500px] flex items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200"><p className="text-gray-400">Nenhuma pagina encontrada. Execute um crawl primeiro.</p></div>);
  }

  return (
    <div className="h-[600px] rounded-2xl overflow-hidden border border-gray-200 bg-white">
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={handleNodeClick} fitView fitViewOptions={{ padding: 0.3 }} minZoom={0.1} maxZoom={2}>
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} className="!bg-white !border-gray-200 !rounded-xl !shadow-lg" />
        <MiniMap nodeColor={(node) => { const s = node.style as Record<string, string> | undefined; return s?.background || "#94a3b8"; }} className="!bg-gray-50 !border-gray-200 !rounded-xl" />
      </ReactFlow>
    </div>
  );
}
