"use client";
import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import SiteTreeGraph from "@/components/SiteTreeGraph";
import PageDetailPanel from "@/components/PageDetailPanel";
import StatusCard from "@/components/StatusCard";
import { ArrowLeftIcon, PlayIcon, ArrowDownTrayIcon, CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon, SignalIcon, ArrowPathIcon, ClockIcon, PlusIcon, LinkIcon } from "@heroicons/react/24/outline";

interface PageData { id: string; url: string; title: string | null; description: string | null; h1: string | null; statusCode: number | null; responseTime: number | null; parentPageId: string | null; linksFrom: { href: string; statusCode: number | null; isExternal: boolean; anchor: string | null; toPageId: string | null; }[]; linksTo: { href: string }[]; }
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
  const isAdmin = session?.user?.role === "super_admin" || session?.user?.role === "admin";

  const fetchDomain = () => { fetch(`/api/domains/${id}`).then((r) => r.json()).then((data) => { setDomain(data); if (data.crawls?.[0]?.status === "running") setCrawling(true); }).finally(() => setLoading(false)); };
  useEffect(() => { if (status === "authenticated") fetchDomain(); }, [status, id]);
  useEffect(() => { if (!crawling) return; const i = setInterval(fetchDomain, 3000); return () => clearInterval(i); }, [crawling]);
  useEffect(() => { if (domain?.crawls?.[0]?.status !== "running") setCrawling(false); }, [domain]);

  const handleCrawl = async () => { setCrawling(true); await fetch("/api/crawl", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domainId: id }) }); fetchDomain(); setCrawling(false); };
  const handleExport = () => { window.open(`/api/export?domainId=${id}`, "_blank"); };

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
      if (res.ok) { const data = await res.json(); setImportResult(`Importado: ${data.added} novas, ${data.skipped} duplicadas, ${data.errors} com erro`); setBulkUrls(""); fetchDomain(); } else { setImportResult("Erro na importacao"); }
    } catch { setImportResult("Erro de conexao"); } finally { setImporting(false); }
  };

  const handleDismissAllAlerts = async (alertType: string) => { await fetch("/api/alerts/dismiss-all", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domainId: id, alertType }) }); fetchDomain(); };
  const handleDismissAlert = async (pageId: string, alertType: string) => { setDismissedAlerts((prev) => new Set(prev).add(`${pageId}:${alertType}`)); await fetch("/api/alerts/dismiss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageId, alertType, domainId: id }) }); };

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
        <div className="flex items-center justify-between mb-8">
          <div>
            <button onClick={() => router.push("/domains")} className="flex items-center gap-1 text-sm text-gray-400 hover:text-[#1a1a2e] mb-2"><ArrowLeftIcon className="w-4 h-4" /> Voltar</button>
            <h1 className="text-2xl font-bold text-[#1a1a2e]">{domain.name}</h1>
            <p className="text-gray-500 mt-1">{domain.url}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleExport} disabled={domain.pages.length === 0} className="px-4 py-2.5 bg-white border-2 border-gray-200 text-[#1a1a2e] rounded-xl text-sm font-medium hover:border-gray-300 disabled:opacity-50 flex items-center gap-2"><ArrowDownTrayIcon className="w-4 h-4" />Exportar MD</button>
            {isAdmin && <button onClick={handleCrawl} disabled={crawling} className="px-6 py-2.5 bg-gradient-to-r from-[#14A44D] to-[#0f8a3f] text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 shadow-lg shadow-green-500/25 flex items-center gap-2">{crawling ? <><ArrowPathIcon className="w-4 h-4 animate-spin" />Crawling...</> : <><PlayIcon className="w-4 h-4" />Iniciar Crawl</>}</button>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatusCard title="Total de Paginas" value={totalPages} status="info" icon={SignalIcon} />
          <StatusCard title="Paginas OK" value={okPages} status="ok" icon={CheckCircleIcon} />
          <StatusCard title="Paginas Lentas" value={slowPages} status="warning" icon={ExclamationTriangleIcon} onClear={isAdmin && slowPages > 0 ? () => handleDismissAllAlerts("slow_page") : undefined} />
          <StatusCard title="Links Quebrados" value={brokenLinks} status="error" icon={XCircleIcon} onClear={isAdmin && brokenLinks > 0 ? () => handleDismissAllAlerts("broken_link") : undefined} />
        </div>

        {isAdmin && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
            <h2 className="text-lg font-semibold text-[#1a1a2e] mb-4 flex items-center gap-2"><LinkIcon className="w-5 h-5 text-[#3B82F6]" />Adicionar Pagina Manualmente</h2>
            {pageError && <div className="bg-[#DC4C64]/10 text-[#DC4C64] px-4 py-3 rounded-xl mb-4 text-sm font-medium">{pageError}</div>}
            <form onSubmit={handleAddPage} className="space-y-3">
              <div className="flex gap-4">
                <div className="flex-1"><input type="url" value={newPageUrl} onChange={(e) => setNewPageUrl(e.target.value)} placeholder="URL da pagina" className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#3B82F6] focus:outline-none text-[#1a1a2e]" required /></div>
                <button type="submit" disabled={addingPage} className="px-6 py-3 bg-gradient-to-r from-[#3B82F6] to-[#2563EB] text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 shadow-lg shadow-blue-500/25 flex items-center gap-2">{addingPage ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <PlusIcon className="w-5 h-5" />}Adicionar</button>
              </div>
              <div className="flex gap-4">
                <input type="text" value={newPageTitle} onChange={(e) => setNewPageTitle(e.target.value)} placeholder="Titulo (opcional)" className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-[#3B82F6] focus:outline-none text-[#1a1a2e] text-sm" />
                <input type="text" value={newPageDesc} onChange={(e) => setNewPageDesc(e.target.value)} placeholder="Descricao (opcional)" className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-[#3B82F6] focus:outline-none text-[#1a1a2e] text-sm" />
              </div>
            </form>
          </div>
        )}

        {isAdmin && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
            <h2 className="text-lg font-semibold text-[#1a1a2e] mb-4 flex items-center gap-2"><ArrowDownTrayIcon className="w-5 h-5 text-[#14A44D]" />Importar Paginas em Massa</h2>
            <p className="text-sm text-gray-500 mb-3">Cole uma URL por linha.</p>
            <textarea value={bulkUrls} onChange={(e) => setBulkUrls(e.target.value)} placeholder={"https://seusite.com.br/pagina1\nhttps://seusite.com.br/pagina2"} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#14A44D] focus:outline-none text-[#1a1a2e] text-sm h-32 resize-y font-mono" />
            <div className="flex items-center justify-between mt-3">
              <div>{importResult && <span className="text-sm font-medium text-[#14A44D]">{importResult}</span>}{bulkUrls.trim() && <span className="text-xs text-gray-400 ml-2">{bulkUrls.split("\n").filter((u) => u.trim()).length} URLs</span>}</div>
              <button onClick={handleBulkImport} disabled={importing || !bulkUrls.trim()} className="px-6 py-2.5 bg-gradient-to-r from-[#14A44D] to-[#0f8a3f] text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 shadow-lg shadow-green-500/25 flex items-center gap-2">{importing ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <PlusIcon className="w-4 h-4" />}Importar Todas</button>
            </div>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-lg font-semibold text-[#1a1a2e] mb-4">Arvore de Sites</h2>
          <SiteTreeGraph pages={domain.pages} onNodeClick={setSelectedPageId} />
        </div>

        {domain.crawls.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100"><h2 className="text-lg font-semibold text-[#1a1a2e]">Historico de Crawls</h2></div>
            <div className="divide-y divide-gray-100">
              {domain.crawls.map((crawl) => (
                <div key={crawl.id} className="px-6 py-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${crawl.status === "running" ? "bg-[#3B82F6] animate-pulse" : crawl.status === "completed" ? "bg-[#14A44D]" : crawl.status === "blocked" ? "bg-[#E4A11B]" : "bg-[#DC4C64]"}`} />
                    <span className="text-gray-500">{crawl.status === "running" ? "Em andamento" : crawl.status === "completed" ? "Concluido" : crawl.status === "blocked" ? "Bloqueado (Cloudflare)" : "Falhou"}</span>
                  </div>
                  <div className="flex items-center gap-6 text-gray-400">
                    <span>{crawl.totalPages} paginas</span><span>{crawl.brokenLinks} quebrados</span><span>{crawl.slowPages} lentos</span>
                    <span className="flex items-center gap-1"><ClockIcon className="w-3.5 h-3.5" />{new Date(crawl.startedAt).toLocaleString("pt-BR")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      {selectedPage && <PageDetailPanel page={selectedPage} onClose={() => setSelectedPageId(null)} onDismissAlert={isAdmin ? handleDismissAlert : undefined} dismissedAlerts={dismissedAlerts} />}
    </div>
  );
}
