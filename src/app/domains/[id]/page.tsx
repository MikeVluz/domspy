"use client";
import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SiteTreeGraph from "@/components/SiteTreeGraph";
import PageDetailPanel from "@/components/PageDetailPanel";
import StatusCard from "@/components/StatusCard";
import {
  ArrowLeftIcon, PlayIcon, ArrowDownTrayIcon, CheckCircleIcon,
  ExclamationTriangleIcon, XCircleIcon, SignalIcon, ArrowPathIcon,
  ClockIcon, PlusIcon, LinkIcon, PencilIcon, CheckIcon,
  BellAlertIcon, EyeIcon, CodeBracketIcon, SwatchIcon,
} from "@heroicons/react/24/outline";

interface PageData {
  id: string; url: string; title: string | null; description: string | null;
  h1: string | null; headings: string | null; bodyText: string | null;
  images: string | null; statusCode: number | null; responseTime: number | null;
  parentPageId: string | null;
  linksFrom: { href: string; statusCode: number | null; isExternal: boolean; anchor: string | null; toPageId: string | null; }[];
  linksTo: { href: string }[];
  groupMembers: { group: { id: string; name: string; color: string } }[];
}
interface CrawlData { id: string; status: string; totalPages: number; brokenLinks: number; slowPages: number; startedAt: string; finishedAt: string | null; }
interface DomainDetail { id: string; url: string; name: string; lastCrawlAt: string | null; pages: PageData[]; crawls: CrawlData[]; }

