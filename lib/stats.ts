import {
  agendamentoCountsForRanking,
  DEFAULT_RACHA_TEAM_NAMES,
  normalizeTeamNameForRanking,
  RANKING_START_DATE,
} from "./ranking-defaults";

import {
  effectiveWinnerTeamIndex,
  fieldTeamIndexesSafe,
  rachaDraftGoleiroPlayerIds,
} from "./matchUi";

import {

  POINTS_PER_ASSIST,

  POINTS_PER_GOAL,

  POINTS_PER_YELLOW,

  pointsFromCounts,

} from "./scoring";

import type { Agendamento, AppData, LastDraft, Match, Player } from "./types";



export type PlayerRankRow = {

  player: Player;

  goals: number;

  assists: number;

  games: number;

  /** Cartões amarelos (cada um −1 ponto). */

  yellowCards: number;

  /** Total: gol 3 pts, assistência 1 pt, amarelo −1 pt. */

  points: number;

};



/** Uma linha no extrato de pontos do jogador (por partida / evento). */

export type PlayerPointEvent = {

  matchId: string;

  date: string;

  weekLabel?: string;

  kind: "goal" | "assist" | "yellow";

  points: number;

  label: string;

};



export type TeamRankRow = {

  name: string;

  wins: number;

  games: number;

};



export type GoalkeeperLeakRow = {

  player: Player;

  goalsConceded: number;

  games: number;

  averageConceded: number;

};



type RankData = Pick<AppData, "players" | "matches"> & {
  draftsByAgendamento?: Record<string, LastDraft>;
  agendamentos?: Agendamento[];
};

function matchEffectiveDate(m: Match, agendamentos: Agendamento[]): string {
  if (m.agendamentoId) {
    const ag = agendamentos.find((a) => a.id === m.agendamentoId);
    if (ag) return ag.date;
  }
  return m.date;
}

/** Partidas que entram na pontuação geral (a partir de RANKING_START_DATE). */
export function matchesCountedInRanking(data: RankData): Match[] {
  const agendamentos = data.agendamentos ?? [];
  return data.matches.filter((m) =>
    agendamentoCountsForRanking(matchEffectiveDate(m, agendamentos))
  );
}

export { RANKING_START_DATE };



function playerOnField(m: Match, playerId: string): boolean {

  for (const i of fieldTeamIndexesSafe(m)) {

    if (m.teams[i]?.playerIds.includes(playerId)) return true;

  }

  return false;

}



function goalkeeperOnMatch(

  m: Match,

  playerId: string,

  draftsByAgendamento: Record<string, LastDraft>

): boolean {

  return rachaDraftGoleiroPlayerIds(m, draftsByAgendamento).has(playerId);

}



function goalCountsForScorer(

  m: Match,

  g: { scorerId: string; scorerFromBench?: boolean },

  player: Player,

  draftsByAgendamento: Record<string, LastDraft>

): boolean {

  if (player.category === "goleiro") {

    return goalkeeperOnMatch(m, g.scorerId, draftsByAgendamento);

  }

  return playerOnField(m, g.scorerId) || Boolean(g.scorerFromBench);

}

function assistCountsForPlayer(

  m: Match,

  g: { assistId?: string | null; assistFromBench?: boolean },

  playerId: string

): boolean {

  if (!g.assistId || g.assistId !== playerId) return false;

  return playerOnField(m, playerId) || Boolean(g.assistFromBench);

}



