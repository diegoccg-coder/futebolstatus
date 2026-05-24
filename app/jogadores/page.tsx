"use client";

import { useState } from "react";
import { Stars } from "@/components/Stars";
import { useAppData } from "@/lib/useData";
import type { Player, PlayerCategory } from "@/lib/types";

export default function JogadoresPage() {
  const { data, loading, error, refresh, patchPlayer } = useAppData();
  const [name, setName] = useState("");
  const [stars, setStars] = useState(3);
  const [category, setCategory] = useState<PlayerCategory>("campo");
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const r = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), stars, category }),
      });
      if (!r.ok) {
        const j = await r.json();
        alert(j.error || "Erro ao salvar");
        return;
      }
      setName("");
      setStars(3);
      setCategory("campo");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function updateStars(p: Player, n: number) {
    if (n === p.stars) return;
    const prevStars = p.stars;
    patchPlayer({ ...p, stars: n });
    try {
      const r = await fetch(`/api/players/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stars: n }),
      });
      if (!r.ok) {
        patchPlayer({ ...p, stars: prevStars });
        return;
      }
      const updated = (await r.json()) as Player;
      patchPlayer(updated);
    } catch {
      patchPlayer({ ...p, stars: prevStars });
    }
  }

  async function updateCategory(p: Player, next: PlayerCategory) {
    await fetch(`/api/players/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: next }),
    });
    await refresh();
  }

  async function removePlayer(p: Player) {
    if (!confirm(`Remover ${p.name}?`)) return;
    await fetch(`/api/players/${p.id}`, { method: "DELETE" });
    await refresh();
  }

  const sorted = [...(data?.players ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR")
  );
  const linha = sorted.filter((p) => p.category !== "goleiro");
  const goleiros = sorted.filter((p) => p.category === "goleiro");

  const groups = [1, 2, 3, 4, 5].map((n) => ({
    stars: n,
    players: linha.filter((p) => p.stars === n),
  }));

  if (loading) {
    return <p className="text-emerald-200/80">Carregando…</p>;
  }
  if (error || !data) {
    return <p className="text-red-300">{error ?? "Erro"}</p>;
  }

  function renderPlayerCard(p: Player) {
    return (
      <li
        key={p.id}
        className="rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-2 py-1.5"
      >
        <div className="flex items-start justify-between gap-1">
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-white">{p.name}</span>
          <button
            type="button"
            onClick={() => removePlayer(p)}
            className="shrink-0 text-[10px] text-red-400/90 hover:text-red-300"
          >
            ×
          </button>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <select
            value={p.category}
            onChange={(e) => void updateCategory(p, e.target.value as PlayerCategory)}
            className="rounded border border-emerald-800 bg-pitch-950 px-1 py-0.5 text-[10px] text-emerald-200"
          >
            <option value="campo">Linha</option>
            <option value="goleiro">GOL</option>
          </select>
          <Stars value={p.stars} onChange={(n) => updateStars(p, n)} />
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-white">Jogadores</h1>

      <section className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-3 space-y-2">
        <h2 className="text-sm font-semibold text-amber-200">1. Novo jogador</h2>
        <form onSubmit={add} className="space-y-2">
          <input
            id="nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-sm text-white placeholder-emerald-700"
            placeholder="Nome"
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-emerald-200/90">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="cat"
                checked={category === "campo"}
                onChange={() => setCategory("campo")}
                className="text-amber-500"
              />
              Linha
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="cat"
                checked={category === "goleiro"}
                onChange={() => setCategory("goleiro")}
                className="text-amber-500"
              />
              Goleiro
            </label>
            <span className="text-emerald-400/90">Nível</span>
            <Stars value={stars} onChange={setStars} />
          </div>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-pitch-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Adicionar"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-amber-200">2. Jogadores de linha</h2>
        {linha.length === 0 ? (
          <p className="mt-1 text-xs text-emerald-300/70">Nenhum jogador de linha.</p>
        ) : (
          <ul className="mt-2 grid grid-cols-2 gap-1.5">{linha.map(renderPlayerCard)}</ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-amber-200">3. Goleiros</h2>
        {goleiros.length === 0 ? (
          <p className="mt-1 text-xs text-emerald-300/70">Nenhum goleiro.</p>
        ) : (
          <ul className="mt-2 grid grid-cols-2 gap-1.5">{goleiros.map(renderPlayerCard)}</ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-amber-200">4. Grupos por estrela</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {groups.map((g) => (
            <div
              key={g.stars}
              className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-2"
            >
              <p className="text-xs font-semibold text-amber-200">
                {g.stars}★ ({g.players.length})
              </p>
              {g.players.length === 0 ? (
                <p className="mt-1 text-[10px] text-emerald-500/80">—</p>
              ) : (
                <ul className="mt-1 space-y-0.5">
                  {g.players.map((p) => (
                    <li key={p.id} className="truncate text-xs text-white/95">
                      {p.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
