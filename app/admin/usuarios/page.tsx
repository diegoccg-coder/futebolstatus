"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useAppData } from "@/lib/useData";
import type { UserPublic, UserRole } from "@/lib/types";

export default function AdminUsuariosPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { data: appData } = useAppData();
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("jogador");
  const [playerId, setPlayerId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  async function loadUsers() {
    const r = await fetch("/api/users");
    if (r.status === 403) {
      router.replace("/painel");
      return;
    }
    if (!r.ok) return;
    setUsers(await r.json());
    setLoading(false);
  }

  useEffect(() => {
    if (session?.user?.role === "admin") {
      loadUsers();
    } else if (status === "authenticated") {
      router.replace("/painel");
    }
  }, [session, status, router]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          password,
          role,
          playerId: playerId || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        alert(j.error || "Erro");
        return;
      }
      setEmail("");
      setName("");
      setPassword("");
      setPlayerId("");
      await loadUsers();
    } finally {
      setSaving(false);
    }
  }

  async function removeUser(id: string) {
    if (!confirm("Excluir este usuário?")) return;
    const r = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json();
      alert(j.error || "Erro");
      return;
    }
    await loadUsers();
  }

  if (status === "loading" || loading) {
    return <p className="text-emerald-200/80">Carregando…</p>;
  }

  if (session?.user?.role !== "admin") {
    return null;
  }

  const players = appData?.players ?? [];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Usuários</h1>
        <p className="mt-1 text-sm text-emerald-100/75">
          Crie logins para jogadores (perfil leitura + painel) ou outros administradores.
        </p>
      </div>

      <form
        onSubmit={createUser}
        className="space-y-4 rounded-2xl border border-emerald-800/60 bg-emerald-950/50 p-6"
      >
        <h2 className="font-display text-lg font-semibold text-amber-200">Novo usuário</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-emerald-300/90">Email (login)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
              required
            />
          </div>
          <div>
            <label className="text-xs text-emerald-300/90">Nome exibido</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
              required
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-emerald-300/90">Senha (mín. 4 caracteres)</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full max-w-sm rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
            required
            minLength={4}
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={role === "jogador"}
              onChange={() => setRole("jogador")}
              className="text-amber-500"
            />
            Jogador
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={role === "admin"}
              onChange={() => setRole("admin")}
              className="text-amber-500"
            />
            Administrador
          </label>
        </div>
        <div>
          <label className="text-xs text-emerald-300/90">
            Vincular a jogador do grupo (opcional)
          </label>
          <select
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            className="mt-1 w-full max-w-md rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
          >
            <option value="">Nenhum</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-amber-500 px-4 py-2 font-medium text-pitch-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {saving ? "Criando…" : "Criar usuário"}
        </button>
      </form>

      <div>
        <h2 className="font-display text-lg font-semibold text-amber-200">Cadastrados</h2>
        <ul className="mt-3 divide-y divide-emerald-900/60 rounded-xl border border-emerald-800/60">
          {users.map((u) => (
            <li
              key={u.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-white">{u.name}</p>
                <p className="text-sm text-emerald-300/85">
                  {u.email} · {u.role === "admin" ? "Admin" : "Jogador"}
                </p>
              </div>
              {u.id !== session?.user?.id && (
                <button
                  type="button"
                  onClick={() => removeUser(u.id)}
                  className="text-sm text-red-400/90 hover:text-red-300"
                >
                  Excluir
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
