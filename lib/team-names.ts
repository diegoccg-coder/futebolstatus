import { DEFAULT_RACHA_TEAM_NAMES } from "./ranking-defaults";
import type { Player } from "./types";

/** Grupo de estrelas usado como padrão para nomear os times. */
export const DEFAULT_TEAM_NAMING_STARS = 5;

export type TeamPlayerIds = { index: number; playerIds: string[] };

export function placeholderTeamNames(teamCount: number): string[] {
  return Array.from({ length: teamCount }, (_, i) => `Time ${i + 1}`);
}

export function isLegacyColorTeamNames(names: string[], teamCount: number): boolean {
  const legacy = DEFAULT_RACHA_TEAM_NAMES.slice(0, teamCount);
  return (
    names.length >= teamCount &&
    legacy.every((color, i) => (names[i] ?? "").trim() === color)
  );
}

/**
 * Para cada time, usa o primeiro jogador (A–Z) do grupo de estrelas que está
 * naquele time. Garante que o nome do time corresponde a alguém do elenco.
 */
export function teamNamesFromStarGroup(
  teams: TeamPlayerIds[],
  linePlayers: Player[],
  stars: number,
  teamCount: number
): string[] {
  const byId = new Map(linePlayers.map((p) => [p.id, p]));
  const teamsByIndex = new Map(teams.map((t) => [t.index, t]));

  return Array.from({ length: teamCount }, (_, i) => {
    const team = teamsByIndex.get(i);
    if (!team) return `Time ${i + 1}`;

    const candidates = team.playerIds
      .map((id) => byId.get(id))
      .filter(
        (p): p is Player =>
          p != null && p.category !== "goleiro" && p.stars === stars
      )
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    return candidates[0]?.name ?? `Time ${i + 1}`;
  });
}

/** Nome do time: jogador de 5★ no elenco; se não houver, usa o nome já salvo. */
export function teamLabelFromStarGroup(
  playerIds: string[],
  players: Player[],
  fallbackName: string,
  idx: number
): string {
  const [derived] = teamNamesFromStarGroup(
    [{ index: 0, playerIds }],
    players,
    DEFAULT_TEAM_NAMING_STARS,
    1
  );
  if (derived && derived !== "Time 1") return derived;
  const stored = fallbackName.trim();
  if (stored) return stored;
  return `Time ${idx + 1}`;
}

export function defaultTeamNamesForDraw(
  teams: TeamPlayerIds[],
  linePlayers: Player[],
  teamCount: number
): string[] {
  return teamNamesFromStarGroup(
    teams,
    linePlayers,
    DEFAULT_TEAM_NAMING_STARS,
    teamCount
  );
}

/** Substitui nomes legados por cor (Preto, Laranja…) pelo padrão 5★ quando há sorteio. */
export function migrateLegacyColorNamesBySlot(
  namesBySlot: string[][],
  slots: Array<{ teams: TeamPlayerIds[] } | null>,
  linePlayers: Player[],
  teamCount: number
): string[][] {
  return namesBySlot.map((names, slotIdx) => {
    const slot = slots[slotIdx];
    if (!slot || !isLegacyColorTeamNames(names, teamCount)) return names;
    return defaultTeamNamesForDraw(slot.teams, linePlayers, teamCount);
  });
}
