import { DEFAULT_RACHA_TEAM_NAMES } from "./ranking-defaults";
import { sortMatchesChronologically } from "./matchUi";
import type { Match, MatchTeamSlot } from "./types";

export const COLOR_NAMES = DEFAULT_RACHA_TEAM_NAMES;

export function compareMatchCreationOrder(a: Match, b: Match): number {
  return sortMatchesChronologically(a, b);
}

function isGenericName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    n === "time a" ||
    n === "time b" ||
    n === "time c" ||
    n === "time d" ||
    n === "time 1" ||
    n === "time 2" ||
    n === "time 3" ||
    n === "time 4"
  );
}

export function displayTeamName(name: string, idx: number): string {
  if (!name.trim() || isGenericName(name)) {
    return COLOR_NAMES[idx] ?? `Time ${idx + 1}`;
  }
  return name;
}

/** Nome do time com posição na fila do sorteio (ex.: «2º · Diego»). */
export function formatTeamLabelWithFila(
  team: { name: string; rotationOrder: number },
  idx: number
): string {
  const name = displayTeamName(team.name, idx);
  const order = team.rotationOrder;
  if (order > 0) return `${order}º · ${name}`;
  return name;
}

export function emptyTeams(n: 2 | 3 | 4): MatchTeamSlot[] {
  const labels = DEFAULT_RACHA_TEAM_NAMES.slice(0, n);
  return labels.map((name, i) => ({
    name,
    playerIds: [],
    rotationOrder: i + 1,
  }));
}

export function computeQueueAfterGames(
  teamCount: number,
  jogos: Array<{
    fieldTeamIndexes: number[];
    championTeamIndex: number | null;
    drawResult: boolean;
  }>
): number[] {
  let queue = Array.from({ length: teamCount }, (_, i) => i);
  for (const j of jogos) {
    if (!Array.isArray(j.fieldTeamIndexes) || j.fieldTeamIndexes.length < 2) continue;
    const [a, b] = j.fieldTeamIndexes;
    if (a === b) continue;
    if (j.drawResult) {
      if (teamCount >= 4) {
        const rest = queue.filter((x) => x !== a && x !== b);
        queue = [...rest, a, b];
      }
      continue;
    }
    if (j.championTeamIndex === null) continue;
    const winner = j.championTeamIndex;
    if (winner !== a && winner !== b) continue;
    const loser = winner === a ? b : a;
    const rest = queue.filter((x) => x !== winner && x !== loser);
    queue = [winner, ...rest, loser];
  }
  return queue;
}

export function sortMatchesForRacha(matches: Match[]): Match[] {
  return [...matches].sort(compareMatchCreationOrder);
}
