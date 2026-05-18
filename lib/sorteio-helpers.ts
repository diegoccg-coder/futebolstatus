import { shuffle } from "./balance";
import type { Player } from "./types";

export type DrawSlotRow = {
  index: number;
  playerIds: string[];
  players: Player[];
  sumStars: number;
  rotationOrder: number;
};

export type DrawRunResult = {
  teamCount: number;
  teams: DrawSlotRow[];
  /** Goleiro sorteado para o gol da entrada (não entra no balanceamento dos times). */
  golEntradaPlayerId: string | null;
  /** Goleiro sorteado para o gol do fundo. */
  golFundoPlayerId: string | null;
};

/** Sorteia quais goleiros ficam no gol 1 (entrada) e gol 2 (fundo); se houver só um, só a entrada. */
export function assignGoalkeepersToGols(selectedGoleiroIds: string[]): {
  golEntradaPlayerId: string | null;
  golFundoPlayerId: string | null;
} {
  const uniq = [...new Set(selectedGoleiroIds.filter(Boolean))];
  if (uniq.length === 0) {
    return { golEntradaPlayerId: null, golFundoPlayerId: null };
  }
  const shuffled = shuffle(uniq);
  if (shuffled.length === 1) {
    return { golEntradaPlayerId: shuffled[0]!, golFundoPlayerId: null };
  }
  return {
    golEntradaPlayerId: shuffled[0]!,
    golFundoPlayerId: shuffled[1]!,
  };
}

export function pushDrawFifo(
  slots: Array<DrawRunResult | null>,
  draw: DrawRunResult
): { slots: Array<DrawRunResult | null>; filledIndex: number } {
  const next = [...slots] as Array<DrawRunResult | null>;
  const emptyIdx = next.findIndex((s) => s === null);
  if (emptyIdx >= 0) {
    next[emptyIdx] = draw;
    return { slots: next, filledIndex: emptyIdx };
  }
  for (let i = 0; i < 4; i++) next[i] = next[i + 1];
  next[4] = draw;
  return { slots: next, filledIndex: 4 };
}

export function sumStarsIds(ids: string[], byId: Map<string, Player>): number {
  return ids.reduce((s, id) => s + (byId.get(id)?.stars ?? 0), 0);
}

export function movePlayerBetweenTeams(
  teams: DrawSlotRow[],
  fromTeamIdx: number,
  toTeamIdx: number,
  playerId: string,
  byId: Map<string, Player>
): DrawSlotRow[] {
  if (fromTeamIdx === toTeamIdx) return teams;
  const next = teams.map((t) => ({
    ...t,
    playerIds: [...t.playerIds],
    players: [...t.players],
  }));
  const from = next[fromTeamIdx];
  const to = next[toTeamIdx];
  if (!from || !to) return teams;
  const pi = from.playerIds.indexOf(playerId);
  if (pi < 0) return teams;
  const p = byId.get(playerId);
  if (!p) return teams;
  from.playerIds.splice(pi, 1);
  from.players = from.playerIds
    .map((id) => byId.get(id))
    .filter((x): x is Player => x != null);
  from.sumStars = sumStarsIds(from.playerIds, byId);
  if (!to.playerIds.includes(playerId)) {
    to.playerIds.push(playerId);
    to.players = to.playerIds
      .map((id) => byId.get(id))
      .filter((x): x is Player => x != null);
    to.sumStars = sumStarsIds(to.playerIds, byId);
  }
  return next;
}
