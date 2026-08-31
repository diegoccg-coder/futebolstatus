import { effectiveWinnerTeamIndex } from "./matchUi";
import type { Match } from "./types";

export type GameResultInput = {
  fieldTeamIndexes: number[];
  championTeamIndex: number | null;
  drawResult: boolean;
};

function toGameResult(m: Match): GameResultInput {
  const winner = m.drawResult ? null : effectiveWinnerTeamIndex(m);
  return {
    fieldTeamIndexes: m.fieldTeamIndexes,
    championTeamIndex: winner,
    drawResult: m.drawResult,
  };
}

/**
 * Próximo confronto no racha "rei da quadra":
 * 1º jogo: times 1 e 2 (ordem de rotação)
 * Depois: vencedor enfrenta o próximo time na sequência
 * Empate: ambos saem; entram os próximos dois times disponíveis
 */
export function computeKingOfHillNextMatch(
  rotationIndexes: number[],
  games: GameResultInput[]
): [number, number] {
  const n = rotationIndexes.length;
  if (n < 2) return [0, Math.min(1, n - 1)];

  if (games.length === 0) {
    return [rotationIndexes[0]!, rotationIndexes[1]!];
  }

  let king: number | null = null;
  let nextRotationPtr = 2;
  let outFromLastDraw: number[] = [];
  let afterDoubleDraw = false;
  let currentLineup: [number, number] | null = null;

  for (const g of games) {
    const field = g.fieldTeamIndexes.filter((i) => i >= 0 && i < n);
    if (field.length < 2) continue;
    const [a, b] = field as [number, number];

    if (g.drawResult) {
      king = null;
      afterDoubleDraw = true;
      outFromLastDraw = [a, b];
      const available = rotationIndexes.filter((t) => t !== a && t !== b);
      if (available.length >= 2) {
        currentLineup = [available[0]!, available[1]!];
      } else if (available.length === 1) {
        const other = rotationIndexes.find((t) => t !== a && t !== b && t !== available[0]);
        if (other !== undefined) currentLineup = [available[0]!, other];
      }
      continue;
    }

    const winner = g.championTeamIndex;
    if (winner === null || (winner !== a && winner !== b)) continue;

    afterDoubleDraw = false;
    outFromLastDraw = [];
    king = winner;

    if (nextRotationPtr < rotationIndexes.length) {
      currentLineup = [king, rotationIndexes[nextRotationPtr]!];
      nextRotationPtr++;
    } else {
      const waiting = rotationIndexes.filter((t) => t !== king);
      if (waiting.length > 0) {
        if (afterDoubleDraw && outFromLastDraw.length >= 2) {
          const pick = outFromLastDraw[0]!;
          currentLineup = [king, pick];
        } else {
          currentLineup = [king, waiting[0]!];
        }
      }
    }
  }

  if (currentLineup) return currentLineup;

  if (king !== null && nextRotationPtr < rotationIndexes.length) {
    return [king, rotationIndexes[nextRotationPtr]!];
  }

  const last = games[games.length - 1];
  if (last?.drawResult) {
    const available = rotationIndexes.filter(
      (t) => !last.fieldTeamIndexes.includes(t)
    );
    if (available.length >= 2) return [available[0]!, available[1]!];
  }

  return [rotationIndexes[0]!, rotationIndexes[1]!];
}

export function computeKingOfHillNextMatchFromMatches(
  rotationIndexes: number[],
  matches: Match[]
): [number, number] {
  return computeKingOfHillNextMatch(
    rotationIndexes,
    matches.map(toGameResult)
  );
}
