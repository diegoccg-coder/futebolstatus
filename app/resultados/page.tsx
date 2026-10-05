"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  effectiveWinnerTeamIndex,
  fieldTeamIndexesSafe,
  matchScoreLine,
  sortMatchesChronologically,
} from "@/lib/matchUi";
import { rankTeamsRachaDetailed } from "@/lib/stats";
import { teamLabelFromStarGroup } from "@/lib/team-names";
import type { Match, MatchTeamSlot, Player } from "@/lib/types";
import { useAppData } from "@/lib/useData";

const SEM_RACHA = "__sem_racha__";

function teamDisplayName(
  team: { name?: string; playerIds?: string[] } | undefined,
  idx: number,
  players: Player[]
): string {
  return teamLabelFromStarGroup(
    team?.playerIds ?? [],
    players,
    team?.name ?? "",
    idx
  );
}

function matchTeamsLabel(m: Match, players: Player[]): string {
  const idx = fieldTeamIndexesSafe(m);
  if (idx.length >= 2) {
    const a = teamDisplayName(m.teams[idx[0]], idx[0], players);
    const b = teamDisplayName(m.teams[idx[1]], idx[1], players);
    return `${a} × ${b}`;
  }
  return m.teams.map((t, i) => teamDisplayName(t, i, players)).join(" · ");
}

function winsFromMatches(matches: Match[], players: Player[]) {
  const byIndex = new Map<number, MatchTeamSlot>();
  for (const m of matches) {
    m.teams.forEach((t, i) => {
      const prev = byIndex.get(i);
      if (!prev || t.playerIds.length > prev.playerIds.length) byIndex.set(i, t);
    });
  }
  const rows = [...byIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([teamIndex, team]) => ({
      teamIndex,
      key: String(teamIndex),
      name: teamDisplayName(team, teamIndex, players),
      wins: 0,
    }));
  const rowByIndex = new Map(rows.map((row) => [row.teamIndex, row]));
  for (const m of matches) {
    const winner = effectiveWinnerTeamIndex(m);
    if (winner === null) continue;
    const row = rowByIndex.get(winner);
    if (row) row.wins += 1;
  }
  return rows;
}

export default function ResultadosPage() {
  const { data, loading, error, refresh } = useAppData();
  const [selectedId, setSelectedId] = useState("");

  const agendamentosSorted = useMemo(
    () =>
      data ? [...data.agendamentos].sort((a, b) => b.date.localeCompare(a.date)) : [],
    [data]
  );

  const temJogosSemRacha = useMemo(
    () => (data ? data.matches.some((m) => !m.agendamentoId) : false),
    [data]
  );

  useEffect(() => {
    if (!data) return;
    if (agendamentosSorted.length === 0 && !temJogosSemRacha) {
      setSelectedId("");
      return;
    }
    if (
      !selectedId ||
      (selectedId !== SEM_RACHA && !data.agendamentos.some((a) => a.id === selectedId))
    ) {
      const temJogo = (aid: string) =>
        data.matches.some((m) => m.agendamentoId === aid);
      const comJogo = agendamentosSorted.find((a) => temJogo(a.id));
      if (comJogo) setSelectedId(comJogo.id);
      else if (agendamentosSorted[0]) setSelectedId(agendamentosSorted[0]!.id);
      else if (temJogosSemRacha) setSelectedId(SEM_RACHA);
      else setSelectedId("");
    }
  }, [data, agendamentosSorted, selectedId, temJogosSemRacha]);

  if (loading) return <p className="text-emerald-200/80">Carregando…</p>;
  if (error || !data) return <p className="text-red-300">{error ?? "Erro"}</p>;

  const agLabel = (id: string) => {
    const a = data.agendamentos.find((x) => x.id === id);
    if (!a) return id;
    const t = a.time ? ` · ${a.time}` : "";
    return `${new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR")}${t}${a.title ? ` — ${a.title}` : ""}`;
  };

  const matchesFiltered = data.matches.filter((m) => {
    if (selectedId === SEM_RACHA) return !m.agendamentoId;
    return m.agendamentoId === selectedId;
  });

  const matches = [...matchesFiltered].sort(sortMatchesChronologically);

  const teamStats = (() => {
    if (!selectedId || selectedId === SEM_RACHA) return [];
    const draft = data.draftsByAgendamento[selectedId];
    const detailed = rankTeamsRachaDetailed(
      {
        players: data.players,
        matches: data.matches,
        agendamentos: data.agendamentos,
        draftsByAgendamento: data.draftsByAgendamento,
      },
      selectedId
    );
    if (draft && detailed.length > 0) {
      return [...detailed]
        .sort((a, b) => a.teamIndex - b.teamIndex)
        .map((row) => {
          const team = draft.teams[row.teamIndex];
          return {
            key: String(row.teamIndex),
            name: teamDisplayName(team, row.teamIndex, data.players),
            wins: row.wins,
          };
        });
    }
    return winsFromMatches(matches, data.players);
  })();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold text-white">Resultados</h1>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded border border-emerald-700 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-900/40"
        >
          Atualizar
        </button>
      </div>

      {agendamentosSorted.length === 0 && !temJogosSemRacha ? (
        <p className="text-sm text-emerald-400/90">Nenhum racha ou jogo registrado.</p>
      ) : (
        <>
          <div>
            <label className="text-xs text-amber-200/95">Racha</label>
            <select
              className="mt-1 w-full max-w-xl rounded-lg border border-emerald-800/60 bg-pitch-950 px-2 py-1.5 text-sm text-emerald-100"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {agendamentosSorted.map((a) => {
                const n = data.matches.filter((m) => m.agendamentoId === a.id).length;
                return (
                  <option key={a.id} value={a.id}>
                    {agLabel(a.id)}
                    {n > 0 ? ` (${n} jogo${n !== 1 ? "s" : ""})` : ""}
                  </option>
                );
              })}
              {temJogosSemRacha && (
                <option value={SEM_RACHA}>
                  Sem racha (
                  {data.matches.filter((m) => !m.agendamentoId).length} jogo
                  {data.matches.filter((m) => !m.agendamentoId).length !== 1 ? "s" : ""})
                </option>
              )}
            </select>
          </div>

          {selectedId && selectedId !== SEM_RACHA && teamStats.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {teamStats.map((row) => (
                <div
                  key={row.key}
                  className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-2 py-1.5 text-center"
                >
                  <p className="text-xs text-emerald-300/90">{row.name}</p>
                  <p className="text-lg font-semibold tabular-nums text-white">{row.wins}</p>
                  <p className="text-[10px] text-emerald-500/90">
                    vitória{row.wins !== 1 ? "s" : ""}
                  </p>
                </div>
              ))}
            </div>
          )}

          {matches.length === 0 ? (
            <p className="text-sm text-emerald-400/90">Nenhum jogo neste racha.</p>
          ) : (
            <ul className="divide-y divide-emerald-900/80 rounded-lg border border-emerald-800/60">
              {matches.map((m, i) => {
                const score = matchScoreLine(m);
                return (
                  <li key={m.id}>
                    <Link
                      href={`/jogos/${m.id}`}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm transition hover:bg-emerald-950/50"
                    >
                      <span className="shrink-0 text-xs tabular-nums text-emerald-500">
                        {i + 1}º
                      </span>
                      <span className="min-w-0 flex-1 font-medium text-white">
                        {matchTeamsLabel(m, data.players)}
                      </span>
                      {score ? (
                        <span className="shrink-0 font-semibold tabular-nums text-amber-200">
                          {score}
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs text-emerald-500">—</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
