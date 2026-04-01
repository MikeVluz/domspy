"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import {
  GlobeAltIcon,
  PlusIcon,
  TrashIcon,
  PlayIcon,
  ArrowTopRightOnSquareIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

interface DomainData {
  id: string;
  url: string;
  name: string;
  lastCrawlAt: string | null;
  _count: { pages: number };
  crawls: {
    id: string;
    status: string;
    totalPages: number;
    brokenLinks: number;
    slowPages: number;
  }[];
}

export default function DomainsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [domains, setDomains] = useState<DomainData[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [crawling, setCrawling] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  const isAdmin = session?.user?.role === "super_admin" || session?.user?.role === "admin";

  const fetchDomains = () => {
    fetch("/api/domains").then((r) => r.json()).then((data) => { if (Array.isArray(data)) setDomains(data); }).finally(() => setLoading(false));
  };

  useEffect(() => { if (status === "authenticated") fetchDomains(); }, [status]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/domains", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: newUrl, name: newName }) });
      if (!res.ok) { let msg = "Erro"; try { const d = await res.json(); msg = d.error || msg; } catch {} setError(msg); return; }
      setNewUrl(""); setNewName(""); fetchDomains();
    } catch { setError("Erro de conexao"); } finally { setAdding(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remover "${name}"?`)) return;
    await fetch(`/api/domains/${id}`, { method: "DELETE" });
    fetchDomains();
  };

  const handleCrawl = async (id: string) => {
    setCrawling((prev) => new Set(prev).add(id));
    try {
      await fetch("/api/crawl", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domainId: id }) });
      fetchDomains();
    } finally { setCrawling((prev) => { const next = new Set(prev); next.delete(id); return next; }); }
  };

  if (status === "loading" || loading) {
    return (<div className="flex min-h-screen"><Sidebar /><main className="flex-1 ml-64 p-8"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-48" /><div className="h-32 bg-gray-200 rounded-2xl" /></div></main></div>);
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#1a1a2e]">Dominios</h1>
          <p className="text-gray-500 mt-1">Gerencie os dominios e paginas monitorados</p>
        </div>

        {isAdmin && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
            <h2 className="text-lg font-semibold text-[#1a1a2e] mb-4 flex items-center gap-2">
              <PlusIcon className="w-5 h-5 text-[#3B82F6]" />Adicionar Novo Monitoramento
            </h2>
            {error && <div className="bg-[#DC4C64]/10 text-[#DC4C64] px-4 py-3 rounded-xl mb-4 text-sm font-medium">{error}</div>}
            <form onSubmit={handleAdd} className="flex gap-4">
              <div className="flex-1"><input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do dominio" className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#3B82F6] focus:outline-none text-[#1a1a2e]" required /></div>
              <div className="flex-1"><input type="url" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://exemplo.com.br" className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#3B82F6] focus:outline-none text-[#1a1a2e]" required /></div>
              <button type="submit" disabled={adding} className="px-8 py-3 bg-gradient-to-r from-[#3B82F6] to-[#2563EB] text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 shadow-lg shadow-blue-500/25 flex items-center gap-2">
                {adding ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <PlusIcon className="w-5 h-5" />}Adicionar
              </button>
            </form>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-[#1a1a2e]">Dominios Monitorados ({domains.length})</h2>
          </div>
          {domains.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <MagnifyingGlassIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-400">Nenhum dominio cadastrado</h3>
              <p className="text-gray-400 mt-1 text-sm">{isAdmin ? "Use o formulario acima" : "Aguarde o administrador"}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {domains.map((domain) => {
                const crawl = domain.crawls[0];
                const isCrawling = crawling.has(domain.id) || crawl?.status === "running";
                return (
                  <div key={domain.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => router.push(`/domains/${domain.id}`)}>
                      <div className="w-12 h-12 rounded-xl bg-[#1a1a2e]/5 flex items-center justify-center"><GlobeAltIcon className="w-6 h-6 text-[#1a1a2e]/40" /></div>
                      <div>
                        <h3 className="font-medium text-[#1a1a2e]">{domain.name}</h3>
                        <p className="text-sm text-gray-400 flex items-center gap-1"><ArrowTopRightOnSquareIcon className="w-3 h-3" />{domain.url}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {crawl && <div className="text-sm text-gray-400 mr-4">{crawl.totalPages} paginas</div>}
                      {isAdmin && (<>
                        <button onClick={() => handleCrawl(domain.id)} disabled={isCrawling} className="p-2.5 rounded-xl bg-[#14A44D]/10 text-[#14A44D] hover:bg-[#14A44D]/20 disabled:opacity-50" title="Iniciar Crawl">
                          {isCrawling ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <PlayIcon className="w-5 h-5" />}
                        </button>
                        <button onClick={() => handleDelete(domain.id, domain.name)} className="p-2.5 rounded-xl bg-[#DC4C64]/10 text-[#DC4C64] hover:bg-[#DC4C64]/20" title="Remover"><TrashIcon className="w-5 h-5" /></button>
                      </>)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