export function rankPlayers(
  data: RankData,
  options?: { matches?: Match[] }
): PlayerRankRow[] {
  const drafts = data.draftsByAgendamento ?? {};
  const matches = options?.matches ?? matchesCountedInRanking(data);

  const map = new Map<string, PlayerRankRow>();
  const linhaPlayers = data.players.filter((p) => p.category !== "goleiro");

  for (const p of data.players) {
    map.set(p.id, {
      player: p,
      goals: 0,
      assists: 0,
      games: 0,
      yellowCards: 0,
      points: 0,
    });
  }

  for (const m of matches) {

    for (const p of linhaPlayers) {

      if (!playerOnField(m, p.id)) continue;

      const row = map.get(p.id)!;

      row.games += 1;

      for (const yid of m.cartoesAmarelos) {

        if (yid === p.id) row.yellowCards += 1;

      }

    }

    for (const g of m.goals) {

      const scorer = map.get(g.scorerId);

      if (!scorer) continue;

      if (goalCountsForScorer(m, g, scorer.player, drafts)) {

        scorer.goals += 1;

      }

      if (g.assistId) {

        const assister = map.get(g.assistId);

        if (assister && assistCountsForPlayer(m, g, g.assistId)) {

          assister.assists += 1;

        }

      }

    }

  }



  for (const row of map.values()) {

    row.points = pointsFromCounts(row.goals, row.assists, row.yellowCards);

  }



  return [...map.values()]

    .filter(

      (r) => r.points > 0 || r.games > 0 || r.goals > 0 || r.assists > 0

    )

    .sort((a, b) => {

      if (b.points !== a.points) return b.points - a.points;

      if (b.goals !== a.goals) return b.goals - a.goals;

      if (b.assists !== a.assists) return b.assists - a.assists;

      return a.player.name.localeCompare(b.player.name);

    });

}



/**

 * Extrato cronológico (mais recente primeiro) do que gerou ou tirou pontos.

 */

export function playerPointEvents(

  data: RankData,

  playerId: string

): PlayerPointEvent[] {

  const drafts = data.draftsByAgendamento ?? {};

  const player = data.players.find((p) => p.id === playerId);

  const events: PlayerPointEvent[] = [];



  const matches = [...matchesCountedInRanking(data)].sort((a, b) => {
    const da = a.date.localeCompare(b.date);
    if (da !== 0) return -da;
    return b.id.localeCompare(a.id);
  });

  for (const m of matches) {

    const onField = playerOnField(m, playerId);

    const isGk = player?.category === "goleiro";



    if (onField && !isGk) {

      for (const yid of m.cartoesAmarelos) {

        if (yid !== playerId) continue;

        events.push({

          matchId: m.id,

          date: m.date,

          weekLabel: m.weekLabel,

          kind: "yellow",

          points: POINTS_PER_YELLOW,

          label: "Cartão amarelo",

        });

      }

    }



    for (const g of m.goals) {

      if (g.scorerId !== playerId || !player) continue;

      if (!goalCountsForScorer(m, g, player, drafts)) continue;

      events.push({

        matchId: m.id,

        date: m.date,

        weekLabel: m.weekLabel,

        kind: "goal",

        points: POINTS_PER_GOAL,

        label:

          player.category === "goleiro"

            ? "Gol (goleiro)"

            : g.scorerFromBench

              ? "Gol (substituto)"

              : "Gol",

      });

    }

    for (const g of m.goals) {

      if (!g.assistId || g.assistId !== playerId || !player) continue;

      if (!assistCountsForPlayer(m, g, playerId)) continue;

      events.push({

        matchId: m.id,

        date: m.date,

        weekLabel: m.weekLabel,

        kind: "assist",

        points: POINTS_PER_ASSIST,

        label: g.assistFromBench ? "Assistência (substituto)" : "Assistência",

      });

    }

  }



  const kindOrder: Record<PlayerPointEvent["kind"], number> = {

    goal: 0,

    assist: 1,

    yellow: 2,

  };

  events.sort((a, b) => {

    const da = a.date.localeCompare(b.date);

    if (da !== 0) return -da;

    const mid = b.matchId.localeCompare(a.matchId);

    if (mid !== 0) return mid;

    return kindOrder[a.kind] - kindOrder[b.kind];

  });



  return events;

}



/** Partidas só do racha (agendamento) indicado — mesma regra de pontos do ranking geral. */

export function rankPlayersForAgendamento(
  data: RankData,
  agendamentoId: string
): PlayerRankRow[] {
  const agendamentos = data.agendamentos ?? [];
  const ag = agendamentos.find((a) => a.id === agendamentoId);
  if (ag && !agendamentoCountsForRanking(ag.date)) return [];
  const matches = data.matches.filter((m) => m.agendamentoId === agendamentoId);
  return rankPlayers(data, { matches });
}



export function rankTeamsForAgendamento(
  data: RankData,
  agendamentoId: string
): TeamRankRow[] {
  const agendamentos = data.agendamentos ?? [];
  const ag = agendamentos.find((a) => a.id === agendamentoId);
  if (ag && !agendamentoCountsForRanking(ag.date)) {
    return DEFAULT_RACHA_TEAM_NAMES.map((name) => ({ name, wins: 0, games: 0 }));
  }
  return rankTeams(data, {
    matches: data.matches.filter((m) => m.agendamentoId === agendamentoId),
  });
}



