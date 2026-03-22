"use client";

import { useState } from "react";
import { Stars } from "@/components/Stars";
import { useAppData } from "@/lib/useData";
import type { Player } from "@/lib/types";

export default function JogadoresPage() {
  const { data, loading, error, refresh } = useAppData();
  const [name, setName] = useState("");
  const [stars, setStars] = useState(3);
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const r = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), stars }),
      });
      if (!r.ok) {
        const j = await r.json();
        alert(j.error || "Erro ao salvar");
        return;
      }
      setName("");
      setStars(3);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function updateStars(p: Player, n: number) {
    await fetch(`/api/players/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stars: n }),
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

  const groups = [1, 2, 3, 4, 5].map((n) => ({
    stars: n,
    players: sorted.filter((p) => p.stars === n),
  }));

  if (loading) {
    return <p className="text-emerald-200/80">Carregando…</p>;
  }
  if (error || !data) {
    return <p className="text-red-300">{error ?? "Erro"}</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Jogadores</h1>
        <p className="mt-1 text-sm text-emerald-100/75">
          Você define o nível do jogador em estrelas. Conforme a estrela muda, ele é
          automaticamente distribuído nos grupos (1 a 5).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <form
            onSubmit={add}
            className="flex flex-col gap-4 rounded-2xl border border-emerald-800/60 bg-emerald-950/50 p-6 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label
                htmlFor="nome"
                className="block text-sm font-medium text-emerald-200/90"
              >
                Nome
              </label>
              <input
                id="nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white placeholder-emerald-700 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                placeholder="Ex.: João"
              />
            </div>
            <div>
              <span className="block text-sm font-medium text-emerald-200/90">Nível</span>
              <div className="mt-2">
                <Stars value={stars} onChange={setStars} />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="rounded-xl bg-amber-500 px-5 py-2.5 font-medium text-pitch-950 transition hover:bg-amber-400 disabled:opacity-50"
            >
              {saving ? "Salvando…" : "Adicionar"}
            </button>
          </form>

          {sorted.length === 0 ? (
            <p className="text-emerald-300/70">Nenhum jogador cadastrado ainda.</p>
          ) : (
            <ul className="divide-y divide-emerald-900/80 rounded-2xl border border-emerald-800/60 bg-emerald-950/30">
              {sorted.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-medium text-white">{p.name}</span>
                  <div className="flex flex-wrap items-center gap-4">
                    <Stars value={p.stars} onChange={(n) => updateStars(p, n)} />
                    <button
                      type="button"
                      onClick={() => removePlayer(p)}
                      className="text-sm text-red-400/90 hover:text-red-300"
                    >
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-amber-200">
            Grupos por estrela
          </h2>
          <p className="text-sm text-emerald-100/75">
            Alterando o número de estrelas à esquerda, os jogadores “andam” pelos grupos aqui
            automaticamente.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {groups.map((g) => (
              <div
                key={g.stars}
                className="rounded-2xl border border-emerald-800/60 bg-emerald-950/40 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="font-display text-base font-semibold text-amber-200">
                    {g.stars} estrela{g.stars > 1 ? "s" : ""}
                  </div>
                  <div className="text-xs text-emerald-300/80">{g.players.length}</div>
                </div>

                {g.players.length === 0 ? (
                  <p className="mt-3 text-xs text-emerald-500/80">Nenhum jogador</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {g.players.map((p) => (
                      <li key={p.id} className="flex items-center justify-between">
                        <span className="text-sm text-white/95">{p.name}</span>
                        <Stars value={p.stars} readOnly />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
