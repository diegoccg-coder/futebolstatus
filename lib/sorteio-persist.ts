import type { DrawRunResult, DrawSlotRow } from "./sorteio-helpers";
import { placeholderTeamNames } from "./team-names";
import type { Player, SorteioSharedWorkspace } from "./types";

export const SORTEIO_STORAGE_KEY = "futebolstatus-sorteio-ui-v1";
export const SORTEIO_SLOT_COUNT = 5;

export function defaultTeamNamesForCount(teamCount: number): string[] {
  return placeholderTeamNames(teamCount);
}

export function emptyTeamNamesBySlot(teamCount: number): string[][] {
  return Array.from({ length: SORTEIO_SLOT_COUNT }, () =>
    defaultTeamNamesForCount(teamCount)
  );
}

/** Normaliza nomes por slot; aceita formato legado com um único array `teamNames`. */
export function resolveTeamNamesBySlot(
  teamNamesBySlot: unknown,
  legacyTeamNames: unknown,
  teamCount: number
): string[][] {
  const base = emptyTeamNamesBySlot(teamCount);

  if (Array.isArray(teamNamesBySlot) && teamNamesBySlot.length === SORTEIO_SLOT_COUNT) {
    return teamNamesBySlot.map((slotNames, slotIdx) => {
      if (!Array.isArray(slotNames)) return [...base[slotIdx]!];
      return Array.from({ length: teamCount }, (_, i) => {
        const n = slotNames[i];
        return typeof n === "string" && n.trim() ? n.trim() : base[slotIdx]![i]!;
      });
    });
  }

  if (Array.isArray(legacyTeamNames)) {
    const legacy = Array.from({ length: teamCount }, (_, i) => {
      const n = legacyTeamNames[i];
      return typeof n === "string" && n.trim() ? n.trim() : base[0]![i]!;
    });
    return base.map((_, slotIdx) => (slotIdx === 0 ? [...legacy] : [...base[slotIdx]!]));
  }

  return base;
}

export type SerializedSorteioState = {
  slots: Array<{
    teamCount: number;
    teams: Array<{
      index: number;
      playerIds: string[];
      rotationOrder: number;
    }>;
    golEntradaPlayerId?: string | null;
    golFundoPlayerId?: string | null;
  } | null>;
  activeSlotIndex: number;
  selectedIds: string[];
  teamNamesBySlot: string[][];
  /** Legado — migrado para teamNamesBySlot na leitura. */
  teamNames?: string[];
  mode: "dupla" | "racha";
  rachaCount: 3 | 4;
  durationMinutes: number;
  agendamentoId: string;
};

export function teamCountFromSorteioMode(
  mode: "dupla" | "racha",
  rachaCount: 3 | 4
): number {
  return mode === "dupla" ? 2 : rachaCount;
}

export function sharedWorkspaceToSerialized(
  ws: SorteioSharedWorkspace
): SerializedSorteioState {
  const teamCount = teamCountFromSorteioMode(ws.mode, ws.rachaCount);
  return {
    slots: ws.slots,
    activeSlotIndex: ws.activeSlotIndex,
    selectedIds: ws.selectedIds,
    teamNamesBySlot: resolveTeamNamesBySlot(ws.teamNamesBySlot, undefined, teamCount),
    mode: ws.mode,
    rachaCount: ws.rachaCount,
    durationMinutes: ws.durationMinutes,
    agendamentoId: ws.agendamentoId,
  };
}

export function parseStoredSorteioJson(
  raw: string | null
): SerializedSorteioState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SerializedSorteioState;
    if (!parsed || !Array.isArray(parsed.slots) || parsed.slots.length !== 5) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function hydrateDrawSlotsFromStored(
  parsed: SerializedSorteioState,
  playersById: Map<string, Player>
): Array<DrawRunResult | null> {
  return parsed.slots.map((slot) => {
    if (!slot || !Array.isArray(slot.teams)) return null;
    const teams: DrawSlotRow[] = slot.teams.map((t) => {
      const playerIds = t.playerIds.filter((id) => playersById.has(id));
      const players = playerIds
        .map((id) => playersById.get(id))
        .filter((p): p is Player => p != null);
      const sumStars = players.reduce((s, p) => s + p.stars, 0);
      return {
        index: t.index,
        playerIds,
        players,
        sumStars,
        rotationOrder: t.rotationOrder,
      };
    });
    return {
      teamCount: slot.teamCount,
      teams,
      golEntradaPlayerId:
        slot.golEntradaPlayerId === undefined
          ? null
          : typeof slot.golEntradaPlayerId === "string" || slot.golEntradaPlayerId === null
            ? slot.golEntradaPlayerId
            : null,
      golFundoPlayerId:
        slot.golFundoPlayerId === undefined
          ? null
          : typeof slot.golFundoPlayerId === "string" || slot.golFundoPlayerId === null
            ? slot.golFundoPlayerId
            : null,
    };
  });
}

export function buildSerializedSorteioState(params: {
  drawSlots: Array<DrawRunResult | null>;
  activeSlotIndex: number;
  selected: Set<string>;
  teamNamesBySlot: string[][];
  mode: "dupla" | "racha";
  rachaCount: 3 | 4;
  durationMinutes: number;
  agendamentoId: string;
}): SerializedSorteioState {
  const teamCount = teamCountFromSorteioMode(params.mode, params.rachaCount);
  const slots = params.drawSlots.map((s) => {
    if (!s) return null;
    return {
      teamCount: s.teamCount,
      teams: s.teams.map((t) => ({
        index: t.index,
        playerIds: t.playerIds,
        rotationOrder: t.rotationOrder,
      })),
      golEntradaPlayerId: s.golEntradaPlayerId,
      golFundoPlayerId: s.golFundoPlayerId,
    };
  });
  return {
    slots,
    activeSlotIndex: Math.min(4, Math.max(0, params.activeSlotIndex)),
    selectedIds: Array.from(params.selected),
    teamNamesBySlot: resolveTeamNamesBySlot(
      params.teamNamesBySlot,
      undefined,
      teamCount
    ),
    mode: params.mode,
    rachaCount: params.rachaCount,
    durationMinutes: params.durationMinutes,
    agendamentoId: params.agendamentoId,
  };
}

export function serializeSorteioState(params: {
  drawSlots: Array<DrawRunResult | null>;
  activeSlotIndex: number;
  selected: Set<string>;
  teamNamesBySlot: string[][];
  mode: "dupla" | "racha";
  rachaCount: 3 | 4;
  durationMinutes: number;
  agendamentoId: string;
}): string {
  return JSON.stringify(buildSerializedSorteioState(params));
}
