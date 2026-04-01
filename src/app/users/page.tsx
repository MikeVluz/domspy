"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import {
  UsersIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
}

const ROLE_BADGES: Record<string, { label: string; color: string }> = {
  super_admin: { label: "Super Admin", color: "bg-[#8B5CF6]/10 text-[#8B5CF6]" },
  admin: { label: "Admin", color: "bg-[#3B82F6]/10 text-[#3B82F6]" },
  viewer: { label: "Viewer", color: "bg-gray-100 text-gray-600" },
};

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  active: { label: "Ativo", color: "bg-[#14A44D]/10 text-[#14A44D]" },
  pending: { label: "Pendente", color: "bg-[#E4A11B]/10 text-[#E4A11B]" },
  disabled: { label: "Desativado", color: "bg-[#DC4C64]/10 text-[#DC4C64]" },
};

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "authenticated") {
      if (session?.user?.role !== "super_admin") {
        router.push("/");
        return;
      }
      fetchUsers();
    }
  }, [status, session, router]);

  const fetchUsers = () => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setUsers(data); })
      .finally(() => setLoading(false));
  };

  const handleUpdateUser = async (
    userId: string,
    data: { role?: string; status?: string }
  ) => {
    await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    fetchUsers();
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (!confirm(`Excluir o usuário "${name}"? Esta ação não pode ser desfeita.`)) return;
    await fetch(`/api/users/${userId}`, { method: "DELETE" });
    fetchUsers();
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-64 p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-48" />
            <div className="h-64 bg-gray-200 rounded-2xl" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#1a1a2e] flex items-center gap-2">
            <ShieldCheckIcon className="w-7 h-7" />
            Gerenciar Usuários
          </h1>
          <p className="text-gray-500 mt-1">
            Aprovação, permissões e gestão de contas
          </p>
        </div>

        {/* Pending users alert */}
        {users.filter((u) => u.status === "pending").length > 0 && (
          <div className="bg-[#E4A11B]/10 border border-[#E4A11B]/20 rounded-2xl p-4 mb-6 flex items-center gap-3">
            <UsersIcon className="w-6 h-6 text-[#E4A11B]" />
            <span className="text-sm font-medium text-[#E4A11B]">
              {users.filter((u) => u.status === "pending").length} usuário(s)
              aguardando aprovação
            </span>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-[#1a1a2e]">
              Usuários ({users.length})
            </h2>
          </div>

          <div className="divide-y divide-gray-100">
            {users.map((user) => {
              const roleBadge = ROLE_BADGES[user.role] || ROLE_BADGES.viewer;
              const statusBadge = STATUS_BADGES[user.status] || STATUS_BADGES.active;
              const isCurrentUser = user.id === session?.user?.id;

              return (
                <div
                  key={user.id}
                  className="px-6 py-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-[#1a1a2e] truncate">
                        {user.name}
                        {isCurrentUser && (
                          <span className="text-xs text-gray-400 ml-2">
                            (você)
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400 truncate">
                        {user.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Role badge */}
                    <select
                      value={user.role}
                      onChange={(e) =>
                        handleUpdateUser(user.id, { role: e.target.value })
                      }
                      disabled={isCurrentUser}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg border-0 cursor-pointer ${roleBadge.color} ${
                        isCurrentUser ? "opacity-50" : ""
                      }`}
                    >
                      <option value="super_admin">Super Admin</option>
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>

                    {/* Status badge / Approve button */}
                    {user.status === "pending" ? (
                      <button
                        onClick={() =>
                          handleUpdateUser(user.id, { status: "active" })
                        }
                        className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#14A44D] text-white hover:opacity-90 transition-opacity"
                      >
                        <CheckCircleIcon className="w-4 h-4" />
                        Aprovar
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          handleUpdateUser(user.id, {
                            status:
                              user.status === "active" ? "disabled" : "active",
                          })
                        }
                        disabled={isCurrentUser}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg ${statusBadge.color} ${
                          isCurrentUser ? "opacity-50" : "cursor-pointer"
                        }`}
                      >
                        {user.status === "active" ? "Ativo" : "Desativado"}
                      </button>
                    )}

                    {/* Delete */}
                    {!isCurrentUser && (
                      <button
                        onClick={() => handleDeleteUser(user.id, user.name)}
                        className="p-2 rounded-lg text-gray-400 hover:text-[#DC4C64] hover:bg-[#DC4C64]/10 transition-colors"
                        title="Excluir usuário"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