export default function DomainDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  const [domain, setDomain] = useState<DomainDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [crawling, setCrawling] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [newPageUrl, setNewPageUrl] = useState("");
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageDesc, setNewPageDesc] = useState("");
  const [addingPage, setAddingPage] = useState(false);
  const [bulkUrls, setBulkUrls] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState("");
  const [pageError, setPageError] = useState("");
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [groups, setGroups] = useState<{ id: string; name: string; color: string }[]>([]);

  const fetchGroups = () => {
    fetch(`/api/groups?domainId=${id}`).then((r) => r.json()).then((data) => { if (Array.isArray(data)) setGroups(data); });
  };

  const isAdmin = session?.user?.role === "super_admin" || session?.user?.role === "admin";

  const fetchDomain = () => {
    fetch(`/api/domains/${id}`).then((r) => r.json()).then((data) => {
      setDomain(data);
      if (data.crawls?.[0]?.status === "running") setCrawling(true);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { if (status === "authenticated") { fetchDomain(); fetchGroups(); } }, [status, id]);
  useEffect(() => { if (!crawling) return; const i = setInterval(fetchDomain, 3000); return () => clearInterval(i); }, [crawling]);
  useEffect(() => { if (domain?.crawls?.[0]?.status !== "running") setCrawling(false); }, [domain]);

  const handleCrawl = async () => {
    setCrawling(true);
    await fetch("/api/crawl", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domainId: id }) });
    fetchDomain(); setCrawling(false);
  };

  const handleExport = () => { window.open(`/api/export?domainId=${id}`, "_blank"); };

  const handleRename = async () => {
    if (!newName.trim()) return;
    await fetch(`/api/domains/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName }) });
    setEditingName(false); fetchDomain();
  };

  const handleAddPage = async (e: React.FormEvent) => {
    e.preventDefault(); if (!newPageUrl.trim()) return; setAddingPage(true); setPageError("");
    try {
      const res = await fetch("/api/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domainId: id, url: newPageUrl, title: newPageTitle || undefined, description: newPageDesc || undefined }) });
      if (!res.ok) { let msg = "Erro"; try { const d = await res.json(); msg = d.error || msg; } catch {} setPageError(msg); return; }
      setNewPageUrl(""); setNewPageTitle(""); setNewPageDesc(""); fetchDomain();
    } catch { setPageError("Erro de conexao"); } finally { setAddingPage(false); }
  };

  const handleBulkImport = async () => {
    const urls = bulkUrls.split("\n").map((u) => u.trim()).filter((u) => u.length > 0);
    if (urls.length === 0) return; setImporting(true); setImportResult("");
    try {
      const res = await fetch("/api/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domainId: id, urls }) });
      if (res.ok) { const data = await res.json(); setImportResult(`${data.added} novas, ${data.skipped} duplicadas, ${data.errors} com erro`); setBulkUrls(""); fetchDomain(); }
    } catch {} finally { setImporting(false); }
  };

  const handleDismissAllAlerts = async (alertType: string) => {
    await fetch("/api/alerts/dismiss-all", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domainId: id, alertType }) });
    fetchDomain();
  };

  const handleDismissAlert = async (pageId: string, alertType: string) => {
    setDismissedAlerts((prev) => new Set(prev).add(`${pageId}:${alertType}`));
    await fetch("/api/alerts/dismiss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageId, alertType, domainId: id }) });
  };

  if (status === "loading" || loading) return (<div className="flex min-h-screen"><Sidebar /><main className="flex-1 ml-64 p-8"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-48" /><div className="h-[600px] bg-gray-200 rounded-2xl" /></div></main></div>);
  if (!domain) return (<div className="flex min-h-screen"><Sidebar /><main className="flex-1 ml-64 p-8"><p className="text-gray-500">Dominio nao encontrado.</p></main></div>);

  const latestCrawl = domain.crawls[0];
  const totalPages = latestCrawl?.totalPages || 0;
  const brokenLinks = latestCrawl?.brokenLinks || 0;
  const slowPages = latestCrawl?.slowPages || 0;
  const okPages = Math.max(0, totalPages - brokenLinks - slowPages);
  const selectedPage = selectedPageId ? domain.pages.find((p) => p.id === selectedPageId) : null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">

        {/* HEADER - Name, URL, Last Crawl Status, Actions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <button onClick={() => router.push("/domains")} className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#1a1a2e] mb-2">
                <ArrowLeftIcon className="w-3 h-3" /> Voltar
              </button>

              {/* Editable Name */}
              {editingName ? (
                <div className="flex items-center gap-2 mb-1">
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="text-2xl font-bold text-[#1a1a2e] border-b-2 border-[#3B82F6] focus:outline-none bg-transparent" autoFocus onKeyDown={(e) => e.key === "Enter" && handleRename()} />
                  <button onClick={handleRename} className="p-1 rounded bg-[#14A44D] text-white"><CheckIcon className="w-5 h-5" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl font-bold text-[#1a1a2e]">{domain.name}</h1>
                  {isAdmin && <button onClick={() => { setEditingName(true); setNewName(domain.name); }} className="p-1 rounded hover:bg-gray-100 text-gray-400"><PencilIcon className="w-4 h-4" /></button>}
                </div>
              )}

              <p className="text-sm text-gray-400">{domain.url}</p>

              {/* Last crawl status */}
              {latestCrawl && (
                <div className="flex items-center gap-3 mt-3 text-sm">
                  <div className={`w-2 h-2 rounded-full ${latestCrawl.status === "completed" ? "bg-[#14A44D]" : latestCrawl.status === "running" ? "bg-[#3B82F6] animate-pulse" : "bg-[#DC4C64]"}`} />
                  <span className="text-gray-500">
                    Ultimo crawl: {latestCrawl.status === "completed" ? "Concluido" : latestCrawl.status === "running" ? "Em andamento" : "Falhou"}
                    {" - "}{new Date(latestCrawl.startedAt).toLocaleString("pt-BR")}
                    {" - "}{latestCrawl.totalPages} paginas
                  </span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button onClick={() => router.push(`/groups?domainId=${id}`)} className="px-4 py-2 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-xl text-sm font-medium hover:bg-[#8B5CF6]/20 flex items-center gap-1.5">
                <SwatchIcon className="w-4 h-4" /> Grupos
              </button>
              <button onClick={() => router.push(`/domains/${id}/alerts`)} className="px-4 py-2 bg-[#E4A11B]/10 text-[#E4A11B] rounded-xl text-sm font-medium hover:bg-[#E4A11B]/20 flex items-center gap-1.5">
                <BellAlertIcon className="w-4 h-4" /> Alertas
              </button>
              <button onClick={() => router.push(`/domains/${id}/history`)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 flex items-center gap-1.5">
                <ClockIcon className="w-4 h-4" /> Historico
              </button>
              <button onClick={handleExport} disabled={domain.pages.length === 0} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-200 disabled:opacity-50 flex items-center gap-1.5">
                <ArrowDownTrayIcon className="w-4 h-4" /> Exportar
              </button>
              {isAdmin && (
                <button onClick={handleCrawl} disabled={crawling} className="px-5 py-2 bg-gradient-to-r from-[#14A44D] to-[#0f8a3f] text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 shadow-lg shadow-green-500/25 flex items-center gap-1.5">
                  {crawling ? <><ArrowPathIcon className="w-4 h-4 animate-spin" />Crawling...</> : <><PlayIcon className="w-4 h-4" />Iniciar Crawl</>}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatusCard title="Total de Paginas" value={totalPages} status="info" icon={SignalIcon} />
          <StatusCard title="Paginas OK" value={okPages} status="ok" icon={CheckCircleIcon} />
          <StatusCard title="Paginas Lentas" value={slowPages} status="warning" icon={ExclamationTriangleIcon} onClear={isAdmin && slowPages > 0 ? () => handleDismissAllAlerts("slow_page") : undefined} />
          <StatusCard title="Links Quebrados" value={brokenLinks} status="error" icon={XCircleIcon} onClear={isAdmin && brokenLinks > 0 ? () => handleDismissAllAlerts("broken_link") : undefined} />
        </div>

        {/* Add Page + Bulk Import - admin only */}
        {isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-[#1a1a2e] mb-3 flex items-center gap-2"><LinkIcon className="w-4 h-4 text-[#3B82F6]" />Adicionar Pagina</h2>
              {pageError && <div className="bg-[#DC4C64]/10 text-[#DC4C64] px-3 py-2 rounded-lg mb-3 text-xs">{pageError}</div>}
              <form onSubmit={handleAddPage} className="space-y-2">
                <input type="url" value={newPageUrl} onChange={(e) => setNewPageUrl(e.target.value)} placeholder="URL da pagina" className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#3B82F6] focus:outline-none text-sm text-[#1a1a2e]" required />
                <div className="flex gap-2">
                  <input type="text" value={newPageTitle} onChange={(e) => setNewPageTitle(e.target.value)} placeholder="Titulo (opcional)" className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#3B82F6] focus:outline-none text-xs text-[#1a1a2e]" />
                  <button type="submit" disabled={addingPage} className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1">
                    {addingPage ? <ArrowPathIcon className="w-3 h-3 animate-spin" /> : <PlusIcon className="w-3 h-3" />}Adicionar
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-[#1a1a2e] mb-3 flex items-center gap-2"><ArrowDownTrayIcon className="w-4 h-4 text-[#14A44D]" />Importar em Massa</h2>
              <textarea value={bulkUrls} onChange={(e) => setBulkUrls(e.target.value)} placeholder={"Uma URL por linha"} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#14A44D] focus:outline-none text-xs text-[#1a1a2e] h-20 resize-y font-mono" />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">{importResult || (bulkUrls.trim() ? `${bulkUrls.split("\n").filter((u) => u.trim()).length} URLs` : "")}</span>
                <button onClick={handleBulkImport} disabled={importing || !bulkUrls.trim()} className="px-4 py-2 bg-[#14A44D] text-white rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1">
                  {importing ? <ArrowPathIcon className="w-3 h-3 animate-spin" /> : <PlusIcon className="w-3 h-3" />}Importar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Site Tree */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-[#1a1a2e] mb-4">Arvore de Sites</h2>
          <SiteTreeGraph pages={domain.pages} domainId={id} onNodeClick={(pageId) => {
            setSelectedPageId(pageId);
            const page = domain.pages.find((p) => p.id === pageId);
            if (page) setPreviewUrl(page.url);
          }} />
        </div>

      </main>

      {selectedPage && <PageDetailPanel page={selectedPage} onClose={() => setSelectedPageId(null)} onDismissAlert={isAdmin ? handleDismissAlert : undefined} dismissedAlerts={dismissedAlerts} onCrawlPage={isAdmin ? async (url) => {
        await fetch("/api/crawl-page", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageUrl: url, domainId: id }) });
        fetchDomain();
      } : undefined} groups={groups} onAssignGroup={isAdmin ? async (pageId, groupId) => {
        await fetch("/api/groups/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageId, groupId }) });
        fetchDomain(); fetchGroups();
      } : undefined} onRemoveFromGroup={isAdmin ? async (pageId) => {
        await fetch(`/api/groups/members?pageId=${pageId}`, { method: "DELETE" });
        fetchDomain(); fetchGroups();
      } : undefined} onRemoveFromSpecificGroup={isAdmin ? async (pageId, groupId) => {
        await fetch(`/api/groups/members?pageId=${pageId}&groupId=${groupId}`, { method: "DELETE" });
        fetchDomain(); fetchGroups();
      } : undefined} />}
    </div>
  );
}
