import bcrypt from "bcryptjs";
import {
  legacyMoneyFromRachaRaw,
  mergeFinancasGlobaisFillingNulls,
  normalizeFinancasGlobaisFromUnknown,
  normalizeFinancasHistoricoFromUnknown,
  normalizeRachaFinancasFromUnknown,
} from "./financas";
import type {
  Agendamento,
  AppData,
  ChampionPhotosEntry,
  FinancasGlobais,
  FinancasHistoricoEntry,
  Goal,
  LastDraft,
  Match,
  MatchFormat,
  MatchTeamSlot,
  Player,
  RachaFinancas,
  SorteioSharedWorkspace,
  UserRecord,
} from "./types";

function normalizeAgendamentoCampo(a: Agendamento): { item: Agendamento; migrated: boolean } {
  const c = a.campo;
  if (c === 1 || c === 2 || c === 3) {
    return { item: { ...a, campo: c }, migrated: false };
  }
  if (c !== undefined && c !== null) {
    const { campo: _, ...rest } = a;
    return { item: rest as Agendamento, migrated: true };
  }
  return { item: a, migrated: false };
}

type LegacyLastDraft = {
  agendamentoId?: string | null;
  teamA?: { name: string; playerIds: string[] };
  teamB?: { name: string; playerIds: string[] };
  createdAt?: string;
  format?: MatchFormat;
  teamCount?: number;
  durationMinutes?: number;
  teams?: MatchTeamSlot[];
  golEntradaPlayerId?: string | null;
  golFundoPlayerId?: string | null;
};

type LegacyMatch = {
  id: string;
  sortIndex?: number;
  agendamentoId?: string | null;
  date: string;
  weekLabel?: string;
  teamA?: { name: string; playerIds: string[] };
  teamB?: { name: string; playerIds: string[] };
  goals?: Goal[];
  championSide?: "A" | "B" | null;
  drawResult?: boolean;
  durationMinutes?: number;
  format?: MatchFormat;
  teamCount?: 2 | 3 | 4;
  teams?: Array<{ name: string; playerIds: string[]; rotationOrder?: number }>;
  fieldTeamIndexes?: number[];
  championTeamIndex?: number | null;
  placarField0?: number | null;
  placarField1?: number | null;
  decisaoPorPenaltis?: boolean;
  penaltisConvertidos0?: number | null;
  penaltisConvertidos1?: number | null;
  cartoesAmarelos?: string[];
};

