"use client";

import Link from "next/link";
import { agendamentoCountsForRanking, RANKING_START_DATE } from "@/lib/ranking-defaults";
import {
  formatRankPoints,
  POINTS_PER_ASSIST,
  POINTS_PER_GOAL,
  POINTS_PER_YELLOW,
} from "@/lib/scoring";
import {
  playerPointEvents,
  rankGoalkeepersForAgendamento,
  rankPlayers,
  rankPlayersForAgendamento,
  rankTeamsForAgendamento,
  sortTeamsByPerformance,
  type PlayerPointEvent,
} from "@/lib/stats";
import { useAppData } from "@/lib/useData";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";

type EventFilter = "all" | "gain" | "loss" | PlayerPointEvent["kind"];

function formatAgendamentoOption(a: { date: string; time?: string; title?: string }) {
  const label = new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR");
  return `${label}${a.time ? ` · ${a.time}` : ""}${a.title ? ` · ${a.title}` : ""}`;
}

export default function RankingPage() {
  const { data: session } = useSession();
  const { data, loading, error, refresh } = useAppData();
  const [resetting, setResetting] = useState(false);
  const [detailPlayerId, setDetailPlayerId] = useState("");
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [rachaFiltroId, setRachaFiltroId] = useState("");

  const isAdmin = session?.user?.role === "admin";
  const safeData = data ?? {
    players: [],
    matches: [],
    agendamentos: [],
    draftsByAgendamento: {},
    lastDraft: null,
    users: [],
  };

  const rankData = useMemo(
    () => ({
      ...safeData,
      agendamentos: safeData.agendamentos,
    }),
    [safeData]
  );

  async function resetMatches() {
    if (!confirm("Isso apaga todo o histórico de jogos cadastrados. Continuar?")) return;
    setResetting(true);
    try {
      const r = await fetch("/api/admin/reset-matches", { method: "POST" });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        alert(j.error ?? "Não foi possível zerar.");
        return;
      }
      await refresh();
    } finally {
      setResetting(false);
    }
  }

  const playersAnual = rankPlayers(rankData);
  const allPlayersSorted = useMemo(
    () => [...safeData.players].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [safeData.players]
  );

  const pointEvents = useMemo(() => {
    if (!detailPlayerId) return [];
    return playerPointEvents(rankData, detailPlayerId);
  }, [rankData, detailPlayerId]);

  const filteredPointEvents = useMemo(() => {
    return pointEvents.filter((e) => {
      if (eventFilter === "all") return true;
      if (eventFilter === "gain") return e.points > 0;
      if (eventFilter === "loss") return e.points < 0;
      return e.kind === eventFilter;
    });
  }, [pointEvents, eventFilter]);

  const detailTotalPoints = useMemo(() => {
    if (!detailPlayerId) return null;
    return playersAnual.find((r) => r.player.id === detailPlayerId)?.points ?? 0;
  }, [playersAnual, detailPlayerId]);

  const filteredPointsSum = useMemo(
    () => filteredPointEvents.reduce((s, e) => s + e.points, 0),
    [filteredPointEvents]
  );

  const agendamentosOrdenados = useMemo(
    () =>
      [...safeData.agendamentos]
        .filter((a) => agendamentoCountsForRanking(a.date))
        .sort((a, b) => {
          const d = b.date.localeCompare(a.date);
          return d !== 0 ? d : b.id.localeCompare(a.id);
        }),
    [safeData.agendamentos]
  );

  const partidasNoRacha = useMemo(() => {
    if (!rachaFiltroId) return [];
    return safeData.matches.filter((m) => m.agendamentoId === rachaFiltroId);
  }, [safeData.matches, rachaFiltroId]);

  const pontuacaoRacha = useMemo(() => {
    if (!rachaFiltroId) return [];
    return rankPlayersForAgendamento(rankData, rachaFiltroId);
  }, [rankData, rachaFiltroId]);

  const artilheirosRacha = useMemo(() => {
    if (!rachaFiltroId) return [];
    return [...rankPlayersForAgendamento(rankData, rachaFiltroId)]
      .filter((r) => r.goals > 0)
      .sort((a, b) => {
        if (b.goals !== a.goals) return b.goals - a.goals;
        return a.player.name.localeCompare(b.player.name, "pt-BR");
      });
  }, [rankData, rachaFiltroId]);

  const timesRacha = useMemo(() => {
    if (!rachaFiltroId) return [];
    return sortTeamsByPerformance(rankTeamsForAgendamento(rankData, rachaFiltroId)).filter(
      (t) => t.games > 0
    );
  }, [rankData, rachaFiltroId]);

  const goleirosRacha = useMemo(() => {
    if (!rachaFiltroId) return [];
    return rankGoalkeepersForAgendamento(rankData, rachaFiltroId);
  }, [rankData, rachaFiltroId]);

  const rankingStartLabel = new Date(RANKING_START_DATE + "T12:00:00").toLocaleDateString(
    "pt-BR"
  );

  if (loading) return <p className="text-emerald-200/80">Carregando…</p>;
  if (error || !data) return <p className="text-red-300">{error ?? "Erro"}</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold text-white">Ranking</h1>
        <p className="mt-1 text-xs text-emerald-100/75">
          Pontuação a partir de {rankingStartLabel}. Gol {POINTS_PER_GOAL} pts · assistência{" "}
          {POINTS_PER_ASSIST} pt · amarelo {POINTS_PER_YELLOW} pt.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded border border-emerald-700 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-900/40"
          >
            Atualizar
          </button>
          {isAdmin && (
            <button
              type="button"
              disabled={resetting}
              onClick={() => void resetMatches()}
              className="rounded border border-amber-700/70 bg-amber-950/30 px-2 py-1 text-xs text-amber-200/95 hover:bg-amber-950/50 disabled:opacity-50"
            >
              {resetting ? "Zerando…" : "Zerar jogos (admin)"}
            </button>
          )}
        </div>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-amber-200">
          Melhores jogadores <span className="font-normal text-emerald-300/80">(Ranking anual)</span>
        </h2>
        {allPlayersSorted.length === 0 ? (
          <p className="mt-2 text-xs text-emerald-500/90">Nenhum jogador cadastrado.</p>
        ) : playersAnual.length === 0 ? (
          <p className="mt-2 text-xs text-emerald-500/90">Nenhum ponto registrado no período.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[24rem] text-left text-xs">
              <thead>
                <tr className="border-b border-emerald-800/80 text-emerald-400/90">
                  <th className="pb-1 pr-3">#</th>
                  <th className="pb-1 pr-3">Jogador</th>
                  <th className="pb-1 pr-3 text-amber-200/95">Pts</th>
                  <th className="pb-1 pr-3">G</th>
                  <th className="pb-1 pr-3">As</th>
                  <th className="pb-1 pr-3">Am</th>
                  <th className="pb-1">J</th>
                </tr>
              </thead>
              <tbody>
                {playersAnual.map((r, i) => (
                  <tr key={r.player.id} className="border-b border-emerald-900/50">
                    <td className="py-1.5 pr-3 text-emerald-500">{i + 1}</td>
                    <td className="py-1.5 pr-3 font-medium text-white">{r.player.name}</td>
                    <td className="py-1.5 pr-3 font-medium tabular-nums text-amber-100/95">
                      {formatRankPoints(r.points)}
                    </td>
                    <td className="py-1.5 pr-3">{r.goals}</td>
                    <td className="py-1.5 pr-3">{r.assists}</td>
                    <td className="py-1.5 pr-3">{r.yellowCards}</td>
                    <td className="py-1.5">{r.games}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-amber-200">Racha</h2>
          <select
            value={rachaFiltroId}
            onChange={(e) => setRachaFiltroId(e.target.value)}
            className="mt-2 w-full max-w-xl rounded-lg border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-sm text-white"
          >
            <option value="">Selecione um racha…</option>
            {agendamentosOrdenados.map((a) => (
              <option key={a.id} value={a.id}>
                {formatAgendamentoOption(a)}
              </option>
            ))}
          </select>
        </div>

        {!rachaFiltroId && (
          <p className="text-xs text-emerald-200/85">Escolha a data do racha para ver as estatísticas.</p>
        )}

        {rachaFiltroId && partidasNoRacha.length === 0 && (
          <p className="text-xs text-emerald-200/85">Sem jogos neste racha.</p>
        )}

        {rachaFiltroId && partidasNoRacha.length > 0 && (
          <>
            <div>
              <h3 className="text-xs font-semibold text-amber-200/95">Pontuação total por jogador</h3>
              {pontuacaoRacha.length === 0 ? (
                <p className="mt-2 text-xs text-emerald-500/90">Nenhum ponto registrado.</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[20rem] text-left text-xs">
                    <thead>
                      <tr className="border-b border-emerald-800/80 text-emerald-400/90">
                        <th className="pb-1 pr-3">#</th>
                        <th className="pb-1 pr-3">Jogador</th>
                        <th className="pb-1 pr-3 text-right text-amber-200/95">Pts</th>
                        <th className="pb-1 pr-3 text-right">G</th>
                        <th className="pb-1 pr-3 text-right">As</th>
                        <th className="pb-1 pr-3 text-right">Am</th>
                        <th className="pb-1 text-right">J</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pontuacaoRacha.map((r, i) => (
                        <tr key={r.player.id} className="border-b border-emerald-900/50">
                          <td className="py-1.5 pr-3 text-emerald-500">{i + 1}</td>
                          <td className="py-1.5 pr-3 font-medium text-white">{r.player.name}</td>
                          <td className="py-1.5 pr-3 text-right font-semibold tabular-nums text-amber-100/95">
                            {formatRankPoints(r.points)}
                          </td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{r.goals}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{r.assists}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{r.yellowCards}</td>
                          <td className="py-1.5 text-right tabular-nums">{r.games}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold text-amber-200/95">Gols por jogador</h3>
              {artilheirosRacha.length === 0 ? (
                <p className="mt-2 text-xs text-emerald-500/90">Nenhum gol registrado.</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[14rem] text-left text-xs">
                    <thead>
                      <tr className="border-b border-emerald-800/80 text-emerald-400/90">
                        <th className="pb-1 pr-3">#</th>
                        <th className="pb-1 pr-3">Jogador</th>
                        <th className="pb-1 text-right">Gols</th>
                      </tr>
                    </thead>
                    <tbody>
                      {artilheirosRacha.map((r, i) => (
                        <tr key={r.player.id} className="border-b border-emerald-900/50">
                          <td className="py-1.5 pr-3 text-emerald-500">{i + 1}</td>
                          <td className="py-1.5 pr-3 font-medium text-white">{r.player.name}</td>
                          <td className="py-1.5 text-right font-semibold tabular-nums text-amber-100/95">
                            {r.goals}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold text-amber-200/95">Times com mais vitórias</h3>
              {timesRacha.length === 0 ? (
                <p className="mt-2 text-xs text-emerald-500/90">Nenhuma vitória registrada.</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[14rem] text-left text-xs">
                    <thead>
                      <tr className="border-b border-emerald-800/80 text-emerald-400/90">
                        <th className="pb-1 pr-3">#</th>
                        <th className="pb-1 pr-3">Time</th>
                        <th className="pb-1 pr-3 text-right">Vitórias</th>
                        <th className="pb-1 text-right">Jogos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timesRacha.map((t, i) => (
                        <tr key={t.name} className="border-b border-emerald-900/50">
                          <td className="py-1.5 pr-3 text-emerald-500">{i + 1}</td>
                          <td className="py-1.5 pr-3 font-medium text-white">{t.name}</td>
                          <td className="py-1.5 pr-3 text-right font-semibold tabular-nums text-amber-100/95">
                            {t.wins}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">{t.games}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold text-amber-200/95">Goleiros (mais vazados)</h3>
              {goleirosRacha.length === 0 ? (
                <p className="mt-2 text-xs text-emerald-500/90">Nenhum dado de goleiro neste racha.</p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[20rem] text-left text-xs">
                    <thead>
                      <tr className="border-b border-emerald-800/80 text-emerald-400/90">
                        <th className="pb-1 pr-3">#</th>
                        <th className="pb-1 pr-3">Goleiro</th>
                        <th className="pb-1 pr-3 text-right">Jogos</th>
                        <th className="pb-1 pr-3 text-right">Sofridos</th>
                        <th className="pb-1 text-right">Média</th>
                      </tr>
                    </thead>
                    <tbody>
                      {goleirosRacha.map((r, i) => (
                        <tr key={r.player.id} className="border-b border-emerald-900/50">
                          <td className="py-1.5 pr-3 text-emerald-500">{i + 1}</td>
                          <td className="py-1.5 pr-3 font-medium text-white">{r.player.name}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{r.games}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{r.goalsConceded}</td>
                          <td className="py-1.5 text-right tabular-nums">
                            {r.averageConceded.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {allPlayersSorted.length > 0 && (
        <section className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3">
          <h2 className="text-sm font-semibold text-amber-200">Extrato de pontos</h2>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <label className="block min-w-[10rem]">
              <span className="text-xs text-emerald-300/90">Jogador</span>
              <select
                value={detailPlayerId}
                onChange={(e) => {
                  setDetailPlayerId(e.target.value);
                  setEventFilter("all");
                }}
                className="mt-0.5 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-sm text-white"
              >
                <option value="">Selecionar…</option>
                {allPlayersSorted.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-[9rem]">
              <span className="text-xs text-emerald-300/90">Filtro</span>
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value as EventFilter)}
                disabled={!detailPlayerId}
                className="mt-0.5 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-sm text-white disabled:opacity-50"
              >
                <option value="all">Todos</option>
                <option value="gain">Ganhos</option>
                <option value="loss">Perdas</option>
                <option value="goal">Gols</option>
                <option value="assist">Assistências</option>
                <option value="yellow">Amarelos</option>
              </select>
            </label>
          </div>
          {detailPlayerId && (
            <>
              <p className="mt-2 text-xs text-emerald-200/90">
                Total:{" "}
                <strong className="text-amber-200/95">
                  {formatRankPoints(detailTotalPoints ?? 0)} pts
                </strong>
                {eventFilter !== "all" && (
                  <span className="text-emerald-400/90">
                    {" "}
                    · Filtro: {filteredPointsSum > 0 ? "+" : ""}
                    {formatRankPoints(filteredPointsSum)} pts
                  </span>
                )}
              </p>
              {filteredPointEvents.length > 0 && (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[20rem] text-left text-xs">
                    <thead>
                      <tr className="border-b border-emerald-800/80 text-emerald-400/90">
                        <th className="pb-1 pr-3">Data</th>
                        <th className="pb-1 pr-3">Evento</th>
                        <th className="pb-1 pr-3 text-right">Pts</th>
                        <th className="pb-1">Jogo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPointEvents.map((e, idx) => (
                        <tr
                          key={`${e.matchId}-${e.kind}-${e.date}-${idx}`}
                          className="border-b border-emerald-900/50"
                        >
                          <td className="py-1 pr-3 whitespace-nowrap text-emerald-200/90">
                            {new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR")}
                          </td>
                          <td className="py-1 pr-3">{e.label}</td>
                          <td
                            className={`py-1 pr-3 text-right font-medium tabular-nums ${
                              e.points > 0
                                ? "text-emerald-300"
                                : e.points < 0
                                  ? "text-red-300/90"
                                  : "text-emerald-500"
                            }`}
                          >
                            {e.points > 0 ? "+" : ""}
                            {formatRankPoints(e.points)}
                          </td>
                          <td className="py-1">
                            <Link
                              href={`/jogos/${e.matchId}`}
                              className="text-amber-400/95 underline"
                            >
                              Ver
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
