/** Regras do ranking por pontos (sincronizar com texto na página Ranking). */
export const POINTS_PER_GOAL = 2;
export const POINTS_PER_WIN = 1;
export const POINTS_PER_YELLOW = -1;

export function pointsFromCounts(
  goals: number,
  wins: number,
  yellowCards: number
): number {
  return (
    goals * POINTS_PER_GOAL +
    wins * POINTS_PER_WIN +
    yellowCards * POINTS_PER_YELLOW
  );
}

/** Exibição: evita “12.0” desnecessário, mantém uma casa quando há meio ponto. */
export function formatRankPoints(p: number): string {
  const rounded = Math.round(p * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
