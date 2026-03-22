"use client";

import { useEffect, useMemo, useState } from "react";
import { Stars } from "@/components/Stars";
import { teamsByRotation } from "@/lib/matchUi";
import { useAppData } from "@/lib/useData";
import type { Player } from "@/lib/types";

type DrawSlot = {
  index: number;
  playerIds: string[];
  players: Player[];
  sumStars: number;
  rotationOrder: number;
};

type PeladaMode = "dupla" | "racha";

export default function SorteioPage() {
  const { data, loading, error, refresh } = useAppData();
  const [agendamentoId, setAgendamentoId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<PeladaMode>("racha");
  const [rachaCount, setRachaCount] = useState<3 | 4>(4);
  const [durationMinutes, setDurationMinutes] = useState(8);
  const [teamNames, setTeamNames] = useState<string[]>([
    "Amarelo",
    "Laranja",
    "Verde",
    "Preto",
  ]);
  const [result, setResult] = useState<{
    teamCount: number;
    teams: DrawSlot[];
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const teamCount = mode === "dupla" ? 2 : rachaCount;

  useEffect(() => {
    setTeamNames((prev) => {
      const labels =
        teamCount === 2
          ? ["Amarelo", "Laranja"]
          : teamCount === 3
            ? ["Amarelo", "Laranja", "Verde"]
            : ["Amarelo", "Laranja", "Verde", "Preto"];
      return labels.map((d, i) => prev[i] ?? d);
    });
  }, [teamCount]);

  function setTeamName(i: number, v: string) {
    setTeamNames((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function selectAll() {
    if (!data) return;
    setSelected(new Set(data.players.map((p) => p.id)));
  }

  function clearSel() {
    setSelected(new Set());
  }

  async function sortear() {
    if (!data || selected.size < teamCount) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch("/api/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerIds: Array.from(selected),
          teamCount,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        alert(j.error || "Erro no sorteio");
        return;
      }
      setResult({
        teamCount: j.teamCount as number,
        teams: j.teams as DrawSlot[],
      });
    } finally {
      setBusy(false);
    }
  }

  async function salvarRascunho() {
    if (!result) return;
    if (!agendamentoId) {
      alert("Selecione o racha para vincular o sorteio.");
      return;
    }
    const byIndex = [...result.teams].sort((a, b) => a.index - b.index);
    const teams = byIndex.map((t) => ({
      name: teamNames[t.index] ?? `Time ${t.index + 1}`,
      playerIds: t.playerIds,
      rotationOrder: t.rotationOrder,
    }));
    const r = await fetch("/api/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agendamentoId,
        format: mode === "dupla" ? "dupla" : "racha",
        teamCount: result.teamCount,
        durationMinutes,
        teams,
      }),
    });
    if (!r.ok) {
      const j = await r.json();
      alert(j.error || "Erro ao salvar");
      return;
    }
    await refresh();
    alert("Rascunho salvo. Na página Jogos você pode criar a partida a partir dele.");
  }

  const filaOrdenada = useMemo(() => {
    if (!result) return [];
    const slots = result.teams.map((t) => ({
      ...t,
      label: teamNames[t.index] ?? `Time ${t.index + 1}`,
    }));
    return [...slots].sort((a, b) => a.rotationOrder - b.rotationOrder);
  }, [result, teamNames]);

  if (loading) return <p className="text-emerald-200/80">Carregando…</p>;
  if (error || !data) return <p className="text-red-300">{error ?? "Erro"}</p>;

  const players = [...data.players].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR")
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Sorteio de times</h1>
        <p className="mt-1 text-sm text-emerald-100/75">
          Escolha se a pelada é só dois times em campo ou <strong>racha</strong> (3 ou 4
          times). No racha, o sorteio define os elencos <em>e</em> a ordem da fila: quem
          entra primeiro, segundo… Partidas costumam ser de poucos minutos (ex.: 8).
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-800/60 bg-emerald-950/40 p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <label className="text-sm text-emerald-200/90">Racha (agenda)</label>
            <select
              value={agendamentoId}
              onChange={(e) => setAgendamentoId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
            >
              <option value="">Selecione o racha para vincular o sorteio</option>
              {[...data.agendamentos]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR")}
                    {a.time ? ` às ${a.time}` : ""}
                    {a.title ? ` · ${a.title}` : ""}
                    {a.campo ? ` · Campo ${a.campo}` : ""}
                  </option>
                ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => void salvarRascunho()}
            disabled={!result || !agendamentoId || busy}
            className="shrink-0 rounded-xl bg-amber-500 px-5 py-2.5 font-medium text-pitch-950 hover:bg-amber-400 disabled:opacity-50 disabled:hover:bg-amber-500"
          >
            Vincular sorteio ao racha
          </button>
        </div>
        <p className="text-xs text-emerald-500/90">
          Depois de <strong>Sortear times</strong>, clique em <strong>Vincular sorteio ao racha</strong>{" "}
          (este botão ou o mesmo abaixo dos times). O racha precisa estar selecionado.
        </p>
        <p className="text-sm font-medium text-amber-200/95">Formato</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-800/80 px-4 py-3 has-[:checked]:border-amber-500/50 has-[:checked]:bg-amber-950/20">
            <input
              type="radio"
              name="mode"
              checked={mode === "dupla"}
              onChange={() => setMode("dupla")}
              className="text-amber-500"
            />
            <span className="text-sm text-emerald-50">Dois times (jogo único)</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-800/80 px-4 py-3 has-[:checked]:border-amber-500/50 has-[:checked]:bg-amber-950/20">
            <input
              type="radio"
              name="mode"
              checked={mode === "racha"}
              onChange={() => setMode("racha")}
              className="text-amber-500"
            />
            <span className="text-sm text-emerald-50">Racha (rotação no campo)</span>
          </label>
        </div>
        {mode === "racha" && (
          <div className="flex flex-wrap gap-4 pt-2">
            <span className="text-sm text-emerald-200/90">Quantidade de times:</span>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="rachaN"
                checked={rachaCount === 3}
                onChange={() => setRachaCount(3)}
                className="text-amber-500"
              />
              3 times
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="rachaN"
                checked={rachaCount === 4}
                onChange={() => setRachaCount(4)}
                className="text-amber-500"
              />
              4 times
            </label>
          </div>
        )}
        <div>
          <label className="text-sm text-emerald-200/90">Duração de cada partida no campo (min)</label>
          <input
            type="number"
            min={1}
            max={60}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value) || 8)}
            className="mt-1 w-24 rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={selectAll}
          className="rounded-lg border border-emerald-700 px-3 py-1.5 text-sm text-emerald-100 hover:bg-emerald-900/50"
        >
          Marcar todos
        </button>
        <button
          type="button"
          onClick={clearSel}
          className="rounded-lg border border-emerald-700 px-3 py-1.5 text-sm text-emerald-100 hover:bg-emerald-900/50"
        >
          Limpar
        </button>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {players.map((p) => (
          <li key={p.id}>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
                selected.has(p.id)
                  ? "border-amber-500/50 bg-amber-950/30"
                  : "border-emerald-800/60 bg-emerald-950/30 hover:border-emerald-700"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => toggle(p.id)}
                className="h-4 w-4 rounded border-emerald-600 text-amber-500"
              />
              <span className="flex-1 font-medium text-white">{p.name}</span>
              <Stars value={p.stars} readOnly />
            </label>
          </li>
        ))}
      </ul>

      {players.length === 0 && (
        <p className="text-emerald-300/70">Cadastre jogadores primeiro.</p>
      )}

      <div className="space-y-3">
        <p className="text-sm text-emerald-200/90">Nomes dos times (escalação)</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: teamCount }, (_, i) => (
            <div key={i}>
              <label className="text-xs text-emerald-400/90">Time {i + 1}</label>
              <input
                value={teamNames[i] ?? ""}
                onChange={(e) => setTeamName(i, e.target.value)}
                className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={busy || selected.size < teamCount}
          onClick={sortear}
          className="rounded-xl bg-amber-500 px-6 py-2.5 font-medium text-pitch-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {busy ? "Sorteando…" : "Sortear times e ordem da fila"}
        </button>
        {selected.size < teamCount && (
          <p className="text-xs text-amber-200/80">
            Selecione pelo menos {teamCount} jogadores.
          </p>
        )}
      </div>

      {result && mode === "racha" && filaOrdenada.length > 0 && (
        <div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 p-5">
          <h2 className="font-display text-lg font-semibold text-amber-200">
            Ordem da fila (sorteada)
          </h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-emerald-100/90">
            {filaOrdenada.map((slot) => (
              <li key={slot.index}>
                <strong>{slot.label}</strong> — soma das estrelas: {slot.sumStars}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-emerald-200/85 leading-relaxed">
            <strong>Como funciona o racha:</strong> os <strong>dois primeiros</strong> desta
            fila começam em campo. A cada partida de ~{durationMinutes} min,{" "}
            <strong>quem ganha fica</strong>; <strong>quem perde sai</strong> e entra o{" "}
            <strong>próximo time da fila</strong> (na ordem acima, depois do 2º vem o 3º, e
            assim por diante, voltando ao início quando necessário).
          </p>
        </div>
      )}

      {result && (
        <div
          className={`grid gap-6 ${
            result.teamCount <= 2 ? "md:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-2"
          }`}
        >
          {[...result.teams]
            .sort((a, b) => a.index - b.index)
            .map((slot) => (
              <div
                key={slot.index}
                className="rounded-2xl border border-emerald-800/60 bg-emerald-950/40 p-5"
              >
                <h2 className="font-display text-lg font-semibold text-amber-200">
                  {teamNames[slot.index] ?? `Time ${slot.index + 1}`}
                </h2>
                <p className="text-sm text-emerald-300/80">
                  Soma das estrelas: {slot.sumStars} · Posição na fila: {slot.rotationOrder}º
                </p>
                <ul className="mt-3 space-y-2">
                  {slot.players.map((p: Player) => (
                    <li key={p.id} className="flex justify-between text-sm">
                      <span>{p.name}</span>
                      <Stars value={p.stars} readOnly />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      )}

      {result && (
        <button
          type="button"
          onClick={() => void salvarRascunho()}
          disabled={!agendamentoId || busy}
          className="rounded-xl bg-amber-500 px-6 py-2.5 font-medium text-pitch-950 hover:bg-amber-400 disabled:opacity-50"
        >
          Vincular sorteio ao racha (confirmar)
        </button>
      )}

      {data.lastDraft && (
        <p className="text-sm text-emerald-400/80">
          Último sorteio salvo:{" "}
          {new Date(data.lastDraft.createdAt).toLocaleString("pt-BR")} —{" "}
          {data.lastDraft.teamCount} times
          {data.lastDraft.format === "racha" ? " (racha)" : ""}, partidas de{" "}
          {data.lastDraft.durationMinutes} min. Times:{" "}
          {teamsByRotation(data.lastDraft.teams)
            .map((t) => t.name)
            .join(" → ")}
          {data.lastDraft.format === "racha" && " (ordem da fila)"}.
          {data.lastDraft.agendamentoId
            ? " (vinculado a um racha — também na página Jogos)."
            : ""}
        </p>
      )}
    </div>
  );
}
