"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatAgendamentoLabel, getLatestAgendamento } from "@/lib/agendamentos-ui";
import { formatRankPoints } from "@/lib/scoring";
import {
  rankPlayersForAgendamento,
  rankTeamsRachaDetailed,
  type PlayerRankRow,
} from "@/lib/stats";
import { useAppData } from "@/lib/useData";

function formatAgOption(a: { date: string; time?: string; title?: string }) {
  const label = new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR");
  return `${label}${a.time ? ` · ${a.time}` : ""}${a.title ? ` · ${a.title}` : ""}`;
}

export default function RankingDoRachaPage() {
  const { data, loading, error } = useAppData();
  const latestRacha = useMemo(
    () => (data ? getLatestAgendamento(data.agendamentos) : null),
    [data]
  );
  const [agendamentoId, setAgendamentoId] = useState("");

  useEffect(() => {
    if (latestRacha && !agendamentoId) {
      setAgendamentoId(latestRacha.id);
    }
  }, [latestRacha, agendamentoId]);

  const rankData = useMemo(
    () => ({
      players: data?.players ?? [],
      matches: data?.matches ?? [],
      agendamentos: data?.agendamentos ?? [],
      draftsByAgendamento: data?.draftsByAgendamento ?? {},
    }),
    [data]
  );

  const teamStats = useMemo(() => {
    if (!agendamentoId) return [];
    return rankTeamsRachaDetailed(rankData, agendamentoId);
  }, [rankData, agendamentoId]);

  const playerStats: PlayerRankRow[] = useMemo(() => {
    if (!agendamentoId) return [];
    return rankPlayersForAgendamento(rankData, agendamentoId);
  }, [rankData, agendamentoId]);

  const agendamento = data?.agendamentos.find((a) => a.id === agendamentoId);
  const hasDraft = Boolean(agendamentoId && data?.draftsByAgendamento?.[agendamentoId]);

  if (loading) return <p className="text-emerald-200/80">Carregando…</p>;
  if (error || !data) return <p className="text-red-300">{error ?? "Erro"}</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold text-white">Ranking do racha</h1>
        <Link
          href="/registro-de-jogos"
          className="text-xs text-amber-300/95 underline hover:text-amber-200"
        >
          ← Registro de jogos
        </Link>
      </div>

      <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-3">
        <label className="text-xs text-emerald-200/90">Racha</label>
        <select
          value={agendamentoId}
          onChange={(e) => setAgendamentoId(e.target.value)}
          className="mt-0.5 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-sm text-white"
        >
          <option value="">Selecione…</option>
          {[...data.agendamentos]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((a) => (
              <option key={a.id} value={a.id}>
                {formatAgOption(a)}
                {a.id === latestRacha?.id ? " (atual)" : ""}
              </option>
            ))}
        </select>
        {agendamento && (
          <p className="mt-1 text-xs text-emerald-400/90">{formatAgendamentoLabel(agendamento)}</p>
        )}
      </div>

      {!agendamentoId ? (
        <p className="text-sm text-emerald-400/90">Selecione um racha para ver o ranking.</p>
      ) : !hasDraft ? (
        <p className="text-sm text-amber-200/90">
          Este racha ainda não tem sorteio vinculado.
        </p>
      ) : (
        <>
          <section>
            <h2 className="text-sm font-semibold text-amber-200">Times</h2>
            {teamStats.length === 0 ? (
              <p className="mt-1 text-xs text-emerald-500/90">Nenhum jogo registrado.</p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-lg border border-emerald-800/60">
                <table className="w-full min-w-[320px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-emerald-800/60 bg-emerald-950/60 text-emerald-300/90">
                      <th className="px-3 py-2 font-medium">Time</th>
                      <th className="px-2 py-2 text-center font-medium">V</th>
                      <th className="px-2 py-2 text-center font-medium">E</th>
                      <th className="px-2 py-2 text-center font-medium">D</th>
                      <th className="px-2 py-2 text-center font-medium">J</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamStats.map((row, idx) => (
                      <tr
                        key={row.teamIndex}
                        className={`border-b border-emerald-900/50 ${
                          idx === 0 ? "bg-amber-950/25 font-semibold text-amber-100" : "text-emerald-100/95"
                        }`}
                      >
                        <td className="px-3 py-2">
                          {idx === 0 && <span className="mr-1">🏆</span>}
                          {row.name}
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums">{row.wins}</td>
                        <td className="px-2 py-2 text-center tabular-nums">{row.draws}</td>
                        <td className="px-2 py-2 text-center tabular-nums">{row.losses}</td>
                        <td className="px-2 py-2 text-center tabular-nums">{row.games}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-amber-200">Jogadores</h2>
            {playerStats.length === 0 ? (
              <p className="mt-1 text-xs text-emerald-500/90">Nenhuma pontuação ainda.</p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-lg border border-emerald-800/60">
                <table className="w-full min-w-[360px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-emerald-800/60 bg-emerald-950/60 text-emerald-300/90">
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-2 py-2 font-medium">Jogador</th>
                      <th className="px-2 py-2 text-center font-medium">G</th>
                      <th className="px-2 py-2 text-center font-medium">A</th>
                      <th className="px-2 py-2 text-center font-medium">🟨</th>
                      <th className="px-2 py-2 text-center font-medium">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playerStats.map((row, idx) => (
                      <tr
                        key={row.player.id}
                        className={`border-b border-emerald-900/50 ${
                          idx < 3
                            ? "bg-amber-950/20 font-medium text-amber-100"
                            : "text-emerald-100/95"
                        }`}
                      >
                        <td className="px-3 py-2 tabular-nums">
                          {idx < 3 ? ["🥇", "🥈", "🥉"][idx] : idx + 1}
                        </td>
                        <td className="px-2 py-2">{row.player.name}</td>
                        <td className="px-2 py-2 text-center tabular-nums">{row.goals}</td>
                        <td className="px-2 py-2 text-center tabular-nums">{row.assists}</td>
                        <td className="px-2 py-2 text-center tabular-nums">{row.yellowCards}</td>
                        <td className="px-2 py-2 text-center tabular-nums font-semibold">
                          {formatRankPoints(row.points)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