/** Melhor / vice: mais vitórias no racha; empate desempata por mais jogos, depois nome. */

export function sortTeamsByPerformance(rows: TeamRankRow[]): TeamRankRow[] {

  return [...rows].sort((a, b) => {

    if (b.wins !== a.wins) return b.wins - a.wins;

    if (b.games !== a.games) return b.games - a.games;

    return a.name.localeCompare(b.name, "pt-BR");

  });

}



export function rankTeams(
  data: RankData,
  options?: { matches?: Match[] }
): TeamRankRow[] {
  const map = new Map<string, { wins: number; games: number }>();
  const matches = options?.matches ?? matchesCountedInRanking(data);

  for (const name of DEFAULT_RACHA_TEAM_NAMES) {
    map.set(name, { wins: 0, games: 0 });
  }

  for (const m of matches) {

    for (const i of fieldTeamIndexesSafe(m)) {

      const t = m.teams[i];

      if (!t) continue;

      const canon = normalizeTeamNameForRanking(t.name);

      if (!canon) continue;

      map.get(canon)!.games += 1;

    }

    const w = effectiveWinnerTeamIndex(m);

    if (w !== null) {

      const winner = m.teams[w];

      if (!winner) continue;

      const canon = normalizeTeamNameForRanking(winner.name);

      if (!canon) continue;

      map.get(canon)!.wins += 1;

    }

  }



  return DEFAULT_RACHA_TEAM_NAMES.map((name) => ({

    name,

    wins: map.get(name)!.wins,

    games: map.get(name)!.games,

  }));

}



export function rankGoalkeepersMostConceded(
  data: RankData,
  options?: { matches?: Match[] }
): GoalkeeperLeakRow[] {

  const rows = new Map<string, GoalkeeperLeakRow>();

  const goalkeepers = data.players.filter((p) => p.category === "goleiro");

  for (const p of goalkeepers) {

    rows.set(p.id, {

      player: p,

      goalsConceded: 0,

      games: 0,

      averageConceded: 0,

    });

  }



  const rankedMatches = options?.matches ?? matchesCountedInRanking(data);

  for (const m of rankedMatches) {
    if (!m.agendamentoId) continue;
    if (m.placarField0 === null || m.placarField1 === null) continue;

    const draft = data.draftsByAgendamento?.[m.agendamentoId];

    if (!draft) continue;



    const golEntrada = draft.golEntradaPlayerId ?? null;

    const golFundo = draft.golFundoPlayerId ?? null;



    // Convenção atual: placarField0 = gols do time no campo A; placarField1 = campo B.

    // Assim, goleiro do Gol 1 (entrada/campo A) sofre placarField1 e goleiro do Gol 2 (fundo/campo B) sofre placarField0.

    if (golEntrada && rows.has(golEntrada)) {

      const row = rows.get(golEntrada)!;

      row.games += 1;

      row.goalsConceded += m.placarField1;

    }

    if (golFundo && rows.has(golFundo)) {

      const row = rows.get(golFundo)!;

      row.games += 1;

      row.goalsConceded += m.placarField0;

    }

  }



  const result = [...rows.values()].map((r) => ({

    ...r,

    averageConceded: r.games > 0 ? Number((r.goalsConceded / r.games).toFixed(2)) : 0,

  }));



  return result.sort((a, b) => {

    if (b.goalsConceded !== a.goalsConceded) return b.goalsConceded - a.goalsConceded;

    if (b.games !== a.games) return b.games - a.games;

    return a.player.name.localeCompare(b.player.name, "pt-BR");

  });

}

export function rankGoalkeepersForAgendamento(
  data: RankData,
  agendamentoId: string
): GoalkeeperLeakRow[] {
  const agendamentos = data.agendamentos ?? [];
  const ag = agendamentos.find((a) => a.id === agendamentoId);
  if (ag && !agendamentoCountsForRanking(ag.date)) return [];
  const matches = data.matches.filter((m) => m.agendamentoId === agendamentoId);
  return rankGoalkeepersMostConceded(data, { matches }).filter((r) => r.games > 0);
}

