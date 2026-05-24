import type { LastDraft, Match, MatchTeamSlot } from "./types";

export function teamsByRotation(teams: MatchTeamSlot[]): MatchTeamSlot[] {
  return [...teams].sort((a, b) => a.rotationOrder - b.rotationOrder);
}

/** Índices dos dois times em campo (fallback [0,1] como na API). */
export function fieldTeamIndexesSafe(m: Match): number[] {
  const n = m.teams.length;
  if (n === 0) return [];
  const raw = Array.isArray(m.fieldTeamIndexes) ? m.fieldTeamIndexes : [];
  const dedup = [...new Set(raw)].filter(
    (i) => Number.isInteger(i) && i >= 0 && i < n
  );
  if (dedup.length >= 2) return [dedup[0]!, dedup[1]!];
  if (dedup.length === 1) {
    const a = dedup[0]!;
    const b = a === 0 ? Math.min(1, n - 1) : 0;
    return a === b ? [0, Math.min(1, n - 1)] : [a, b];
  }
  return [0, Math.min(1, n - 1)];
}

/**
 * Vencedor para estatísticas e listagens: campeão explícito (se válido em campo),
 * senão placar / pênaltis.
 */
export function effectiveWinnerTeamIndex(m: Match): number | null {
  if (m.drawResult) return null;
  const field = fieldTeamIndexesSafe(m);
  if (field.length < 2) {
    if (m.championTeamIndex !== null && m.championTeamIndex < m.teams.length) {
      return m.championTeamIndex;
    }
    return null;
  }
  const [iA, iB] = field;
  if (
    m.championTeamIndex !== null &&
    field.includes(m.championTeamIndex)
  ) {
    return m.championTeamIndex;
  }
  const p0 = m.placarField0;
  const p1 = m.placarField1;
  if (p0 !== null && p1 !== null) {
    if (p0 > p1) return iA;
    if (p1 > p0) return iB;
    if (
      m.decisaoPorPenaltis &&
      m.penaltisConvertidos0 !== null &&
      m.penaltisConvertidos1 !== null
    ) {
      if (m.penaltisConvertidos0 > m.penaltisConvertidos1) return iA;
      if (m.penaltisConvertidos1 > m.penaltisConvertidos0) return iB;
    }
  }
  return null;
}

/** Nome do vencedor (cadastro ou inferido pelo placar). */
export function matchWinnerDisplayName(m: Match): string | null {
  if (m.drawResult) return "Empate";
  const w = effectiveWinnerTeamIndex(m);
  if (w === null) return null;
  const name = m.teams[w]?.name?.trim();
  return name || null;
}

/** Trecho de placar para listagens (ex.: "2–1" ou "1–1 (pen. 1–0)"). */
export function matchScoreLine(m: Match): string | null {
  if (m.placarField0 === null || m.placarField1 === null) return null;
  let s = `${m.placarField0}–${m.placarField1}`;
  if (
    m.decisaoPorPenaltis &&
    m.penaltisConvertidos0 !== null &&
    m.penaltisConvertidos1 !== null
  ) {
    s += ` (pen. ${m.penaltisConvertidos0}–${m.penaltisConvertidos1})`;
  }
  return s;
}

/** Ordem em que os jogos aconteceram no racha (sortIndex, depois data). */
export function sortMatchesChronologically(a: Match, b: Match): number {
  const si = (a.sortIndex ?? 0) - (b.sortIndex ?? 0);
  if (si !== 0) return si;
  const da = a.date.localeCompare(b.date);
  if (da !== 0) return da;
  return a.id.localeCompare(b.id);
}

export function matchHeadline(m: Match): string {
  const idx = Array.isArray(m.fieldTeamIndexes) ? m.fieldTeamIndexes : [];
  let base: string;
  if (idx.length >= 2) {
    const a = m.teams[idx[0]]?.name ?? "Time 1";
    const b = m.teams[idx[1]]?.name ?? "Time 2";
    base = `${a} × ${b}`;
  } else {
    base = m.teams.map((t) => t.name).join(" · ");
  }
  const score = matchScoreLine(m);
  return score ? `${base} ${score}` : base;
}

export function championName(m: Match): string | null {
  if (m.championTeamIndex === null) return null;
  const t = m.teams[m.championTeamIndex];
  return t?.name ?? null;
}

/** Nome do time em campo ao qual o jogador pertence nesta partida, ou null. */
export function teamNameForPlayerOnField(m: Match, playerId: string): string | null {
  const field = fieldTeamIndexesSafe(m);
  for (const idx of field) {
    const t = m.teams[idx];
    if (t?.playerIds.includes(playerId)) {
      const name = t.name?.trim();
      return name || null;
    }
  }
  return null;
}

/** Ids dos jogadores nos dois times em campo (para cartões, validação de gol “em campo”). */
export function fieldPlayerIdsOnMatch(m: Match): Set<string> {
  const set = new Set<string>();
  for (const idx of fieldTeamIndexesSafe(m)) {
    const t = m.teams[idx];
    if (t) for (const id of t.playerIds) set.add(id);
  }
  return set;
}

/**
 * Ids de todos os jogadores de linha do rascunho do racha (times sorteados), sem goleiros do gol.
 * Usado para lista de substitutos na partida.
 */
export function rachaDraftLinhaPlayerIds(
  m: Match,
  draftsByAgendamento: Record<string, LastDraft>
): Set<string> {
  const out = new Set<string>();
  if (!m.agendamentoId) return out;
  const d = draftsByAgendamento[m.agendamentoId];
  if (!d) return out;
  for (const t of d.teams) {
    for (const id of t.playerIds) out.add(id);
  }
  return out;
}

/** Goleiros do sorteio (Gol 1 entrada e Gol 2 fundo) no racha da partida. */
export function rachaDraftGoleiroPlayerIds(
  m: Match,
  draftsByAgendamento: Record<string, LastDraft>
): Set<string> {
  const out = new Set<string>();
  if (!m.agendamentoId) return out;
  const d = draftsByAgendamento[m.agendamentoId];
  if (!d) return out;
  if (d.golEntradaPlayerId) out.add(d.golEntradaPlayerId);
  if (d.golFundoPlayerId) out.add(d.golFundoPlayerId);
  return out;
}
