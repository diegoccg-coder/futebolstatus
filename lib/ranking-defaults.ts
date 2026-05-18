/** Nomes padrão dos 4 times no racha (ranking e sorteio). */
export const DEFAULT_RACHA_TEAM_NAMES = [
  "Verde",
  "Amarelo",
  "Preto",
  "Laranja",
] as const;

export type DefaultRachaTeamName = (typeof DEFAULT_RACHA_TEAM_NAMES)[number];

/**
 * Converte o nome do time no jogo para um dos 4 canônicos, ou null se não for um deles.
 * Ignora "Time A/B", nomes antigos, etc., para o ranking de times listar só os 4 padrão.
 * "Azul" (legado) conta como Verde.
 */
export function normalizeTeamNameForRanking(
  raw: string
): DefaultRachaTeamName | null {
  const t = raw.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (lower === "azul") return "Verde";
  for (const n of DEFAULT_RACHA_TEAM_NAMES) {
    if (n.toLowerCase() === lower) return n;
  }
  return null;
}
