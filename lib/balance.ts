import type { Player } from "./types";

/** Divide jogadores em N times minimizando desequilíbrio da soma das estrelas. */
export function balanceIntoN(
  players: Player[],
  n: number
): { teams: Player[][]; sums: number[] } {
  if (n < 1) {
    return { teams: [], sums: [] };
  }
  if (players.length === 0) {
    return {
      teams: Array.from({ length: n }, () => []),
      sums: Array(n).fill(0),
    };
  }
  const sorted = [...players].sort((a, b) => b.stars - a.stars);
  const teams: Player[][] = Array.from({ length: n }, () => []);
  const sums = Array(n).fill(0);
  for (const p of sorted) {
    let minIdx = 0;
    for (let j = 1; j < n; j++) {
      if (sums[j] < sums[minIdx]) minIdx = j;
    }
    teams[minIdx].push(p);
    sums[minIdx] += p.stars;
  }
  return { teams, sums };
}

/** Dois times (compatível com fluxo antigo). */
export function balanceTeams(players: Player[]): {
  teamA: Player[];
  teamB: Player[];
  sumA: number;
  sumB: number;
} {
  const { teams, sums } = balanceIntoN(players, 2);
  return {
    teamA: teams[0] ?? [],
    teamB: teams[1] ?? [],
    sumA: sums[0] ?? 0,
    sumB: sums[1] ?? 0,
  };
}

/** Embaralha array (Fisher–Yates). */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Atribui ordens 1..n aleatórias às posições 0..n-1 (fila do racha). */
export function randomRotationOrders(n: number): number[] {
  const orders = shuffle(Array.from({ length: n }, (_, i) => i + 1));
  return orders;
}
