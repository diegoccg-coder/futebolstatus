import { effectiveWinnerTeamIndex, fieldTeamIndexesSafe } from "./matchUi";
import type { AppData, Match, Player } from "./types";

export type PlayerRankRow = {
  player: Player;
  goals: number;
  assists: number;
  wins: number;
  games: number;
};

export type TeamRankRow = {
  name: string;
  wins: number;
  games: number;
};

function playerOnField(m: Match, playerId: string): boolean {
  for (const i of fieldTeamIndexesSafe(m)) {
    if (m.teams[i]?.playerIds.includes(playerId)) return true;
  }
  return false;
}

function playerWon(m: Match, playerId: string): boolean {
  const w = effectiveWinnerTeamIndex(m);
  if (w === null) return false;
  return m.teams[w]?.playerIds.includes(playerId) ?? false;
}

export function rankPlayers(data: Pick<AppData, "players" | "matches">): PlayerRankRow[] {
  const map = new Map<string, PlayerRankRow>();

  for (const p of data.players) {
    map.set(p.id, {
      player: p,
      goals: 0,
      assists: 0,
      wins: 0,
      games: 0,
    });
  }

  for (const m of data.matches) {
    for (const p of data.players) {
      if (!playerOnField(m, p.id)) continue;
      const row = map.get(p.id)!;
      row.games += 1;
      if (playerWon(m, p.id)) row.wins += 1;
    }
    for (const g of m.goals) {
      if (!playerOnField(m, g.scorerId)) continue;
      const scorer = map.get(g.scorerId);
      if (scorer) scorer.goals += 1;
      if (g.assistId && playerOnField(m, g.assistId)) {
        const ast = map.get(g.assistId);
        if (ast) ast.assists += 1;
      }
    }
  }

  return [...map.values()].sort((a, b) => {
    if (b.goals !== a.goals) return b.goals - a.goals;
    if (b.assists !== a.assists) return b.assists - a.assists;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.player.name.localeCompare(b.player.name);
  });
}

export function rankTeams(data: Pick<AppData, "players" | "matches">): TeamRankRow[] {
  const map = new Map<string, { wins: number; games: number }>();

  for (const m of data.matches) {
    for (const i of fieldTeamIndexesSafe(m)) {
      const t = m.teams[i];
      if (!t) continue;
      const name = t.name.trim() || "Time";
      if (!map.has(name)) map.set(name, { wins: 0, games: 0 });
      map.get(name)!.games += 1;
    }
    const w = effectiveWinnerTeamIndex(m);
    if (w !== null) {
      const winner = m.teams[w];
      if (winner) {
        const name = winner.name.trim() || "Time";
        if (!map.has(name)) map.set(name, { wins: 0, games: 0 });
        map.get(name)!.wins += 1;
      }
    }
  }

  return [...map.entries()]
    .map(([name, v]) => ({ name, wins: v.wins, games: v.games }))
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.name.localeCompare(b.name);
    });
}
