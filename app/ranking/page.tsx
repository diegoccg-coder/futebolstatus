"use client";

import Link from "next/link";
import { Stars } from "@/components/Stars";
import { DEFAULT_RACHA_TEAM_NAMES } from "@/lib/ranking-defaults";
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
  type PlayerRankRow,
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

  async function resetMatches() {
    if (
      !confirm(
        "Isso apaga todo o histórico de jogos cadastrados. Continuar?"
      )
    ) {
      return;
    }
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

  const players = rankPlayers(safeData);
  const teams = rankTeams(safeData);
  const goalkeepersLeak = rankGoalkeepersMostConceded(safeData);
  const allPlayersSorted = useMemo(
    () =>
      [...safeData.players].sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR")
      ),
    [safeData.players]
  );

  const pointEvents = useMemo(() => {
    if (!detailPlayerId) return [];
    return playerPointEvents(safeData, detailPlayerId);
  }, [safeData, detailPlayerId]);

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
      [...safeData.agendamentos].sort((a, b) => {
        const d = b.date.localeCompare(a.date);
        return d !== 0 ? d : b.id.localeCompare(a.id);
      }),
    [safeData.agendamentos]
  );

  const partidasNoRachaSelecionado = useMemo(() => {
    if (!destaqueAgendamentoId) return [];
    return safeData.matches.filter((m) => m.agendamentoId === destaqueAgendamentoId);
  }, [safeData.matches, destaqueAgendamentoId]);

  const rankingJogadoresRacha: PlayerRankRow[] = useMemo(() => {
    if (!destaqueAgendamentoId) return [];
    return rankPlayersForAgendamento(safeData, destaqueAgendamentoId);
  }, [safeData, destaqueAgendamentoId]);

  const top3Racha = useMemo(
    () => rankingJogadoresRacha.slice(0, 3),
    [rankingJogadoresRacha]
  );

  const timesOrdenadosRacha = useMemo(() => {
    if (!destaqueAgendamentoId) return [];
    return sortTeamsByPerformance(
      rankTeamsForAgendamento(safeData, destaqueAgendamentoId)
    );
  }, [safeData, destaqueAgendamentoId]);

  if (loading) return <p className="text-emerald-200/80">Carregando…</p>;
  if (error || !data) return <p className="text-red-300">{error ?? "Erro"}</p>;

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Ranking</h1>
        <p className="mt-1 text-sm text-emerald-100/75">
          <strong>Pontuação do ranking:</strong> gol {POINTS_PER_GOAL} pts; vitória{" "}
          {POINTS_PER_WIN} pt; cartão amarelo {POINTS_PER_YELLOW} pt. Vitórias valem só para quem
          estava <strong>em campo</strong>. Goleiros podem marcar gol (2 pts) se estiverem no Gol 1
          ou Gol 2 do sorteio.
          Vitórias usam o campeão cadastrado ou o <strong>placar</strong> (e pênaltis, se marcados).
          Na tabela de times: <strong>{DEFAULT_RACHA_TEAM_NAMES.join(", ")}</strong> — outros nomes
          não entram; &quot;Azul&quot; antigo conta como Verde.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-lg border border-emerald-700 px-3 py-1.5 text-sm text-emerald-200 hover:bg-emerald-900/40"
          >
            Atualizar ranking
          </button>
          {isAdmin && (
            <button
              type="button"
              disabled={resetting}
              onClick={() => void resetMatches()}
              className="rounded-lg border border-amber-700/70 bg-amber-950/30 px-3 py-1.5 text-sm text-amber-200/95 hover:bg-amber-950/50 disabled:opacity-50"
            >
              {resetting ? "Zerando…" : "Zerar histórico de jogos (admin)"}
            </button>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-amber-900/35 bg-amber-950/15 p-5">
        <h2 className="font-display text-lg font-semibold text-amber-200">
          Destaque do racha
        </h2>
        <p className="mt-1 text-sm text-emerald-100/75">
          Escolha um racha na agenda para ver o top 3 em <strong>pontos</strong> (só jogos
          daquele dia) e o melhor time / vice com base em <strong>vitórias</strong> no racha.
        </p>
        <label className="mt-4 block max-w-xl">
          <span className="text-xs text-emerald-300/90">Racha</span>
          <select
            value={destaqueAgendamentoId}
            onChange={(e) => setDestaqueAgendamentoId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
          >
            <option value="">Selecione um racha…</option>
            {agendamentosOrdenados.map((a) => (
              <option key={a.id} value={a.id}>
                {new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR")}
                {a.time ? ` às ${a.time}` : ""}
                {a.title ? ` · ${a.title}` : ""}
                {a.campo ? ` · Campo ${a.campo}` : ""}
              </option>
            ))}
          </select>
        </label>

        {!destaqueAgendamentoId && (
          <p className="mt-4 text-sm text-emerald-500/90">
            Selecione um racha para carregar o pódio e os times em destaque.
          </p>
        )}

        {destaqueAgendamentoId && partidasNoRachaSelecionado.length === 0 && (
          <p className="mt-4 text-sm text-emerald-200/85">
            Ainda não há <strong>jogos cadastrados</strong> vinculados a este racha. Use a
            página <strong>Jogos</strong> para lançar partidas antes do destaque aparecer.
          </p>
        )}

        {destaqueAgendamentoId && partidasNoRachaSelecionado.length > 0 && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-amber-200/95">
                Top 3 jogadores (pontos no racha)
              </h3>
              <ol className="mt-3 space-y-3">
                {top3Racha.map((r, i) => (
                  <li
                    key={r.player.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-800/50 bg-pitch-950/40 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-sm font-bold text-amber-200">
                        {i + 1}º
                      </span>
                      <div>
                        <p className="font-medium text-white">{r.player.name}</p>
                        <p className="text-xs text-emerald-400/90">
                          {r.goals} gol{r.goals !== 1 ? "s" : ""} · {r.wins} vit.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Stars value={r.player.stars} readOnly />
                      <span className="text-lg font-semibold tabular-nums text-amber-100/95">
                        {formatRankPoints(r.points)} pts
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-200/95">
                Times (vitórias no racha)
              </h3>
              <div className="mt-3 space-y-3">
                {timesOrdenadosRacha[0] && timesOrdenadosRacha[0].games > 0 && (
                  <div className="rounded-xl border border-amber-700/40 bg-amber-950/25 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-amber-300/90">
                      Melhor time
                    </p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {timesOrdenadosRacha[0].name}
                    </p>
                    <p className="text-sm text-emerald-200/85">
                      {timesOrdenadosRacha[0].wins} vitória
                      {timesOrdenadosRacha[0].wins !== 1 ? "s" : ""} ·{" "}
                      {timesOrdenadosRacha[0].games} jogo
                      {timesOrdenadosRacha[0].games !== 1 ? "s" : ""}
                    </p>
                  </div>
                )}
                {timesOrdenadosRacha[1] && timesOrdenadosRacha[1].games > 0 && (
                  <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-400/90">
                      Vice
                    </p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {timesOrdenadosRacha[1].name}
                    </p>
                    <p className="text-sm text-emerald-200/85">
                      {timesOrdenadosRacha[1].wins} vitória
                      {timesOrdenadosRacha[1].wins !== 1 ? "s" : ""} ·{" "}
                      {timesOrdenadosRacha[1].games} jogo
                      {timesOrdenadosRacha[1].games !== 1 ? "s" : ""}
                    </p>
                  </div>
                )}
                {!timesOrdenadosRacha.some((t) => t.games > 0) && (
                  <p className="text-sm text-emerald-500/90">
                    Nenhum dos times entrou em campo neste racha (sem jogos com times nos
                    padrões Verde / Amarelo / Preto / Laranja).
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-amber-200">
          Melhores jogadores
        </h2>
        {allPlayersSorted.length === 0 ? (
          <p className="mt-3 text-sm text-emerald-500/90">
            Cadastre jogadores em <strong>Admin · Jogadores</strong> para ver o ranking.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b border-emerald-800/80 text-emerald-400/90">
                  <th className="pb-2 pr-4">#</th>
                  <th className="pb-2 pr-4">Jogador</th>
                  <th className="pb-2 pr-4">Nível</th>
                  <th className="pb-2 pr-4 font-semibold text-amber-200/95">Pontos</th>
                  <th className="pb-2 pr-4">Gols</th>
                  <th className="pb-2 pr-4">Vitórias</th>
                  <th className="pb-2 pr-4">Amarelos</th>
                  <th className="pb-2">Jogos</th>
                </tr>
              </thead>
              <tbody>
                {players.map((r, i) => (
                  <tr key={r.player.id} className="border-b border-emerald-900/50">
                    <td className="py-2.5 pr-4 text-emerald-500">{i + 1}</td>
                    <td className="py-2.5 pr-4 font-medium text-white">{r.player.name}</td>
                    <td className="py-2.5 pr-4">
                      <Stars value={r.player.stars} readOnly />
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-amber-100/95 tabular-nums">
                      {formatRankPoints(r.points)}
                    </td>
                    <td className="py-2.5 pr-4">{r.goals}</td>
                    <td className="py-2.5 pr-4">{r.wins}</td>
                    <td className="py-2.5 pr-4">{r.yellowCards}</td>
                    <td className="py-2.5">{r.games}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {allPlayersSorted.length > 0 && (
        <section className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-5">
          <h2 className="font-display text-lg font-semibold text-amber-200">
            Extrato de pontos por jogador
          </h2>
          <p className="mt-1 text-sm text-emerald-100/75">
            Escolha um jogador e, se quiser, filtre por tipo de evento para ver só ganhos, só
            perdas ou um tipo específico (gol, vitória, amarelo).
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <label className="block min-w-[12rem]">
              <span className="text-xs text-emerald-300/90">Jogador</span>
              <select
                value={detailPlayerId}
                onChange={(e) => {
                  setDetailPlayerId(e.target.value);
                  setEventFilter("all");
                }}
                className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
              >
                <option value="">Selecionar…</option>
                {allPlayersSorted.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block min-w-[11rem]">
              <span className="text-xs text-emerald-300/90">Filtro</span>
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value as EventFilter)}
                disabled={!detailPlayerId}
                className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white disabled:opacity-50"
              >
                <option value="all">Todos os eventos</option>
                <option value="gain">Só pontos ganhos</option>
                <option value="loss">Só pontos perdidos</option>
                <option value="goal">Gols</option>
                <option value="win">Vitórias</option>
                <option value="yellow">Cartões amarelos</option>
              </select>
            </label>
          </div>
          {!detailPlayerId ? (
            <p className="mt-4 text-sm text-emerald-500/90">
              Selecione um jogador para listar partida a partida o que somou ou descontou.
            </p>
          ) : (
            <>
              <p className="mt-4 text-sm text-emerald-200/90">
                Total no ranking:{" "}
                <strong className="text-amber-200/95">
                  {formatRankPoints(detailTotalPoints ?? 0)} pts
                </strong>
                {eventFilter !== "all" && (
                  <span className="text-emerald-400/90">
                    {" "}
                    · Soma só desta lista:{" "}
                    <strong
                      className={
                        filteredPointsSum >= 0 ? "text-emerald-300" : "text-red-300/90"
                      }
                    >
                      {filteredPointsSum > 0 ? "+" : ""}
                      {formatRankPoints(filteredPointsSum)} pts
                    </strong>
                  </span>
                )}
              </p>
              {filteredPointEvents.length === 0 ? (
                <p className="mt-3 text-sm text-emerald-500/90">
                  Nenhum evento com este filtro.
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[22rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-emerald-800/80 text-emerald-400/90">
                        <th className="pb-2 pr-4">Data</th>
                        <th className="pb-2 pr-4">Evento</th>
                        <th className="pb-2 pr-4 text-right">Pontos</th>
                        <th className="pb-2">Jogo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPointEvents.map((e, idx) => (
                        <tr
                          key={`${e.matchId}-${e.kind}-${e.date}-${idx}`}
                          className="border-b border-emerald-900/50"
                        >
                          <td className="py-2.5 pr-4 whitespace-nowrap text-emerald-200/90">
                            {new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR")}
                            {e.weekLabel ? ` · ${e.weekLabel}` : ""}
                          </td>
                          <td className="py-2.5 pr-4 text-emerald-100/90">{e.label}</td>
                          <td
                            className={`py-2.5 pr-4 text-right font-medium tabular-nums ${
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
                          <td className="py-2.5">
                            <Link
                              href={`/jogos/${e.matchId}`}
                              className="text-amber-400/95 underline hover:text-amber-300"
                            >
                              Abrir
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
        <h2 className="font-display text-lg font-semibold text-amber-200">
          Melhores times (por títulos)
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[20rem] text-left text-sm">
            <thead>
              <tr className="border-b border-emerald-800/80 text-emerald-400/90">
                <th className="pb-2 pr-4">#</th>
                <th className="pb-2 pr-4">Time</th>
                <th className="pb-2 pr-4">Títulos</th>
                <th className="pb-2">Jogos</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t, i) => (
                <tr key={t.name} className="border-b border-emerald-900/50">
                  <td className="py-2.5 pr-4 text-emerald-500">{i + 1}</td>
                  <td className="py-2.5 pr-4 font-medium text-white">{t.name}</td>
                  <td className="py-2.5 pr-4">{t.wins}</td>
                  <td className="py-2.5">{t.games}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-amber-200">
          Ranking de goleiros (mais vazado)
        </h2>
        <p className="mt-1 text-sm text-emerald-100/75">
          Considera os goleiros vinculados no sorteio do racha (Gol 1 entrada e Gol 2 fundo) e o
          placar cadastrado em cada jogo.
        </p>
        {goalkeepersLeak.length === 0 ? (
          <p className="mt-3 text-sm text-emerald-500/90">
            Cadastre goleiros em <strong>Admin · Jogadores</strong> para ver este ranking.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="border-b border-emerald-800/80 text-emerald-400/90">
                  <th className="pb-2 pr-4">#</th>
                  <th className="pb-2 pr-4">Goleiro</th>
                  <th className="pb-2 pr-4">Jogos no gol</th>
                  <th className="pb-2 pr-4">Gols sofridos</th>
                  <th className="pb-2">Média sofrida</th>
                </tr>
              </thead>
              <tbody>
                {goalkeepersLeak.map((r, i) => (
                  <tr key={r.player.id} className="border-b border-emerald-900/50">
                    <td className="py-2.5 pr-4 text-emerald-500">{i + 1}</td>
                    <td className="py-2.5 pr-4 font-medium text-white">{r.player.name}</td>
                    <td className="py-2.5 pr-4">{r.games}</td>
                    <td className="py-2.5 pr-4 text-amber-100/95">{r.goalsConceded}</td>
                    <td className="py-2.5 tabular-nums">
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
      </section>
    </div>
  );
}
