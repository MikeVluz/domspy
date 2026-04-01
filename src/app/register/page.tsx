"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldCheckIcon,
  UserPlusIcon,
  EnvelopeIcon,
  LockClosedIcon,
  UserIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao criar conta");
      } else {
        setSuccess(data.message);
        setName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#14A44D] flex items-center justify-center mx-auto mb-4 shadow-2xl">
            <ShieldCheckIcon className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            DomSpy
          </h1>
          <p className="text-white/50 mt-1">Criar Conta</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-[#1a1a2e] mb-6 flex items-center gap-2">
            <UserPlusIcon className="w-6 h-6" />
            Registrar
          </h2>

          {error && (
            <div className="flex items-center gap-2 bg-[#DC4C64]/10 text-[#DC4C64] px-4 py-3 rounded-xl mb-4 text-sm font-medium">
              <ExclamationCircleIcon className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 bg-[#14A44D]/10 text-[#14A44D] px-4 py-3 rounded-xl mb-4 text-sm font-medium">
              <CheckCircleIcon className="w-4 h-4 shrink-0" />
              {success}
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  Nome
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#3B82F6] focus:outline-none transition-colors text-[#1a1a2e]"
                    placeholder="Seu nome"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#3B82F6] focus:outline-none transition-colors text-[#1a1a2e]"
                    placeholder="seu@email.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#3B82F6] focus:outline-none transition-colors text-[#1a1a2e]"
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#3B82F6] focus:outline-none transition-colors text-[#1a1a2e]"
                    placeholder="Repita a senha"
                    minLength={6}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#14A44D] to-[#0f8a3f] text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg shadow-green-500/25"
              >
                {loading ? "Criando conta..." : "Criar Conta"}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-gray-500 mt-6">
            Já tem conta?{" "}
            <Link
              href="/login"
              className="text-[#3B82F6] font-medium hover:underline"
            >
              Entrar
            </Link>
          </p>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          DomSpy &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
