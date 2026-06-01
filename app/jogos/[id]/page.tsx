"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { MatchTimers } from "@/components/MatchTimers";
import { MatchVoiceInput } from "@/components/MatchVoiceInput";
import { Stars } from "@/components/Stars";
import type { AppDataClient } from "@/lib/client-types";
import {
  fieldPlayerIdsOnMatch,
  matchScoreLine,
  matchWinnerDisplayName,
  rachaDraftGoleiroPlayerIds,
  rachaDraftLinhaPlayerIds,
  teamNameForPlayerOnField,
  teamsByRotation,
} from "@/lib/matchUi";
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
  const [formDuration, setFormDuration] = useState(8);
  const [formTeamNameA, setFormTeamNameA] = useState("");
  const [formTeamNameB, setFormTeamNameB] = useState("");
  const [formPlacar0, setFormPlacar0] = useState("");
  const [formPlacar1, setFormPlacar1] = useState("");
  const [formDecisaoPenaltis, setFormDecisaoPenaltis] = useState(false);
  const [formPen0, setFormPen0] = useState("");
  const [formPen1, setFormPen1] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const prevMatchIdRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (!match) return;
    if (prevMatchIdRef.current === match.id) return;
    prevMatchIdRef.current = match.id;
    const field = Array.isArray(match.fieldTeamIndexes)
      ? match.fieldTeamIndexes.filter((i) => i >= 0 && i < match.teams.length).slice(0, 2)
      : [0, 1];
    const fa = field[0] ?? 0;
    const fb = field[1] ?? 1;
    setFormDuration(match.durationMinutes);
    setFormTeamNameA(match.teams[fa]?.name ?? "");
    setFormTeamNameB(match.teams[fb]?.name ?? "");
    setFormPlacar0(match.placarField0 === null ? "" : String(match.placarField0));
    setFormPlacar1(match.placarField1 === null ? "" : String(match.placarField1));
    setFormDecisaoPenaltis(match.decisaoPorPenaltis);
    setFormPen0(match.penaltisConvertidos0 === null ? "" : String(match.penaltisConvertidos0));
    setFormPen1(match.penaltisConvertidos1 === null ? "" : String(match.penaltisConvertidos1));
  }, [match]);

  const playersMap = new Map<string, Player>();
  data?.players.forEach((p) => playersMap.set(p.id, p));

  const { fieldA, fieldB } = useMemo(() => {
    if (!match) return { fieldA: 0, fieldB: 1 };
    const field = Array.isArray(match.fieldTeamIndexes)
      ? match.fieldTeamIndexes.filter((i) => i >= 0 && i < match.teams.length).slice(0, 2)
      : [0, 1];
    return { fieldA: field[0] ?? 0, fieldB: field[1] ?? 1 };
  }, [match]);

  /** Jogadores de linha e goleiros do sorteio para registrar gols. */
  const opcoesGol = useMemo(() => {
    if (!match || !data) {
      return {
        emCampo: [] as Player[],
        outrosNoRacha: [] as Player[],
        goleiros: [] as Player[],
        draftDisponivel: false,
      };
    }
    const field = fieldPlayerIdsOnMatch(match);
    const drafts = data.draftsByAgendamento ?? {};
    const gkIds = match.agendamentoId
      ? rachaDraftGoleiroPlayerIds(match, drafts)
      : new Set<string>();
    const goleiros = data.players
      .filter((p) => p.category === "goleiro" && gkIds.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    if (match.agendamentoId) {
      const draftIds = rachaDraftLinhaPlayerIds(match, drafts);
      if (draftIds.size > 0) {
        const todos = data.players
          .filter((p) => p.category !== "goleiro" && draftIds.has(p.id))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
        return {
          emCampo: todos.filter((p) => field.has(p.id)),
          outrosNoRacha: todos.filter((p) => !field.has(p.id)),
          goleiros,
          draftDisponivel: true,
        };
      }
    }
    const emCampo = data.players
      .filter((p) => p.category !== "goleiro" && field.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return { emCampo, outrosNoRacha: [] as Player[], goleiros, draftDisponivel: false };
  }, [data, match]);

  const goalPlayersForVoice = useMemo(() => {
    const ids = new Set<string>();
    const list: Player[] = [];
    for (const p of [
      ...opcoesGol.emCampo,
      ...opcoesGol.outrosNoRacha,
      ...opcoesGol.goleiros,
    ]) {
      if (ids.has(p.id)) continue;
      ids.add(p.id);
      list.push(p);
    }
    return list;
  }, [opcoesGol]);

  const formPlacarEmpate = useMemo(() => {
    const a = formPlacar0.trim() === "" ? null : Number(formPlacar0);
    const b = formPlacar1.trim() === "" ? null : Number(formPlacar1);
    return (
      a !== null &&
      b !== null &&
      Number.isFinite(a) &&
      Number.isFinite(b) &&
      a === b
    );
  }, [formPlacar0, formPlacar1]);

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
    const updated = (await r.json()) as Match;
    setMatch(updated);
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        matches: prev.matches.map((x) => (x.id === updated.id ? updated : x)),
      };
    });
    return true;
  }

  async function salvarDetalhesPartida() {
    if (!match) return;
    setSavingDetails(true);
    try {
      const p0 =
        formPlacar0.trim() === "" ? null : Math.round(Number(formPlacar0));
      const p1 =
        formPlacar1.trim() === "" ? null : Math.round(Number(formPlacar1));
      if (p0 !== null && (!Number.isFinite(p0) || p0 < 0)) {
        alert("Placar do primeiro time inválido.");
        return;
      }
      if (p1 !== null && (!Number.isFinite(p1) || p1 < 0)) {
        alert("Placar do segundo time inválido.");
        return;
      }
      const pen0 =
        formPen0 === "" ? null : formPen0 === "0" || formPen0 === "1" ? Number(formPen0) : null;
      const pen1 =
        formPen1 === "" ? null : formPen1 === "0" || formPen1 === "1" ? Number(formPen1) : null;
      const dur = Math.min(60, Math.max(1, Math.round(formDuration) || 8));
      const teams = match.teams.map((t, i) => {
        if (i === fieldA)
          return { ...t, name: formTeamNameA.trim() || t.name };
        if (i === fieldB)
          return { ...t, name: formTeamNameB.trim() || t.name };
        return t;
      });
      const ok = await patch({
        durationMinutes: dur,
        teams,
        placarField0: p0,
        placarField1: p1,
        decisaoPorPenaltis: formDecisaoPenaltis,
        penaltisConvertidos0: pen0,
        penaltisConvertidos1: pen1,
      });
      if (ok) alert("Alterações salvas.");
    } finally {
      setSavingDetails(false);
    }
  }

  async function setChampion(idx: number | null) {
    await patch({ championTeamIndex: idx });
  }

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!scorerId) return;
    const payload: { scorerId: string; assistId?: string } = { scorerId };
    if (assistId && assistId !== scorerId) payload.assistId = assistId;
    const ok = await patch({ addGoal: payload });
    if (ok) {
      setScorerId("");
      setAssistId("");
    }
  }

  const opcoesAssistencia = useMemo(() => {
    return [...opcoesGol.emCampo, ...opcoesGol.outrosNoRacha].filter(
      (p) => p.category !== "goleiro"
    );
  }, [opcoesGol]);

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
  const scoreLine = matchScoreLine(match);

  return (
    <div className="space-y-4">
      <section>
        <Link href={backHref} className="text-xs text-amber-400/90 hover:underline">
          {isAdmin ? "← Jogos" : "← Resultados"}
        </Link>
        <h1 className="mt-1 font-display text-xl font-bold text-white">
          {match.teams[fieldA]?.name ?? "Time 1"} × {match.teams[fieldB]?.name ?? "Time 2"}
          {scoreLine && <span className="ml-2 text-amber-200/95">{scoreLine}</span>}
        </h1>
        <p className="mt-0.5 text-xs text-emerald-300/85">
          {new Date(match.date + "T12:00:00").toLocaleDateString("pt-BR")}
          {match.weekLabel ? ` · ${match.weekLabel}` : ""}
          {match.teamCount > 2 ? ` · Racha ${match.teamCount}T` : ""}
          {` · ${match.durationMinutes} min`}
        </p>
        {matchWinnerDisplayName(match) && (
          <p className="mt-1 text-xs text-amber-200/90">
            {match.drawResult ? "Resultado" : "Vencedor"}:{" "}
            <strong>{matchWinnerDisplayName(match)}</strong>
          </p>
        )}
        {!isAdmin && (
          <p className="mt-2 rounded-lg border border-emerald-800/50 bg-emerald-950/40 px-2 py-1.5 text-xs text-emerald-200/90">
            Visualização apenas — somente admins alteram placar, gols e cartões.
          </p>
        )}
      </section>

      {isAdmin && (
        <MatchVoiceInput
          goalPlayers={goalPlayersForVoice}
          yellowPlayers={allInMatch()}
          teamNameA={formTeamNameA.trim() || match.teams[fieldA]?.name || ""}
          teamNameB={formTeamNameB.trim() || match.teams[fieldB]?.name || ""}
          onConfirmGoal={async (playerId) => patch({ addGoal: { scorerId: playerId } })}
          onConfirmYellow={async (playerId) => {
            if (match.cartoesAmarelos.includes(playerId)) {
              alert("Este jogador já tem cartão amarelo.");
              return false;
            }
            return patch({ addCartaoAmarelo: { playerId } });
          }}
          onConfirmScore={async (scoreA, scoreB) => {
            setFormPlacar0(String(scoreA));
            setFormPlacar1(String(scoreB));
            return patch({ placarField0: scoreA, placarField1: scoreB });
          }}
        />
      )}

      <MatchTimers
        matchId={match.id}
        durationMinutes={match.durationMinutes}
        playersOnField={allInMatch()}
        canControl={isAdmin}
        heading="2. Cronômetros"
      />

      {match.teamCount > 2 && (
        <section className="rounded-lg border border-amber-900/35 bg-amber-950/15 p-3">
          <h2 className="text-sm font-semibold text-amber-200">3. Ordem da fila</h2>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-xs text-emerald-200/90">
            {fila.map((t) => (
              <li key={`${t.name}-${t.rotationOrder}`}>
                <strong>{t.name}</strong>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-3 space-y-2">
        <h2 className="text-sm font-semibold text-amber-200">4. Times e escalação</h2>
        {isAdmin && (
          <div className="grid grid-cols-2 gap-2">
            {[fieldA, fieldB].map((idx) => {
              const t = match.teams[idx];
              if (!t) return null;
              const isA = idx === fieldA;
              return (
                <label key={idx} className="block text-xs">
                  <span className="text-emerald-200/90">
                    {isA ? "Campo A" : "Campo B"}
                    {match.teamCount > 2 ? ` · ${t.rotationOrder}º` : ""}
                  </span>
                  <input
                    value={isA ? formTeamNameA : formTeamNameB}
                    onChange={(e) =>
                      isA ? setFormTeamNameA(e.target.value) : setFormTeamNameB(e.target.value)
                    }
                    className="mt-0.5 w-full rounded border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-sm text-white"
                  />
                </label>
              );
            })}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {[fieldA, fieldB].map((idx) => {
            const t = match.teams[idx];
            if (!t) return null;
            return (
              <div key={idx}>
                <p className="text-xs font-semibold text-amber-200/95">{t.name}</p>
                <ul className="mt-1 space-y-0.5">
                  {t.playerIds.map((pid) => {
                    const p = playersMap.get(pid);
                    if (!p) return null;
                    return (
                      <li
                        key={pid}
                        className="flex items-center justify-between gap-1 rounded border border-emerald-800/30 bg-emerald-950/20 px-1.5 py-1 text-[11px]"
                      >
                        <span className="min-w-0 truncate">{p.name}</span>
                        <Stars value={p.stars} readOnly />
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-3 space-y-2">
        <h2 className="text-sm font-semibold text-amber-200">5. Placar</h2>
        {isAdmin ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-emerald-300/90">
              {formTeamNameA.trim() || match.teams[fieldA]?.name || "A"}
              <input
                type="number"
                min={0}
                max={99}
                value={formPlacar0}
                onChange={(e) => setFormPlacar0(e.target.value)}
                className="ml-1 w-12 rounded border border-emerald-800 bg-pitch-950 px-1 py-0.5 text-white"
              />
            </label>
            <label className="text-xs text-emerald-300/90">
              {formTeamNameB.trim() || match.teams[fieldB]?.name || "B"}
              <input
                type="number"
                min={0}
                max={99}
                value={formPlacar1}
                onChange={(e) => setFormPlacar1(e.target.value)}
                className="ml-1 w-12 rounded border border-emerald-800 bg-pitch-950 px-1 py-0.5 text-white"
              />
            </label>
          </div>
        ) : (
          <p className="text-xs text-emerald-200/85">{scoreLine ?? "Placar não informado."}</p>
        )}

        {(isAdmin ? formPlacarEmpate : match.placarField0 !== null &&
          match.placarField1 !== null &&
          match.placarField0 === match.placarField1) && (
            <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-2">
              <p className="text-xs font-medium text-amber-100/95">Pênaltis (1 cobrança/time)</p>
              {isAdmin ? (
                <>
                  <label className="mt-1 flex cursor-pointer items-center gap-1.5 text-xs text-emerald-200">
                    <input
                      type="checkbox"
                      checked={formDecisaoPenaltis}
                      onChange={(e) => setFormDecisaoPenaltis(e.target.checked)}
                      className="rounded border-emerald-700"
                    />
                    Decidido nos pênaltis
                  </label>
                  {formDecisaoPenaltis && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <select
                        value={formPen0}
                        onChange={(e) => setFormPen0(e.target.value)}
                        className="rounded border border-emerald-800 bg-pitch-950 px-2 py-1 text-xs text-white"
                      >
                        <option value="">{formTeamNameA.trim() || match.teams[fieldA]?.name || "A"}</option>
                        <option value="0">Errou</option>
                        <option value="1">Gol</option>
                      </select>
                      <select
                        value={formPen1}
                        onChange={(e) => setFormPen1(e.target.value)}
                        className="rounded border border-emerald-800 bg-pitch-950 px-2 py-1 text-xs text-white"
                      >
                        <option value="">{formTeamNameB.trim() || match.teams[fieldB]?.name || "B"}</option>
                        <option value="0">Errou</option>
                        <option value="1">Gol</option>
                      </select>
                    </div>
                  )}
                </>
              ) : (
                match.decisaoPorPenaltis &&
                match.penaltisConvertidos0 !== null &&
                match.penaltisConvertidos1 !== null && (
                  <p className="mt-1 text-xs text-emerald-200/90">
                    {match.penaltisConvertidos0}–{match.penaltisConvertidos1}
                  </p>
                )
              )}
            </div>
          )}
      </section>

      <section className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-3 space-y-2">
        <h2 className="text-sm font-semibold text-amber-200">6. Cartões amarelos</h2>
        {isAdmin && (
          <div className="flex flex-wrap items-end gap-2">
            <select
              value={yellowPick}
              onChange={(e) => setYellowPick(e.target.value)}
              className="min-w-0 flex-1 rounded border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-xs text-white"
            >
              <option value="">Jogador</option>
              {allInMatch().map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!yellowPick || match.cartoesAmarelos.includes(yellowPick)}
              onClick={async () => {
                if (!yellowPick) return;
                const ok = await patch({ addCartaoAmarelo: { playerId: yellowPick } });
                if (ok) setYellowPick("");
              }}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-pitch-950 hover:bg-amber-400 disabled:opacity-40"
            >
              + Amarelo
            </button>
          </div>
        )}
        {match.cartoesAmarelos.length === 0 ? (
          <p className="text-xs text-emerald-500/90">Nenhum amarelo.</p>
        ) : (
          <ul className="space-y-1">
            {match.cartoesAmarelos.map((pid) => {
              const p = playersMap.get(pid);
              return (
                <li key={pid} className="flex items-center justify-between gap-2 rounded border border-emerald-800/40 px-2 py-1 text-xs">
                  <span className="text-emerald-100">{p?.name ?? pid}</span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => void patch({ removeCartaoAmarelo: pid })}
                      className="text-[10px] text-red-400/90 hover:text-red-300"
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

      <section className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-3 space-y-2">
        <h2 className="text-sm font-semibold text-amber-200">7. Gols</h2>
        {!opcoesGol.draftDisponivel && match.agendamentoId && (
          <p className="text-[10px] text-amber-200/85">Sem sorteio vinculado — só jogadores em campo.</p>
        )}
        {isAdmin ? (
          <form onSubmit={addGoal} className="space-y-2">
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 block text-xs">
                <span className="text-emerald-300/90">Artilheiro</span>
                <select
                  value={scorerId}
                  onChange={(e) => setScorerId(e.target.value)}
                  className="mt-0.5 w-full rounded border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-xs text-white"
                  required
                >
                  <option value="">Quem fez o gol</option>
                  <optgroup label="Em campo">
                    {opcoesGol.emCampo.map((p) => {
                      const tn = teamNameForPlayerOnField(match, p.id);
                      return (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {tn ? ` · ${tn}` : ""}
                        </option>
                      );
                    })}
                  </optgroup>
                  {opcoesGol.outrosNoRacha.length > 0 && (
                    <optgroup label="Substituto">
                      {opcoesGol.outrosNoRacha.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · sub
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {opcoesGol.goleiros.length > 0 && (
                    <optgroup label="Goleiros">
                      {opcoesGol.goleiros.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · GOL
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
              <label className="min-w-0 flex-1 block text-xs">
                <span className="text-emerald-300/90">Assistência (opcional)</span>
                <select
                  value={assistId}
                  onChange={(e) => setAssistId(e.target.value)}
                  className="mt-0.5 w-full rounded border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-xs text-white"
                >
                  <option value="">Sem assistência</option>
                  <optgroup label="Em campo">
                    {opcoesGol.emCampo.map((p) => {
                      const tn = teamNameForPlayerOnField(match, p.id);
                      return (
                        <option key={p.id} value={p.id} disabled={p.id === scorerId}>
                          {p.name}
                          {tn ? ` · ${tn}` : ""}
                        </option>
                      );
                    })}
                  </optgroup>
                  {opcoesGol.outrosNoRacha.length > 0 && (
                    <optgroup label="Substituto">
                      {opcoesGol.outrosNoRacha.map((p) => (
                        <option key={p.id} value={p.id} disabled={p.id === scorerId}>
                          {p.name} · sub
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
              <button
                type="submit"
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-pitch-950 hover:bg-amber-400"
              >
                + Gol
              </button>
            </div>
          </form>
        ) : (
          <p className="text-[10px] text-emerald-500/90">Somente admin altera gols.</p>
        )}

        {match.goals.length === 0 ? (
          <p className="text-xs text-emerald-500/90">Nenhum gol.</p>
        ) : (
          <ul className="space-y-1">
            {match.goals.map((g) => {
              const scorer = playersMap.get(g.scorerId);
              const assister = g.assistId ? playersMap.get(g.assistId) : null;
              const scorerTeam = teamNameForPlayerOnField(match, g.scorerId);
              const isGk = scorer?.category === "goleiro";
              return (
                <li
                  key={g.id}
                  className="flex items-center justify-between gap-2 rounded border border-emerald-800/40 px-2 py-1 text-xs"
                >
                  <span className="min-w-0 truncate">
                    <strong className="text-white">{scorer?.name ?? "?"}</strong>
                    {isGk ? (
                      <span className="text-sky-300/90"> · GOL</span>
                    ) : g.scorerFromBench ? (
                      <span className="text-amber-200/90"> · sub</span>
                    ) : (
                      scorerTeam && <span className="text-emerald-400/90"> · {scorerTeam}</span>
                    )}
                    {assister && (
                      <span className="text-sky-200/90">
                        {" "}
                        · ass. {assister.name}
                        {g.assistFromBench ? " (sub)" : ""}
                      </span>
                    )}
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => removeGoal(g)}
                      className="shrink-0 text-[10px] text-red-400/90 hover:text-red-300"
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

      <section className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-3 space-y-2">
        <h2 className="text-sm font-semibold text-amber-200">8. Vencedor</h2>
        {isAdmin ? (
          <div className="flex flex-wrap gap-1.5">
            {[fieldA, fieldB].map((idx) => {
              const t = match.teams[idx];
              if (!t) return null;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setChampion(idx)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
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
              onClick={() => void patch({ drawResult: true })}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                match.drawResult
                  ? "bg-amber-500 text-pitch-950"
                  : "border border-emerald-700 text-emerald-100 hover:bg-emerald-900/50"
              }`}
            >
              Empate
            </button>
            <button
              type="button"
              onClick={() => void patch({ championTeamIndex: null, drawResult: false })}
              className="rounded-lg border border-emerald-800 px-2 py-1.5 text-xs text-emerald-400 hover:bg-emerald-950/80"
            >
              Limpar
            </button>
          </div>
        ) : (
          <p className="text-xs text-emerald-200/85">
            {matchWinnerDisplayName(match) ? (
              <>
                {match.drawResult ? "Resultado" : "Vencedor"}:{" "}
                <strong className="text-amber-200">{matchWinnerDisplayName(match)}</strong>
              </>
            ) : (
              "Vencedor não definido."
            )}
          </p>
        )}
      </section>

      {isAdmin && (
        <section className="rounded-lg border border-amber-900/40 bg-amber-950/15 p-3 space-y-2">
          <h2 className="text-sm font-semibold text-amber-200">9. Salvar detalhes</h2>
          <p className="text-[10px] text-emerald-100/75">
            Duração, nomes e placar só vão ao servidor ao salvar. Gols, cartões e vencedor salvam ao
            registrar.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-emerald-200/90">
              Min
              <input
                type="number"
                min={1}
                max={60}
                value={formDuration}
                onChange={(e) => setFormDuration(Number(e.target.value) || 1)}
                className="ml-1 w-12 rounded border border-emerald-800 bg-pitch-950 px-1 py-0.5 text-white"
              />
            </label>
            <button
              type="button"
              disabled={savingDetails}
              onClick={() => void salvarDetalhesPartida()}
              className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-pitch-950 hover:bg-amber-400 disabled:opacity-50 sm:w-auto"
            >
              {savingDetails ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </section>
      )}

      {isAdmin && (
        <button
          type="button"
          onClick={async () => {
            if (!confirm("Excluir este jogo?")) return;
            await fetch(`/api/matches/${id}`, { method: "DELETE" });
            window.location.href = "/jogos";
          }}
          className="text-xs text-red-400/90 hover:text-red-300"
        >
          Excluir jogo
        </button>
      )}
    </div>
  );
}
