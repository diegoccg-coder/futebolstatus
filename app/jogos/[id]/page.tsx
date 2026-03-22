"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { MatchTimers } from "@/components/MatchTimers";
import { Stars } from "@/components/Stars";
import type { AppDataClient } from "@/lib/client-types";
import { matchScoreLine, matchWinnerDisplayName, teamsByRotation } from "@/lib/matchUi";
import type { Goal, Match, Player } from "@/lib/types";

export default function JogoDetalhePage() {
  const params = useParams();
  const id = params.id as string;
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [data, setData] = useState<AppDataClient | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [scorerId, setScorerId] = useState("");
  const [assistId, setAssistId] = useState("");
  const [yellowPick, setYellowPick] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/data", { cache: "no-store" });
    if (r.status === 401) {
      await signOut({ callbackUrl: "/login" });
      return;
    }
    const j = (await r.json()) as AppDataClient;
    setData(j);
    const m = j.matches.find((x) => x.id === id) ?? null;
    setMatch(m);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const playersMap = new Map<string, Player>();
  data?.players.forEach((p) => playersMap.set(p.id, p));

  function allInMatch(): Player[] {
    if (!match) return [];
    const ids = new Set<string>();
    const field = Array.isArray(match.fieldTeamIndexes) ? match.fieldTeamIndexes : [];
    const fieldSet = new Set(field);
    for (const [idx, t] of match.teams.entries()) {
      if (fieldSet.size > 0 && !fieldSet.has(idx)) continue;
      for (const pid of t.playerIds) ids.add(pid);
    }
    return data?.players.filter((p) => ids.has(p.id)) ?? [];
  }

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    const r = await fetch(`/api/matches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const j = await r.json();
      alert(j.error || "Erro");
      return false;
    }
    await load();
    return true;
  }

  async function setChampion(idx: number | null) {
    await patch({ championTeamIndex: idx });
  }

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!scorerId) return;
    await patch({
      addGoal: {
        scorerId,
        assistId: assistId || null,
      },
    });
    setScorerId("");
    setAssistId("");
  }

  async function removeGoal(g: Goal) {
    await patch({ removeGoalId: g.id });
  }

  if (loading) return <p className="text-emerald-200/80">Carregando…</p>;
  if (!data || !match) {
    return (
      <p className="text-red-300">
        Jogo não encontrado.{" "}
        <Link href={isAdmin ? "/jogos" : "/resultados"} className="underline">
          Voltar
        </Link>
      </p>
    );
  }

  const fila = teamsByRotation(match.teams);

  const backHref = isAdmin ? "/jogos" : "/resultados";
  const field = Array.isArray(match.fieldTeamIndexes)
    ? match.fieldTeamIndexes.filter((i) => i >= 0 && i < match.teams.length).slice(0, 2)
    : [0, 1];
  const fieldA = field[0] ?? 0;
  const fieldB = field[1] ?? 1;
  const scoreLine = matchScoreLine(match);

  return (
    <div className="space-y-8">
      <div>
        <Link href={backHref} className="text-sm text-amber-400/90 hover:underline">
          {isAdmin ? "← Jogos" : "← Resultados"}
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-white">
          {match.teams[fieldA]?.name ?? "Time 1"} × {match.teams[fieldB]?.name ?? "Time 2"}
          {scoreLine && <span className="ml-2 text-amber-200/95">{scoreLine}</span>}
        </h1>
        <p className="mt-1 text-sm text-emerald-300/85">
          {new Date(match.date + "T12:00:00").toLocaleDateString("pt-BR")}
          {match.weekLabel ? ` · ${match.weekLabel}` : ""}
          {match.teamCount > 2 ? ` · Racha (${match.teamCount} times)` : ""}
          {` · Partidas de ${match.durationMinutes} min`}
        </p>
        {matchWinnerDisplayName(match) && (
          <p className="mt-2 text-sm text-amber-200/90">
            Vencedor: <strong>{matchWinnerDisplayName(match)}</strong>
          </p>
        )}
      </div>

      {isAdmin && (
        <label className="block max-w-xs">
          <span className="text-sm text-emerald-200/90">
            Duração de cada partida no campo (min)
          </span>
          <input
            type="number"
            min={1}
            max={60}
            defaultValue={match.durationMinutes}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (v > 0 && v !== match.durationMinutes) patch({ durationMinutes: v });
            }}
            className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
          />
        </label>
      )}

      <MatchTimers
        matchId={match.id}
        durationMinutes={match.durationMinutes}
        playersOnField={allInMatch()}
        canControl={isAdmin}
      />

      {match.teamCount > 2 && (
        <div className="rounded-2xl border border-amber-900/35 bg-amber-950/15 p-5">
          <h2 className="font-display text-base font-semibold text-amber-200">
            Ordem da fila (rotação)
          </h2>
          <p className="mt-2 text-sm text-emerald-100/85 leading-relaxed">
            Os <strong>dois primeiros</strong> desta lista começam em campo.{" "}
            <strong>Quem ganha fica</strong>; <strong>quem perde sai</strong> e entra o próximo
            da fila (~{match.durationMinutes} min por partida).
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-emerald-200/90">
            {fila.map((t) => (
              <li key={`${t.name}-${t.rotationOrder}`}>
                <strong>{t.name}</strong>
              </li>
            ))}
          </ol>
        </div>
      )}

      <section>
        <h2 className="font-display text-base font-semibold text-amber-200/95">
          Times em campo
        </h2>
        <p className="mt-1 text-xs text-emerald-500/90">
          Apenas os dois times desta partida. Para mudar elencos ou times de apoio, use a página
          Jogos antes de registrar o jogo.
        </p>
        {isAdmin ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {[fieldA, fieldB].map((idx) => {
              const t = match.teams[idx];
              if (!t) return null;
              return (
                <label key={idx} className="block">
                  <span className="text-sm text-emerald-200/90">
                    Nome ({idx === fieldA ? "campo A" : "campo B"})
                    {match.teamCount > 2 ? ` · fila ${t.rotationOrder}º` : ""}
                  </span>
                  <input
                    defaultValue={t.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== t.name) {
                        const teams = match.teams.map((x, i) =>
                          i === idx ? { ...x, name: v } : x
                        );
                        void patch({ teams });
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
                  />
                </label>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 text-sm text-emerald-200/85">
            {[fieldA, fieldB].map((idx) => {
              const t = match.teams[idx];
              if (!t) return null;
              return (
                <p key={idx}>
                  <strong className="text-white">{t.name}</strong>
                  {match.teamCount > 2 ? ` · fila ${t.rotationOrder}º` : ""}
                </p>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-amber-200">Escalação</h2>
        <p className="mt-1 text-xs text-emerald-500/90">
          Jogadores dos dois times em campo nesta partida.
        </p>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {[fieldA, fieldB].map((idx) => {
            const t = match.teams[idx];
            if (!t) return null;
            return (
              <div key={idx}>
                <h3 className="text-sm font-medium text-emerald-100">
                  {t.name}
                  {match.teamCount > 2 && (
                    <span className="text-emerald-500/90"> (fila {t.rotationOrder}º)</span>
                  )}
                </h3>
                <ul className="mt-2 space-y-1">
                  {t.playerIds.map((pid) => {
                    const p = playersMap.get(pid);
                    if (!p) return null;
                    return (
                      <li key={pid}>
                        <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 px-3 py-2 text-sm">
                          {p.name} <Stars value={p.stars} readOnly />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-amber-200">Placar</h2>
        <p className="mt-1 text-xs text-emerald-500/90">
          Gols no tempo regulamentar dos times em campo. Em empate, marque a decisão nos pênaltis
          (uma cobrança por time: marque se converteu ou não).
        </p>
        {isAdmin ? (
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <label className="block">
              <span className="text-xs text-emerald-300/90">
                {match.teams[fieldA]?.name ?? "Time A"}
              </span>
              <input
                key={`pf0-${match.id}-${match.placarField0 ?? "x"}`}
                type="number"
                min={0}
                max={99}
                defaultValue={match.placarField0 ?? ""}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  const v = raw === "" ? null : Number(raw);
                  if (v !== null && (!Number.isFinite(v) || v < 0)) return;
                  if (v !== match.placarField0) void patch({ placarField0: v });
                }}
                className="mt-1 block w-24 rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
              />
            </label>
            <label className="block">
              <span className="text-xs text-emerald-300/90">
                {match.teams[fieldB]?.name ?? "Time B"}
              </span>
              <input
                key={`pf1-${match.id}-${match.placarField1 ?? "x"}`}
                type="number"
                min={0}
                max={99}
                defaultValue={match.placarField1 ?? ""}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  const v = raw === "" ? null : Number(raw);
                  if (v !== null && (!Number.isFinite(v) || v < 0)) return;
                  if (v !== match.placarField1) void patch({ placarField1: v });
                }}
                className="mt-1 block w-24 rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
              />
            </label>
          </div>
        ) : (
          <p className="mt-3 text-sm text-emerald-200/85">
            {scoreLine ?? "Placar ainda não informado."}
          </p>
        )}

        {match.placarField0 !== null &&
          match.placarField1 !== null &&
          match.placarField0 === match.placarField1 && (
            <div className="mt-4 rounded-xl border border-amber-900/40 bg-amber-950/20 p-4">
              <p className="text-sm font-medium text-amber-100/95">Empate — desempate nos pênaltis</p>
              {isAdmin ? (
                <>
                  <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-emerald-200">
                    <input
                      type="checkbox"
                      checked={match.decisaoPorPenaltis}
                      onChange={(e) =>
                        void patch({ decisaoPorPenaltis: e.target.checked })
                      }
                      className="rounded border-emerald-700"
                    />
                    Partida decidida nos pênaltis (1 cobrança por time)
                  </label>
                  {match.decisaoPorPenaltis && (
                    <div className="mt-4 flex flex-wrap gap-6">
                      <div>
                        <span className="text-xs text-emerald-300/90">
                          {match.teams[fieldA]?.name} — cobrança
                        </span>
                        <select
                          value={
                            match.penaltisConvertidos0 === null
                              ? ""
                              : String(match.penaltisConvertidos0)
                          }
                          onChange={(e) => {
                            const raw = e.target.value;
                            const v = raw === "" ? null : Number(raw);
                            void patch({ penaltisConvertidos0: v });
                          }}
                          className="mt-1 block rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
                        >
                          <option value="">—</option>
                          <option value="0">Errou</option>
                          <option value="1">Gol</option>
                        </select>
                      </div>
                      <div>
                        <span className="text-xs text-emerald-300/90">
                          {match.teams[fieldB]?.name} — cobrança
                        </span>
                        <select
                          value={
                            match.penaltisConvertidos1 === null
                              ? ""
                              : String(match.penaltisConvertidos1)
                          }
                          onChange={(e) => {
                            const raw = e.target.value;
                            const v = raw === "" ? null : Number(raw);
                            void patch({ penaltisConvertidos1: v });
                          }}
                          className="mt-1 block rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
                        >
                          <option value="">—</option>
                          <option value="0">Errou</option>
                          <option value="1">Gol</option>
                        </select>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                match.decisaoPorPenaltis &&
                match.penaltisConvertidos0 !== null &&
                match.penaltisConvertidos1 !== null && (
                  <p className="mt-2 text-sm text-emerald-200/90">
                    Pênaltis: {match.penaltisConvertidos0}–{match.penaltisConvertidos1}
                  </p>
                )
              )}
            </div>
          )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-amber-200">Cartões amarelos</h2>
        <p className="mt-1 text-xs text-emerald-500/90">
          Por jogo, apenas jogadores dos times em campo.
        </p>
        {isAdmin && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-emerald-300/90">Jogador</label>
              <select
                value={yellowPick}
                onChange={(e) => setYellowPick(e.target.value)}
                className="mt-1 rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
              >
                <option value="">Selecionar</option>
                {allInMatch().map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={!yellowPick || match.cartoesAmarelos.includes(yellowPick)}
              onClick={async () => {
                if (!yellowPick) return;
                const ok = await patch({ addCartaoAmarelo: { playerId: yellowPick } });
                if (ok) setYellowPick("");
              }}
              className="rounded-xl bg-amber-500 px-4 py-2 font-medium text-pitch-950 hover:bg-amber-400 disabled:opacity-40"
            >
              Registrar amarelo
            </button>
          </div>
        )}
        {match.cartoesAmarelos.length === 0 ? (
          <p className="mt-3 text-sm text-emerald-500/90">Nenhum amarelo neste jogo.</p>
        ) : (
          <ul className="mt-3 divide-y divide-emerald-900/60 rounded-xl border border-emerald-800/60">
            {match.cartoesAmarelos.map((pid) => {
              const p = playersMap.get(pid);
              return (
                <li
                  key={pid}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                >
                  <span className="text-emerald-100">{p?.name ?? pid}</span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => void patch({ removeCartaoAmarelo: pid })}
                      className="text-xs text-red-400/90 hover:text-red-300"
                    >
                      Remover
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-amber-200">Gols e assistências</h2>
        {isAdmin ? (
          <form
            onSubmit={addGoal}
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
          >
            <div>
              <label className="block text-xs text-emerald-300/90">Gol</label>
              <select
                value={scorerId}
                onChange={(e) => setScorerId(e.target.value)}
                className="mt-1 rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
                required
              >
                <option value="">Quem fez o gol</option>
                {allInMatch().map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-emerald-300/90">Assistência (opcional)</label>
              <select
                value={assistId}
                onChange={(e) => setAssistId(e.target.value)}
                className="mt-1 rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
              >
                <option value="">Nenhuma</option>
                {allInMatch()
                  .filter((p) => p.id !== scorerId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-xl bg-amber-500 px-4 py-2 font-medium text-pitch-950 hover:bg-amber-400"
            >
              Registrar gol
            </button>
          </form>
        ) : (
          <p className="mt-2 text-xs text-emerald-500/90">Somente o admin altera gols.</p>
        )}

        {match.goals.length === 0 ? (
          <p className="mt-4 text-sm text-emerald-500/90">Nenhum gol registrado.</p>
        ) : (
          <ul className="mt-4 divide-y divide-emerald-900/60 rounded-xl border border-emerald-800/60">
            {match.goals.map((g) => {
              const scorer = playersMap.get(g.scorerId);
              const ast = g.assistId ? playersMap.get(g.assistId) : null;
              return (
                <li
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <span>
                    <strong className="text-white">{scorer?.name ?? "?"}</strong>
                    {ast && (
                      <span className="text-emerald-300/90"> (assist. {ast.name})</span>
                    )}
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => removeGoal(g)}
                      className="text-xs text-red-400/90 hover:text-red-300"
                    >
                      Remover
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-amber-200">
          Vencedor desta partida
        </h2>
        {isAdmin ? (
          <>
            <p className="text-xs text-emerald-500/90">
              Selecione o time que venceu este jogo.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {[fieldA, fieldB].map((idx) => {
                const t = match.teams[idx];
                if (!t) return null;
                return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setChampion(idx)}
                  className={`rounded-xl px-5 py-2.5 font-medium transition ${
                    match.championTeamIndex === idx
                      ? "bg-amber-500 text-pitch-950"
                      : "border border-emerald-700 text-emerald-100 hover:bg-emerald-900/50"
                  }`}
                >
                  {t.name}
                </button>
                );
              })}
              <button
                type="button"
                onClick={() => setChampion(null)}
                className="rounded-xl border border-emerald-800 px-4 py-2.5 text-sm text-emerald-400 hover:bg-emerald-950/80"
              >
                Limpar
              </button>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-emerald-200/85">
            {matchWinnerDisplayName(match) ? (
              <>
                Vencedor: <strong className="text-amber-200">{matchWinnerDisplayName(match)}</strong>
              </>
            ) : (
              "Vencedor ainda não definido (cadastre o campeão ou o placar)."
            )}
          </p>
        )}
      </section>

      {isAdmin && (
        <button
          type="button"
          onClick={async () => {
            if (!confirm("Excluir este jogo?")) return;
            await fetch(`/api/matches/${id}`, { method: "DELETE" });
            window.location.href = "/jogos";
          }}
          className="text-sm text-red-400/90 hover:text-red-300"
        >
          Excluir jogo
        </button>
      )}
    </div>
  );
}
