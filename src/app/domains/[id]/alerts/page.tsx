"use client";
import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { ArrowLeftIcon, ExclamationTriangleIcon, XCircleIcon, ClockIcon, DocumentTextIcon, PhotoIcon, LinkIcon, ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface PageData {
  id: string; url: string; title: string | null; description: string | null;
  h1: string | null; images: string | null; statusCode: number | null;
  responseTime: number | null; contentHash: string | null;
  linksFrom: { href: string; statusCode: number | null; isExternal: boolean }[];
}

interface AlertItem { pageId: string; pageUrl: string; pageTitle: string | null; detail: string; }
interface AlertGroup { category: string; icon: string; color: string; bgColor: string; items: AlertItem[]; }

export default function AlertsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { status } = useSession();
  const router = useRouter();
  const [domain, setDomain] = useState<{ name: string; url: string; pages: PageData[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleGroup = (category: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetch(`/api/domains/${id}`).then((r) => r.json()).then(setDomain).finally(() => setLoading(false));
    }
  }, [status, id]);

  if (loading || !domain) {
    return (<div className="flex min-h-screen"><Sidebar /><main className="flex-1 ml-64 p-8"><div className="animate-pulse"><div className="h-8 bg-gray-200 rounded w-48" /></div></main></div>);
  }

  // Build alert groups
  const groups: AlertGroup[] = [];

  // 1. Broken links
  const brokenPages = domain.pages.filter((p) => p.statusCode !== null && (p.statusCode === 0 || p.statusCode >= 400));
  if (brokenPages.length > 0) {
    groups.push({
      category: "Links Quebrados", icon: "XCircle", color: "#DC4C64", bgColor: "#DC4C64",
      items: brokenPages.map((p) => ({ pageId: p.id, pageUrl: p.url, pageTitle: p.title, detail: `Status ${p.statusCode || "ERR"}` })),
    });
  }

  // 2. Slow pages
  const slowPages = domain.pages.filter((p) => p.responseTime !== null && p.responseTime > 2000);
  if (slowPages.length > 0) {
    groups.push({
      category: "Paginas Lentas", icon: "Clock", color: "#E4A11B", bgColor: "#E4A11B",
      items: slowPages.map((p) => ({ pageId: p.id, pageUrl: p.url, pageTitle: p.title, detail: `${p.responseTime}ms` })),
    });
  }

  // 3. SEO - Missing title
  const noTitle = domain.pages.filter((p) => p.statusCode === 200 && !p.title);
  if (noTitle.length > 0) {
    groups.push({
      category: "Sem Title", icon: "Doc", color: "#DC4C64", bgColor: "#DC4C64",
      items: noTitle.map((p) => ({ pageId: p.id, pageUrl: p.url, pageTitle: p.title, detail: "Tag <title> ausente" })),
    });
  }

  // 4. SEO - Missing H1
  const noH1 = domain.pages.filter((p) => p.statusCode === 200 && !p.h1);
  if (noH1.length > 0) {
    groups.push({
      category: "Sem H1", icon: "Doc", color: "#E4A11B", bgColor: "#E4A11B",
      items: noH1.map((p) => ({ pageId: p.id, pageUrl: p.url, pageTitle: p.title, detail: "Tag <h1> ausente" })),
    });
  }

  // 5. SEO - Missing description
  const noDesc = domain.pages.filter((p) => p.statusCode === 200 && !p.description);
  if (noDesc.length > 0) {
    groups.push({
      category: "Sem Meta Description", icon: "Doc", color: "#E4A11B", bgColor: "#E4A11B",
      items: noDesc.map((p) => ({ pageId: p.id, pageUrl: p.url, pageTitle: p.title, detail: "Meta description ausente" })),
    });
  }

  // 6. SEO - Short description
  const shortDesc = domain.pages.filter((p) => p.description && p.description.length < 50);
  if (shortDesc.length > 0) {
    groups.push({
      category: "Description Curta", icon: "Doc", color: "#3B82F6", bgColor: "#3B82F6",
      items: shortDesc.map((p) => ({ pageId: p.id, pageUrl: p.url, pageTitle: p.title, detail: `${p.description?.length} caracteres (min: 50)` })),
    });
  }

  // 7. Images - non-optimized formats
  const heavyImagePages: AlertItem[] = [];
  for (const page of domain.pages) {
    if (!page.images) continue;
    try {
      const imgs = JSON.parse(page.images) as { src: string; alt: string; format: string }[];
      const heavy = imgs.filter((img) => img.format === "PNG" || img.format === "JPG" || img.format === "unknown");
      if (heavy.length > 0) {
        heavyImagePages.push({
          pageId: page.id, pageUrl: page.url, pageTitle: page.title,
          detail: `${heavy.length} imagens nao otimizadas (${heavy.map((i) => i.format).join(", ")}) - use WEBP/AVIF`,
        });
      }
    } catch {}
  }
  if (heavyImagePages.length > 0) {
    groups.push({ category: "Imagens Nao Otimizadas", icon: "Photo", color: "#E4A11B", bgColor: "#E4A11B", items: heavyImagePages });
  }

  // 8. Duplicate content
  const hashMap = new Map<string, PageData[]>();
  for (const p of domain.pages) {
    if (!p.contentHash) continue;
    const arr = hashMap.get(p.contentHash) || [];
    arr.push(p);
    hashMap.set(p.contentHash, arr);
  }
  const dupeItems: AlertItem[] = [];
  for (const [, pages] of hashMap) {
    if (pages.length > 1) {
      for (const p of pages) {
        dupeItems.push({
          pageId: p.id, pageUrl: p.url, pageTitle: p.title,
          detail: `Duplicado com: ${pages.filter((x) => x.id !== p.id).map((x) => x.url).join(", ")}`,
        });
      }
    }
  }
  if (dupeItems.length > 0) {
    groups.push({ category: "Conteudo Duplicado", icon: "Doc", color: "#DC4C64", bgColor: "#DC4C64", items: dupeItems });
  }

  // 9. Broken outgoing links
  const brokenOutLinks: AlertItem[] = [];
  for (const page of domain.pages) {
    const broken = page.linksFrom.filter((l) => l.statusCode && l.statusCode >= 400);
    if (broken.length > 0) {
      brokenOutLinks.push({
        pageId: page.id, pageUrl: page.url, pageTitle: page.title,
        detail: `${broken.length} links quebrados: ${broken.slice(0, 3).map((l) => l.href).join(", ")}${broken.length > 3 ? "..." : ""}`,
      });
    }
  }
  if (brokenOutLinks.length > 0) {
    groups.push({ category: "Links Saindo Quebrados", icon: "Link", color: "#DC4C64", bgColor: "#DC4C64", items: brokenOutLinks });
  }

  const totalAlerts = groups.reduce((sum, g) => sum + g.items.length, 0);

  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    XCircle: XCircleIcon, Clock: ClockIcon, Doc: DocumentTextIcon, Photo: PhotoIcon, Link: LinkIcon,
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="mb-8">
          <button onClick={() => router.push(`/domains/${id}`)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-[#1a1a2e] mb-2">
            <ArrowLeftIcon className="w-4 h-4" /> Voltar para {domain.name}
          </button>
          <h1 className="text-2xl font-bold text-[#1a1a2e] flex items-center gap-2">
            <ExclamationTriangleIcon className="w-7 h-7" /> Alertas
          </h1>
          <p className="text-gray-500 mt-1">{totalAlerts} alertas encontrados em {domain.pages.length} paginas</p>
        </div>

        {groups.length === 0 ? (
          <div className="bg-[#14A44D]/5 rounded-2xl p-12 text-center">
            <p className="text-lg font-medium text-[#14A44D]">Nenhum alerta encontrado!</p>
            <p className="text-sm text-gray-500 mt-1">Todas as paginas estao em conformidade.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => {
              const Icon = iconMap[group.icon] || ExclamationTriangleIcon;
              const isCollapsed = collapsed.has(group.category);
              return (
                <div key={group.category} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <button
                    onClick={() => toggleGroup(group.category)}
                    className="w-full px-6 py-4 border-b border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    style={{ borderLeftWidth: 4, borderLeftColor: group.color }}
                  >
                    <div className="flex items-center gap-3">
                      {isCollapsed ? <ChevronRightIcon className="w-4 h-4 text-gray-400" /> : <ChevronDownIcon className="w-4 h-4 text-gray-400" />}
                      <Icon className="w-5 h-5" />
                      <h2 className="text-base font-semibold text-[#1a1a2e]">{group.category}</h2>
                    </div>
                    <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ color: group.color, backgroundColor: `${group.color}15` }}>
                      {group.items.length}
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="divide-y divide-gray-50">
                      {group.items.map((item, i) => (
                        <div
                          key={`${item.pageId}-${i}`}
                          className="px-6 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between group/item"
                          onClick={() => router.push(`/domains/${id}?focusPage=${item.pageId}`)}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-[#1a1a2e] truncate group-hover/item:text-[#3B82F6] transition-colors">{item.pageTitle || item.pageUrl}</div>
                            <div className="text-xs text-gray-400 truncate">{item.pageUrl}</div>
                          </div>
                          <div className="text-xs text-gray-500 ml-4 shrink-0 max-w-[300px] truncate">{item.detail}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
