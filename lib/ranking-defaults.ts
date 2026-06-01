/** Nomes padrão dos 4 times no racha (ranking e sorteio). */
export const DEFAULT_RACHA_TEAM_NAMES = [
  "Preto",
  "Laranja",
  "Amarelo",
  "Azul",
] as const;

export type DefaultRachaTeamName = (typeof DEFAULT_RACHA_TEAM_NAMES)[number];

/** Rachas a partir desta data entram na pontuação do ranking (YYYY-MM-DD). */
export const RANKING_START_DATE = "2026-06-01";

/**
 * Converte o nome do time no jogo para um dos 4 canônicos, ou null se não for um deles.
 * "Verde" (legado) conta como Azul.
 */
export function normalizeTeamNameForRanking(
  raw: string
): DefaultRachaTeamName | null {
  const t = raw.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (lower === "verde") return "Azul";
  for (const n of DEFAULT_RACHA_TEAM_NAMES) {
    if (n.toLowerCase() === lower) return n;
  }
  return null;
}

export function agendamentoCountsForRanking(date: string): boolean {
  return date >= RANKING_START_DATE;
}