function fallbackSortIndexFromId(id: string): number {
  const head = id.split("-")[0] ?? id;
  const parsed = parseInt(head, 36);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function normalizeSortIndex(o: LegacyMatch): { value: number; migrated: boolean } {
  if (typeof o.sortIndex === "number" && Number.isFinite(o.sortIndex)) {
    return { value: o.sortIndex, migrated: false };
  }
  return {
    value: fallbackSortIndexFromId(String(o.id ?? "")),
    migrated: true,
  };
}

function normalizeScoringFields(o: LegacyMatch): {
  placarField0: number | null;
  placarField1: number | null;
  decisaoPorPenaltis: boolean;
  penaltisConvertidos0: number | null;
  penaltisConvertidos1: number | null;
  cartoesAmarelos: string[];
  migrated: boolean;
} {
  let migrated = false;
  const clamp = (v: unknown): number | null => {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    const n = Math.round(v);
    if (n < 0 || n > 99) {
      migrated = true;
      return Math.min(99, Math.max(0, n));
    }
    return n;
  };
  let placarField0 = clamp(o.placarField0);
  let placarField1 = clamp(o.placarField1);
  let decisaoPorPenaltis = Boolean(o.decisaoPorPenaltis);
  let pen0: number | null = null;
  if (o.penaltisConvertidos0 === 0 || o.penaltisConvertidos0 === 1) {
    pen0 = o.penaltisConvertidos0;
  } else if (o.penaltisConvertidos0 != null) {
    migrated = true;
  }
  let pen1: number | null = null;
  if (o.penaltisConvertidos1 === 0 || o.penaltisConvertidos1 === 1) {
    pen1 = o.penaltisConvertidos1;
  } else if (o.penaltisConvertidos1 != null) {
    migrated = true;
  }
  const tie =
    placarField0 !== null && placarField1 !== null && placarField0 === placarField1;
  if (decisaoPorPenaltis && !tie) {
    decisaoPorPenaltis = false;
    pen0 = null;
    pen1 = null;
    migrated = true;
  }
  if (!decisaoPorPenaltis) {
    pen0 = null;
    pen1 = null;
  }
  let cartoesAmarelos: string[] = [];
  if (Array.isArray(o.cartoesAmarelos)) {
    cartoesAmarelos = o.cartoesAmarelos.filter((x) => typeof x === "string" && x.length > 0);
  } else if (o.cartoesAmarelos !== undefined) {
    migrated = true;
  }
  return {
    placarField0,
    placarField1,
    decisaoPorPenaltis,
    penaltisConvertidos0: pen0,
    penaltisConvertidos1: pen1,
    cartoesAmarelos,
    migrated,
  };
}

export function normalizeMatch(raw: unknown): { match: Match; migrated: boolean } {
  const o = raw as LegacyMatch;
  let migrated = false;
  const { value: sortIndex, migrated: sortMigrated } = normalizeSortIndex(o);
  if (sortMigrated) migrated = true;
  if (!o?.id || !o.date) {
    migrated = true;
    const { migrated: scMigrated, ...scoring } = normalizeScoringFields(o);
    migrated = migrated || scMigrated;
    return {
      match: {
        id: String(o?.id ?? "unknown"),
        sortIndex,
        agendamentoId: null,
        date: String(o?.date ?? new Date().toISOString().slice(0, 10)),
        durationMinutes: 8,
        format: "dupla",
        teamCount: 2,
        teams: [
          { name: "Time A", playerIds: [], rotationOrder: 1 },
          { name: "Time B", playerIds: [], rotationOrder: 2 },
        ],
        fieldTeamIndexes: [0, 1],
        goals: [],
        championTeamIndex: null,
        drawResult: false,
        ...scoring,
      },
      migrated,
    };
  }

  if (Array.isArray(o.teams) && o.teams.length >= 2) {
    let teams: MatchTeamSlot[] = o.teams.map((t, i) => ({
      name: String(t.name || `Time ${i + 1}`).trim() || `Time ${i + 1}`,
      playerIds: Array.isArray(t.playerIds) ? t.playerIds : [],
      rotationOrder: typeof t.rotationOrder === "number" ? t.rotationOrder : i + 1,
    }));
    if (teams.length > 4) {
      teams = teams.slice(0, 4);
      migrated = true;
    }
    const len = teams.length;
    const teamCount = (len === 2 || len === 3 || len === 4 ? len : 2) as 2 | 3 | 4;
    const fmt: MatchFormat =
      (o.format as MatchFormat) || (teamCount === 2 ? "dupla" : "racha");
    let championTeamIndex: number | null =
      typeof o.championTeamIndex === "number" ? o.championTeamIndex : null;
    if (championTeamIndex !== null && championTeamIndex >= teamCount) {
      championTeamIndex = null;
      migrated = true;
    }
    const { migrated: scMigrated, ...scoring } = normalizeScoringFields(o);
    migrated = migrated || scMigrated;
    return {
      match: {
        id: o.id,
        sortIndex,
        agendamentoId: o.agendamentoId ?? null,
        date: o.date,
        weekLabel: o.weekLabel,
        durationMinutes: typeof o.durationMinutes === "number" ? o.durationMinutes : 8,
        format: fmt,
        teamCount,
        teams,
        fieldTeamIndexes:
          Array.isArray(o.fieldTeamIndexes) && o.fieldTeamIndexes.length >= 2
            ? o.fieldTeamIndexes.slice(0, 2)
            : [0, 1],
        goals: Array.isArray(o.goals) ? o.goals : [],
        championTeamIndex,
        drawResult: Boolean(o.drawResult),
        ...scoring,
      },
      migrated,
    };
  }

  if (o.teamA && o.teamB) {
    let championTeamIndex: number | null = null;
    if (o.championSide === "A") championTeamIndex = 0;
    if (o.championSide === "B") championTeamIndex = 1;
    migrated = true;
    const { migrated: scMigrated, ...scoring } = normalizeScoringFields(o);
    migrated = migrated || scMigrated;
    return {
      match: {
        id: o.id,
        sortIndex,
        agendamentoId: o.agendamentoId ?? null,
        date: o.date,
        weekLabel: o.weekLabel,
        durationMinutes: typeof o.durationMinutes === "number" ? o.durationMinutes : 8,
        format: "dupla",
        teamCount: 2,
        teams: [
          {
            name: String(o.teamA.name || "Time A").trim() || "Time A",
            playerIds: Array.isArray(o.teamA.playerIds) ? o.teamA.playerIds : [],
            rotationOrder: 1,
          },
          {
            name: String(o.teamB.name || "Time B").trim() || "Time B",
            playerIds: Array.isArray(o.teamB.playerIds) ? o.teamB.playerIds : [],
            rotationOrder: 2,
          },
        ],
        fieldTeamIndexes: [0, 1],
        goals: Array.isArray(o.goals) ? o.goals : [],
        championTeamIndex,
        drawResult: Boolean(o.drawResult),
        ...scoring,
      },
      migrated,
    };
  }

  migrated = true;
  const { migrated: scMigrated, ...scoring } = normalizeScoringFields(o);
  migrated = migrated || scMigrated;
  return {
    match: {
      id: o.id,
      sortIndex,
      agendamentoId: o.agendamentoId ?? null,
      date: o.date,
      weekLabel: o.weekLabel,
      durationMinutes: 8,
      format: "dupla",
      teamCount: 2,
      teams: [
        { name: "Time A", playerIds: [], rotationOrder: 1 },
        { name: "Time B", playerIds: [], rotationOrder: 2 },
      ],
      fieldTeamIndexes: [0, 1],
      goals: [],
      championTeamIndex: null,
      drawResult: Boolean(o.drawResult),
      ...scoring,
    },
    migrated,
  };
}

export function normalizeLastDraft(raw: unknown): { draft: LastDraft | null; migrated: boolean } {
  if (raw == null) return { draft: null, migrated: false };
  const o = raw as LegacyLastDraft;
  if (Array.isArray(o.teams) && o.teams.length >= 2 && o.createdAt) {
    const teams: MatchTeamSlot[] = o.teams.map((t, i) => ({
      name: String(t.name || `Time ${i + 1}`).trim() || `Time ${i + 1}`,
      playerIds: Array.isArray(t.playerIds) ? t.playerIds : [],
      rotationOrder: typeof t.rotationOrder === "number" ? t.rotationOrder : i + 1,
    }));
    const n = teams.length;
    const teamCount = (n === 2 || n === 3 || n === 4 ? n : 2) as 2 | 3 | 4;
    const draft: LastDraft = {
      format: (o.format as MatchFormat) || (teamCount === 2 ? "dupla" : "racha"),
      agendamentoId: o.agendamentoId ?? null,
      teamCount,
      durationMinutes: typeof o.durationMinutes === "number" ? o.durationMinutes : 8,
      teams,
      createdAt: o.createdAt,
    };
    if (typeof o.golEntradaPlayerId === "string" || o.golEntradaPlayerId === null) {
      draft.golEntradaPlayerId = o.golEntradaPlayerId;
    }
    if (typeof o.golFundoPlayerId === "string" || o.golFundoPlayerId === null) {
      draft.golFundoPlayerId = o.golFundoPlayerId;
    }
    return { draft, migrated: false };
  }
  if (o.teamA && o.teamB && o.createdAt) {
    const draft: LastDraft = {
      format: "dupla",
      agendamentoId: o.agendamentoId ?? null,
      teamCount: 2,
      durationMinutes: typeof o.durationMinutes === "number" ? o.durationMinutes : 8,
      teams: [
        {
          name: String(o.teamA.name || "Time A").trim() || "Time A",
          playerIds: o.teamA.playerIds ?? [],
          rotationOrder: 1,
        },
        {
          name: String(o.teamB.name || "Time B").trim() || "Time B",
          playerIds: o.teamB.playerIds ?? [],
          rotationOrder: 2,
        },
      ],
      createdAt: o.createdAt,
    };
    if (typeof o.golEntradaPlayerId === "string" || o.golEntradaPlayerId === null) {
      draft.golEntradaPlayerId = o.golEntradaPlayerId;
    }
    if (typeof o.golFundoPlayerId === "string" || o.golFundoPlayerId === null) {
      draft.golFundoPlayerId = o.golFundoPlayerId;
    }
    return { draft, migrated: true };
  }
  return { draft: null, migrated: false };
}

function seedAdminIfNoUsers(users: UserRecord[]): { users: UserRecord[]; seeded: boolean } {
  if (users.length > 0) return { users, seeded: false };
  const now = new Date().toISOString();
  return {
    users: [
      {
        id: `usr-${Date.now().toString(36)}-admin`,
        email: "admin@pelada.local",
        name: "Administrador",
        passwordHash: bcrypt.hashSync("admin123", 10),
        role: "admin",
        playerId: null,
        createdAt: now,
      },
    ],
    seeded: true,
  };
}

export function migrateAppData(parsed: Partial<AppData>): {
  data: AppData;
  dirty: boolean;
} {
  let dirty = false;
  let matches = Array.isArray(parsed.matches)
    ? parsed.matches.map((m) => {
        const { match, migrated } = normalizeMatch(m);
        if (migrated) dirty = true;
        return match;
      })
    : [];
  const { draft: lastDraft, migrated: ldMigrated } = normalizeLastDraft(parsed.lastDraft);
  if (ldMigrated) dirty = true;

  let users: UserRecord[] = Array.isArray(parsed.users)
    ? (parsed.users as UserRecord[])
    : [];
  if (!Array.isArray(parsed.users)) dirty = true;

  const { users: withUsers, seeded } = seedAdminIfNoUsers(users);
  users = withUsers;
  if (seeded) dirty = true;

  let agendamentos: Agendamento[] = Array.isArray(parsed.agendamentos)
    ? (parsed.agendamentos as Agendamento[])
    : [];
  if (!Array.isArray(parsed.agendamentos)) dirty = true;
  agendamentos = agendamentos.map((a) => {
    const { item, migrated: am } = normalizeAgendamentoCampo(a);
    if (am) dirty = true;
    return item;
  });
  if (matches.length > 0 && agendamentos.length > 0) {
    const agendamentoDateById = new Map(agendamentos.map((a) => [a.id, a.date]));
    matches = matches.map((m) => {
      if (!m.agendamentoId) return m;
      const rachaDate = agendamentoDateById.get(m.agendamentoId);
      if (!rachaDate || m.date === rachaDate) return m;
      dirty = true;
      return { ...m, date: rachaDate };
    });
  }

  let draftsByAgendamento: Record<string, LastDraft> = {};
  const rawDrafts = (parsed as Partial<AppData>).draftsByAgendamento;
  if (rawDrafts && typeof rawDrafts === "object" && !Array.isArray(rawDrafts)) {
    for (const [key, val] of Object.entries(rawDrafts)) {
      if (!key) continue;
      const { draft, migrated: dm } = normalizeLastDraft(val);
      if (draft) {
        draftsByAgendamento[key] = {
          ...draft,
          agendamentoId: draft.agendamentoId ?? key,
        };
        if (dm) dirty = true;
      }
    }
  } else {
    draftsByAgendamento = {};
    dirty = true;
  }

  if (lastDraft?.agendamentoId && !draftsByAgendamento[lastDraft.agendamentoId]) {
    draftsByAgendamento[lastDraft.agendamentoId] = lastDraft;
    dirty = true;
  }

  let players: Player[] = Array.isArray(parsed.players)
    ? (parsed.players as Player[]).map((p) => {
        const category: Player["category"] =
          p.category === "goleiro" ? "goleiro" : "campo";
        if (p.category !== category) dirty = true;
        return { ...p, category };
      })
    : [];
  if (!Array.isArray(parsed.players)) {
    players = [];
    dirty = true;
  }

  let championPhotosByAgendamento: Record<string, ChampionPhotosEntry> = {};
  const rawPhotos = (parsed as Partial<AppData>).championPhotosByAgendamento;
  if (rawPhotos && typeof rawPhotos === "object" && !Array.isArray(rawPhotos)) {
    for (const [key, val] of Object.entries(rawPhotos)) {
      if (!key || typeof val !== "object" || !val) continue;
      const v = val as Partial<ChampionPhotosEntry>;
      const team =
        v.bestTeamPhotoUrl === null
          ? null
          : typeof v.bestTeamPhotoUrl === "string"
            ? v.bestTeamPhotoUrl
            : null;
      const player =
        v.bestPlayerPhotoUrl === null
          ? null
          : typeof v.bestPlayerPhotoUrl === "string"
            ? v.bestPlayerPhotoUrl
            : null;
      const updatedAt =
        typeof v.updatedAt === "string" ? v.updatedAt : new Date().toISOString();
      championPhotosByAgendamento[key] = {
        bestTeamPhotoUrl: team,
        bestPlayerPhotoUrl: player,
        updatedAt,
      };
    }
  } else if ((parsed as Partial<AppData>).championPhotosByAgendamento !== undefined) {
    championPhotosByAgendamento = {};
    dirty = true;
  }

  let sorteioWorkspace: SorteioSharedWorkspace | null = null;
  const rawWs = (parsed as Partial<AppData>).sorteioWorkspace;
  if (rawWs === null) {
    sorteioWorkspace = null;
  } else if (rawWs && typeof rawWs === "object" && !Array.isArray(rawWs)) {
    const w = rawWs as Partial<SorteioSharedWorkspace>;
    const slotsOk =
      Array.isArray(w.slots) &&
      w.slots.length === 5 &&
      w.slots.every((s) => s === null || (typeof s === "object" && s !== null));
    const modeOk = w.mode === "dupla" || w.mode === "racha";
    const rachaOk = w.rachaCount === 3 || w.rachaCount === 4;
    const updatedOk = typeof w.updatedAt === "string" && w.updatedAt.length > 0;
    if (
      slotsOk &&
      modeOk &&
      rachaOk &&
      updatedOk &&
      typeof w.activeSlotIndex === "number" &&
      Array.isArray(w.selectedIds) &&
      Array.isArray(w.teamNames) &&
      typeof w.durationMinutes === "number" &&
      typeof w.agendamentoId === "string"
    ) {
      sorteioWorkspace = {
        slots: w.slots as SorteioSharedWorkspace["slots"],
        activeSlotIndex: w.activeSlotIndex,
        selectedIds: w.selectedIds.filter((x) => typeof x === "string"),
        teamNames: w.teamNames.filter((x) => typeof x === "string"),
        mode: w.mode as "dupla" | "racha",
        rachaCount: w.rachaCount as 3 | 4,
        durationMinutes: w.durationMinutes,
        agendamentoId: w.agendamentoId as string,
        updatedAt: w.updatedAt as string,
        updatedByUserId:
          w.updatedByUserId === null || typeof w.updatedByUserId === "string"
            ? w.updatedByUserId
            : null,
        updatedByName:
          w.updatedByName === null || typeof w.updatedByName === "string"
            ? w.updatedByName
            : undefined,
      };
    } else {
      sorteioWorkspace = null;
      dirty = true;
    }
  } else if ((parsed as Partial<AppData>).sorteioWorkspace !== undefined) {
    sorteioWorkspace = null;
    dirty = true;
  }

  let financasByAgendamento: Record<string, RachaFinancas> = {};
  const rawFin = (parsed as Partial<AppData>).financasByAgendamento;
  let bestLegacyMoney: { at: string; partial: Partial<FinancasGlobais> } | null = null;
  if (rawFin && typeof rawFin === "object" && !Array.isArray(rawFin)) {
    for (const [key, val] of Object.entries(rawFin)) {
      if (!key) continue;
      const partial = legacyMoneyFromRachaRaw(val);
      if (partial) {
        const o =
          val && typeof val === "object" && !Array.isArray(val)
            ? (val as Record<string, unknown>)
            : {};
        const at = typeof o.updatedAt === "string" ? o.updatedAt : "";
        if (at && (!bestLegacyMoney || at > bestLegacyMoney.at)) {
          bestLegacyMoney = { at, partial };
        }
      }
      financasByAgendamento[key] = normalizeRachaFinancasFromUnknown(key, val);
    }
  } else if ((parsed as Partial<AppData>).financasByAgendamento !== undefined) {
    financasByAgendamento = {};
    dirty = true;
  }

  let financasGlobais = normalizeFinancasGlobaisFromUnknown(
    (parsed as Partial<AppData>).financasGlobais
  );
  if ((parsed as Partial<AppData>).financasGlobais === undefined) {
    dirty = true;
  }
  if (bestLegacyMoney) {
    const merged = mergeFinancasGlobaisFillingNulls(financasGlobais, bestLegacyMoney.partial);
    if (JSON.stringify(merged) !== JSON.stringify(financasGlobais)) {
      financasGlobais = merged;
      dirty = true;
    }
  }

  let financasHistorico: FinancasHistoricoEntry[] = [];
  const rawHist = (parsed as Partial<AppData>).financasHistorico;
  if (Array.isArray(rawHist)) {
    for (const row of rawHist) {
      const e = normalizeFinancasHistoricoFromUnknown(row);
      if (e) financasHistorico.push(e);
      else dirty = true;
    }
  } else if (rawHist !== undefined) {
    dirty = true;
  }

  const data: AppData = {
    players,
    matches,
    lastDraft,
    draftsByAgendamento,
    users,
    agendamentos,
    championPhotosByAgendamento,
    sorteioWorkspace,
    financasByAgendamento,
    financasGlobais,
    financasHistorico,
  };

  return { data, dirty };
}
