import type { DrawRunResult, DrawSlotRow } from "./sorteio-helpers";
import type { Player, SorteioSharedWorkspace } from "./types";

export const SORTEIO_STORAGE_KEY = "futebolstatus-sorteio-ui-v1";

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
  teamNames: string[];
  mode: "dupla" | "racha";
  rachaCount: 3 | 4;
  durationMinutes: number;
  agendamentoId: string;
};

export function sharedWorkspaceToSerialized(
  ws: SorteioSharedWorkspace
): SerializedSorteioState {
  return {
    slots: ws.slots,
    activeSlotIndex: ws.activeSlotIndex,
    selectedIds: ws.selectedIds,
    teamNames: ws.teamNames,
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
  teamNames: string[];
  mode: "dupla" | "racha";
  rachaCount: 3 | 4;
  durationMinutes: number;
  agendamentoId: string;
}): SerializedSorteioState {
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
    teamNames: params.teamNames,
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
  teamNames: string[];
  mode: "dupla" | "racha";
  rachaCount: 3 | 4;
  durationMinutes: number;
  agendamentoId: string;
}): string {
  return JSON.stringify(buildSerializedSorteioState(params));
}
