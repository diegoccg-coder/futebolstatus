import {
  fieldPlayerIdsOnMatch,
  fieldTeamIndexesSafe,
  rachaDraftGoleiroPlayerIds,
  rachaDraftLinhaPlayerIds,
} from "./matchUi";
import type { AppData, Match, MatchTeamSlot, Player } from "./types";

export type GoalOptions = {
  emCampo: Player[];
  outrosNoRacha: Player[];
  goleiros: Player[];
  draftDisponivel: boolean;
};

export type GoalPlayerOption = {
  player: Player;
  teamName: string;
  kind: "campo" | "substituto" | "goleiro";
};

export function teamNameForPlayerInTeams(
  teams: MatchTeamSlot[],
  playerId: string
): string | null {
  for (const t of teams) {
    if (t.playerIds.includes(playerId)) {
      const name = t.name?.trim();
      if (name) return name;
    }
  }
  return null;
}

export function formatGoalPlayerLabel(teamName: string, playerName: string): string {
  return `${teamName} - ${playerName}`;
}

/** Goleiros não pertencem a nenhum time em campo (podem trocar de gol). */
export const GOALKEEPER_OPTION_LABEL = "Goleiro";

/** Time do jogador de linha para gol/assistência; goleiro retorna null. */
export function teamNameForGoalParticipant(
  match: Match,
  playerId: string,
  player: Player,
  _draftsByAgendamento: Record<string, import("./types").LastDraft>
): string | null {
  if (player.category === "goleiro") return null;
  return teamNameForPlayerInTeams(match.teams, playerId);
}

export function assistOptionsForScorer(
  options: GoalPlayerOption[],
  scorerId: string
): GoalPlayerOption[] {
  if (!scorerId) return [];
  const scorerOpt = options.find((o) => o.player.id === scorerId);
  if (!scorerOpt) return [];
  return options.filter((o) => {
    if (o.player.id === scorerId) return false;
    if (o.kind === "goleiro") return true;
    if (scorerOpt.kind === "goleiro") return true;
    return o.teamName === scorerOpt.teamName;
  });
}

/** Lista de jogadores para gol/assistência com time no rótulo «Time X - Jogador». */
export function buildGoalPlayerOptions(
  match: Pick<Match, "teams" | "fieldTeamIndexes" | "agendamentoId">,
  data: Pick<AppData, "players" | "draftsByAgendamento">
): GoalPlayerOption[] {
  const m = match as Match;
  const field = fieldPlayerIdsOnMatch(m);
  const fieldIndexes = fieldTeamIndexesSafe(m);
  const drafts = data.draftsByAgendamento ?? {};
  const rows: GoalPlayerOption[] = [];

  for (const idx of fieldIndexes) {
    const team = m.teams[idx];
    if (!team) continue;
    const teamName = team.name?.trim() || `Time ${idx + 1}`;
    const players = team.playerIds
      .map((id) => data.players.find((p) => p.id === id))
      .filter((p): p is Player => p != null && p.category !== "goleiro")
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    for (const p of players) {
      rows.push({ player: p, teamName, kind: "campo" });
    }
  }

  if (m.agendamentoId) {
    const draftIds = rachaDraftLinhaPlayerIds(m, drafts);
    if (draftIds.size > 0) {
      const bench = data.players
        .filter(
          (p) =>
            p.category !== "goleiro" &&
            draftIds.has(p.id) &&
            !field.has(p.id)
        )
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      for (const p of bench) {
        const teamName =
          teamNameForPlayerInTeams(m.teams, p.id) ?? "Substituto";
        rows.push({ player: p, teamName, kind: "substituto" });
      }
    }
  }

  const gkIds = m.agendamentoId
    ? rachaDraftGoleiroPlayerIds(m, drafts)
    : new Set<string>();
  const goleiros = data.players
    .filter((p) => p.category === "goleiro" && gkIds.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  for (const p of goleiros) {
    rows.push({ player: p, teamName: GOALKEEPER_OPTION_LABEL, kind: "goleiro" });
  }

  return rows;
}

export function buildGoalOptions(
  match: Pick<Match, "teams" | "fieldTeamIndexes" | "agendamentoId">,
  data: Pick<AppData, "players" | "draftsByAgendamento">
): GoalOptions {
  const field = fieldPlayerIdsOnMatch(match as Match);
  const drafts = data.draftsByAgendamento ?? {};
  const gkIds = match.agendamentoId
    ? rachaDraftGoleiroPlayerIds(match as Match, drafts)
    : new Set<string>();
  const goleiros = data.players
    .filter((p) => p.category === "goleiro" && gkIds.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  if (match.agendamentoId) {
    const draftIds = rachaDraftLinhaPlayerIds(match as Match, drafts);
    if (draftIds.size > 0) {
      const todos = data.players
        .filter((p) => p.category !== "goleiro" && draftIds.has(p.id))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      return {
        emCampo: todos.filter((p) => field.has(p.id)),
        outrosNoRacha: todos.filter((p) => !field.has(p.id)),
        goleiros,
        draftDisponivel: true,
      };
    }
  }

  const emCampo = data.players
    .filter((p) => p.category !== "goleiro" && field.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return { emCampo, outrosNoRacha: [], goleiros, draftDisponivel: false };
}

export function playersOnField(
  match: Pick<Match, "teams" | "fieldTeamIndexes">,
  players: Player[]
): Player[] {
  const ids = new Set<string>();
  const field = Array.isArray(match.fieldTeamIndexes) ? match.fieldTeamIndexes : [];
  const fieldSet = new Set(field);
  for (const [idx, t] of match.teams.entries()) {
    if (fieldSet.size > 0 && !fieldSet.has(idx)) continue;
    for (const pid of t.playerIds) ids.add(pid);
  }
  return players.filter((p) => ids.has(p.id));
}
