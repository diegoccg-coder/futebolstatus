"use client";

import Link from "next/link";
import { Stars } from "@/components/Stars";
import {
  agendamentoCountsForRanking,
  DEFAULT_RACHA_TEAM_NAMES,
  RANKING_START_DATE,
} from "@/lib/ranking-defaults";
import {
  formatRankPoints,
  POINTS_PER_GOAL,
  POINTS_PER_WIN,
  POINTS_PER_YELLOW,
} from "@/lib/scoring";
import {
  playerPointEvents,
  rankGoalkeepersMostConceded,
  rankPlayers,
  rankPlayersForAgendamento,
  rankTeams,
  rankTeamsForAgendamento,
  sortTeamsByPerformance,
  type PlayerPointEvent,
} from "@/lib/stats";
import { useAppData } from "@/lib/useData";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";

type EventFilter = "all" | "gain" | "loss" | PlayerPointEvent["kind"];

export default function RankingPage() {
  const { data: session } = useSession();
  const { data, loading, error, refresh } = useAppData();
  const [resetting, setResetting] = useState(false);
  const [detailPlayerId, setDetailPlayerId] = useState("");
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [destaqueAgendamentoId, setDestaqueAgendamentoId] = useState("");

  const isAdmin = session?.user?.role === "admin";
  const safeData = data ?? {
    players: [],
    matches: [],
    agendamentos: [],
    draftsByAgendamento: {},
    championPhotosByAgendamento: {},
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

  const players = rankPlayers(rankData);
  const teams = rankTeams(rankData);
  const goalkeepersLeak = rankGoalkeepersMostConceded(rankData);
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
    return players.find((r) => r.player.id === detailPlayerId)?.points ?? 0;
  }, [players, detailPlayerId]);

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

  const partidasNoRachaSelecionado = useMemo(() => {
    if (!destaqueAgendamentoId) return [];
    return safeData.matches.filter((m) => m.agendamentoId === destaqueAgendamentoId);
  }, [safeData.matches, destaqueAgendamentoId]);

  const rankingJogadoresRacha = useMemo(() => {
    if (!destaqueAgendamentoId) return [];
    return rankPlayersForAgendamento(rankData, destaqueAgendamentoId);
  }, [rankData, destaqueAgendamentoId]);

  const top3Racha = useMemo(() => rankingJogadoresRacha.slice(0, 3), [rankingJogadoresRacha]);

  const melhorTimeRacha = useMemo(() => {
    if (!destaqueAgendamentoId) return null;
    return (
      sortTeamsByPerformance(
        rankTeamsForAgendamento(rankData, destaqueAgendamentoId)
      ).find((t) => t.games > 0) ?? null
    );
  }, [rankData, destaqueAgendamentoId]);

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
          Pontuação a partir de {rankingStartLabel}. Gol {POINTS_PER_GOAL} pts · vitória{" "}
          {POINTS_PER_WIN} pt · amarelo {POINTS_PER_YELLOW} pt. Times:{" "}
          {DEFAULT_RACHA_TEAM_NAMES.join(", ")}.
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

      <section className="rounded-lg border border-amber-900/35 bg-amber-950/15 p-3">
        <h2 className="text-sm font-semibold text-amber-200">Destaque do racha</h2>
        <select
          value={destaqueAgendamentoId}
          onChange={(e) => setDestaqueAgendamentoId(e.target.value)}
          className="mt-2 w-full max-w-xl rounded-lg border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-sm text-white"
        >
          <option value="">Selecione um racha…</option>
          {agendamentosOrdenados.map((a) => (
            <option key={a.id} value={a.id}>
              {new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR")}
              {a.time ? ` · ${a.time}` : ""}
              {a.title ? ` · ${a.title}` : ""}
            </option>
          ))}
        </select>

        {destaqueAgendamentoId && partidasNoRachaSelecionado.length === 0 && (
          <p className="mt-2 text-xs text-emerald-200/85">Sem jogos neste racha.</p>
        )}

        {destaqueAgendamentoId && partidasNoRachaSelecionado.length > 0 && (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold text-amber-200/95">Top 3 jogadores</h3>
              <ol className="mt-2 space-y-1.5">
                {top3Racha.length === 0 ? (
                  <li className="text-xs text-emerald-500/90">Nenhum ponto registrado.</li>
                ) : (
                  top3Racha.map((r, i) => (
                    <li
                      key={r.player.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-emerald-800/50 bg-pitch-950/40 px-2 py-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-200">{i + 1}º</span>
                        <span className="text-sm text-white">{r.player.name}</span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-amber-100/95">
                        {formatRankPoints(r.points)} pts
                      </span>
                    </li>
                  ))
                )}
              </ol>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-amber-200/95">Melhor time</h3>
              {melhorTimeRacha ? (
                <div className="mt-2 rounded-lg border border-amber-700/40 bg-amber-950/25 px-3 py-2">
                  <p className="text-base font-semibold text-white">{melhorTimeRacha.name}</p>
                  <p className="text-xs text-emerald-200/85">
                    {melhorTimeRacha.wins} vitória{melhorTimeRacha.wins !== 1 ? "s" : ""} ·{" "}
                    {melhorTimeRacha.games} jogo{melhorTimeRacha.games !== 1 ? "s" : ""}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-emerald-500/90">Sem vitórias registradas.</p>
              )}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-amber-200">Melhores jogadores</h2>
        {allPlayersSorted.length === 0 ? (
          <p className="mt-2 text-xs text-emerald-500/90">Nenhum jogador cadastrado.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-xs">
              <thead>
                <tr className="border-b border-emerald-800/80 text-emerald-400/90">
                  <th className="pb-1 pr-3">#</th>
                  <th className="pb-1 pr-3">Jogador</th>
                  <th className="pb-1 pr-3">Nível</th>
                  <th className="pb-1 pr-3 text-amber-200/95">Pts</th>
                  <th className="pb-1 pr-3">G</th>
                  <th className="pb-1 pr-3">V</th>
                  <th className="pb-1 pr-3">A</th>
                  <th className="pb-1">J</th>
                </tr>
              </thead>
              <tbody>
                {players.map((r, i) => (
                  <tr key={r.player.id} className="border-b border-emerald-900/50">
                    <td className="py-1.5 pr-3 text-emerald-500">{i + 1}</td>
                    <td className="py-1.5 pr-3 font-medium text-white">{r.player.name}</td>
                    <td className="py-1.5 pr-3">
                      <Stars value={r.player.stars} readOnly />
                    </td>
                    <td className="py-1.5 pr-3 font-medium tabular-nums text-amber-100/95">
                      {formatRankPoints(r.points)}
                    </td>
                    <td className="py-1.5 pr-3">{r.goals}</td>
                    <td className="py-1.5 pr-3">{r.wins}</td>
                    <td className="py-1.5 pr-3">{r.yellowCards}</td>
                    <td className="py-1.5">{r.games}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                <option value="win">Vitórias</option>
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

      <section>
        <h2 className="text-sm font-semibold text-amber-200">Melhores times</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[16rem] text-left text-xs">
            <thead>
              <tr className="border-b border-emerald-800/80 text-emerald-400/90">
                <th className="pb-1 pr-3">#</th>
                <th className="pb-1 pr-3">Time</th>
                <th className="pb-1 pr-3">Títulos</th>
                <th className="pb-1">Jogos</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t, i) => (
                <tr key={t.name} className="border-b border-emerald-900/50">
                  <td className="py-1.5 pr-3 text-emerald-500">{i + 1}</td>
                  <td className="py-1.5 pr-3 font-medium text-white">{t.name}</td>
                  <td className="py-1.5 pr-3">{t.wins}</td>
                  <td className="py-1.5">{t.games}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {goalkeepersLeak.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-amber-200">Goleiros (mais vazados)</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[24rem] text-left text-xs">
              <thead>
                <tr className="border-b border-emerald-800/80 text-emerald-400/90">
                  <th className="pb-1 pr-3">#</th>
                  <th className="pb-1 pr-3">Goleiro</th>
                  <th className="pb-1 pr-3">Jogos</th>
                  <th className="pb-1 pr-3">Sofridos</th>
                  <th className="pb-1">Média</th>
                </tr>
              </thead>
              <tbody>
                {goalkeepersLeak.map((r, i) => (
                  <tr key={r.player.id} className="border-b border-emerald-900/50">
                    <td className="py-1.5 pr-3 text-emerald-500">{i + 1}</td>
                    <td className="py-1.5 pr-3 font-medium text-white">{r.player.name}</td>
                    <td className="py-1.5 pr-3">{r.games}</td>
                    <td className="py-1.5 pr-3">{r.goalsConceded}</td>
                    <td className="py-1.5 tabular-nums">
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
        </section>
      )}
    </div>
  );
}
