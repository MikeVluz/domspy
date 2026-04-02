"use client";
import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { SwatchIcon, PlusIcon, TrashIcon, PencilIcon, CheckIcon, GlobeAltIcon } from "@heroicons/react/24/outline";

const COLORS = [
  "#DC4C64","#E4A11B","#14A44D","#3B82F6","#8B5CF6","#EC4899","#F97316","#06B6D4",
  "#84CC16","#EF4444","#F59E0B","#10B981","#6366F1","#A855F7","#F43F5E","#FB923C",
  "#22D3EE","#A3E635","#E11D48","#D97706","#059669","#4F46E5","#9333EA","#BE185D",
  "#EA580C","#0891B2","#65A30D","#B91C1C","#B45309","#047857","#4338CA","#7C3AED",
  "#9F1239","#C2410C","#0E7490","#4D7C0F","#991B1B","#92400E","#065F46","#3730A3",
  "#6D28D9","#881337","#9A3412","#155E75","#3F6212","#7F1D1D","#78350F","#064E3B",
  "#312E81","#5B21B6","#831843","#7C2D12",
];

interface Group { id: string; name: string; color: string; pages: { page: { id: string; url: string; title: string | null } }[]; }
interface DomainOption { id: string; name: string; url: string; }

export default function GroupsPageWrapper() {
  return (<Suspense fallback={<div className="flex min-h-screen"><Sidebar /><main className="flex-1 ml-64 p-8"><div className="animate-pulse"><div className="h-8 bg-gray-200 rounded w-48" /></div></main></div>}><GroupsPageContent /></Suspense>);
}

function GroupsPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [domainId, setDomainId] = useState(searchParams.get("domainId") || "");
  const [domains, setDomains] = useState<DomainOption[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const isAdmin = session?.user?.role === "super_admin" || session?.user?.role === "admin";

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/domains").then((r) => r.json()).then((data) => {
        if (Array.isArray(data)) {
          setDomains(data);
          if (!domainId && data.length > 0) setDomainId(data[0].id);
        }
      }).finally(() => setLoading(false));
    }
  }, [status]);

  const fetchGroups = () => {
    if (!domainId) return;
    fetch(`/api/groups?domainId=${domainId}`).then((r) => r.json()).then((data) => { if (Array.isArray(data)) setGroups(data); });
  };

  useEffect(() => { if (domainId) fetchGroups(); }, [domainId]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await fetch("/api/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName, color: newColor, domainId }) });
    setNewName(""); fetchGroups();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir grupo "${name}"?`)) return;
    await fetch(`/api/groups/${id}`, { method: "DELETE" });
    fetchGroups();
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    await fetch(`/api/groups/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editName }) });
    setEditingId(null); fetchGroups();
  };

  const handleChangeColor = async (id: string, color: string) => {
    await fetch(`/api/groups/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ color }) });
    fetchGroups();
  };

  if (loading) return (<div className="flex min-h-screen"><Sidebar /><main className="flex-1 ml-64 p-8"><div className="animate-pulse"><div className="h-8 bg-gray-200 rounded w-48" /></div></main></div>);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#1a1a2e] flex items-center gap-2"><SwatchIcon className="w-7 h-7" /> Gerenciar Grupos</h1>
          <p className="text-gray-500 mt-1">{groups.length}/50 grupos criados</p>
        </div>

        {/* Domain selector */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex items-center gap-3">
            <GlobeAltIcon className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-500">Dominio:</span>
            <select value={domainId} onChange={(e) => setDomainId(e.target.value)} className="text-sm font-medium text-[#1a1a2e] border-2 border-gray-200 rounded-lg px-3 py-1.5 focus:border-[#3B82F6] focus:outline-none">
              {domains.map((d) => (<option key={d.id} value={d.id}>{d.name} - {d.url}</option>))}
            </select>
          </div>
        </div>

        {/* Create group */}
        {isAdmin && domainId && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
            <h2 className="text-sm font-semibold text-[#1a1a2e] mb-4">Criar Novo Grupo</h2>
            <div className="space-y-3">
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do grupo" className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-[#3B82F6] focus:outline-none text-sm text-[#1a1a2e]" onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5 flex-wrap">
                  {COLORS.slice(0, 20).map((c) => (
                    <button key={c} onClick={() => setNewColor(c)} className={`w-7 h-7 rounded-full border-2 transition-transform ${newColor === c ? "border-[#1a1a2e] scale-110" : "border-transparent hover:scale-105"}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
                <button onClick={handleCreate} disabled={!newName.trim() || groups.length >= 50} className="px-5 py-2.5 bg-[#3B82F6] text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1 shrink-0 ml-4">
                  <PlusIcon className="w-4 h-4" /> Criar Grupo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Groups list */}
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="h-2" style={{ backgroundColor: group.color }} />
              <div className="px-6 py-4">
                {/* Row 1: Info */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                  {editingId === group.id ? (
                    <div className="flex items-center gap-2">
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="text-base font-semibold text-[#1a1a2e] border-b-2 border-[#3B82F6] focus:outline-none bg-transparent" autoFocus onKeyDown={(e) => e.key === "Enter" && handleRename(group.id)} />
                      <button onClick={() => handleRename(group.id)} className="p-1 bg-[#14A44D] text-white rounded"><CheckIcon className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <h3 className="text-base font-semibold text-[#1a1a2e]">{group.name}</h3>
                  )}
                  <span className="text-xs text-gray-400">{group.pages.length} paginas</span>
                </div>

                {/* Pages tags */}
                {group.pages.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {group.pages.map((m) => (
                      <span key={m.page.id} className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 truncate max-w-[200px]">{m.page.title || m.page.url}</span>
                    ))}
                  </div>
                )}

                {/* Row 2: Buttons */}
                {isAdmin && (
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex gap-1.5 flex-wrap">
                      {COLORS.slice(0, 12).map((c) => (
                        <button key={c} onClick={() => handleChangeColor(group.id, c)} className={`w-5 h-5 rounded-full ${group.color === c ? "ring-2 ring-[#1a1a2e] ring-offset-1" : "hover:scale-110"} transition-transform`} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setEditingId(group.id); setEditName(group.name); }} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 flex items-center gap-1"><PencilIcon className="w-3.5 h-3.5" /> Renomear</button>
                      <button onClick={() => handleDelete(group.id, group.name)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#DC4C64] hover:bg-[#DC4C64]/10 flex items-center gap-1"><TrashIcon className="w-3.5 h-3.5" /> Excluir</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {groups.length === 0 && domainId && (
            <div className="bg-gray-50 rounded-2xl p-12 text-center">
              <SwatchIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400">Nenhum grupo criado para este dominio.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
