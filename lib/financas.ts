import type {
  AppData,
  FinancasGlobais,
  FinancasHistoricoEntry,
  LastDraft,
  Player,
  RachaFinancas,
} from "./types";

export function parseNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = parseFloat(String(v).replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

export function normalizeFinancasGlobaisFromUnknown(raw: unknown): FinancasGlobais {
  const o =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    caixaTotal: parseNum(o.caixaTotal),
    valorPorJogador: parseNum(o.valorPorJogador),
    valorAluguelCampo: parseNum(o.valorAluguelCampo),
    valorPorGoleiro: parseNum(o.valorPorGoleiro),
    valorJuiz: parseNum(o.valorJuiz),
    updatedAt:
      typeof o.updatedAt === "string" && o.updatedAt.length > 0
        ? o.updatedAt
        : new Date().toISOString(),
  };
}

export function createDefaultFinancasGlobais(): FinancasGlobais {
  return {
    caixaTotal: null,
    valorPorJogador: null,
    valorAluguelCampo: null,
    valorPorGoleiro: null,
    valorJuiz: null,
    updatedAt: new Date().toISOString(),
  };
}

/** Lê valores antigos gravados por racha (antes da separação global/por racha). */
export function legacyMoneyFromRachaRaw(val: unknown): Partial<FinancasGlobais> | null {
  const o =
    val && typeof val === "object" && !Array.isArray(val)
      ? (val as Record<string, unknown>)
      : {};
  const keys = [
    "caixaTotal",
    "valorPorJogador",
    "valorAluguelCampo",
    "valorPorGoleiro",
    "valorJuiz",
  ] as const;
  const out: Partial<FinancasGlobais> = {};
  let any = false;
  for (const k of keys) {
    const v = parseNum(o[k]);
    if (v != null) {
      out[k] = v;
      any = true;
    }
  }
  return any ? out : null;
}

export function mergeFinancasGlobaisFillingNulls(
  base: FinancasGlobais,
  patch: Partial<FinancasGlobais>
): FinancasGlobais {
  return {
    caixaTotal: base.caixaTotal ?? patch.caixaTotal ?? null,
    valorPorJogador: base.valorPorJogador ?? patch.valorPorJogador ?? null,
    valorAluguelCampo: base.valorAluguelCampo ?? patch.valorAluguelCampo ?? null,
    valorPorGoleiro: base.valorPorGoleiro ?? patch.valorPorGoleiro ?? null,
    valorJuiz: base.valorJuiz ?? patch.valorJuiz ?? null,
    updatedAt: base.updatedAt,
  };
}

/**
 * Normaliza objeto vindo do banco ou do POST da API para `RachaFinancas`.
 * Campos de dinheiro antigos por racha são ignorados (ficam só em `financasGlobais`).
 */
export function normalizeRachaFinancasFromUnknown(
  agendamentoId: string,
  raw: unknown
): RachaFinancas {
  const o =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const jogadoresPagos = Array.isArray(o.jogadoresPagos)
    ? o.jogadoresPagos.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
  let despesasExtras: RachaFinancas["despesasExtras"] = [];
  if (Array.isArray(o.despesasExtras)) {
    despesasExtras = o.despesasExtras.map((row, i) => {
      const r =
        row && typeof row === "object" && !Array.isArray(row)
          ? (row as Record<string, unknown>)
          : {};
      const id =
        typeof r.id === "string" && r.id.trim()
          ? r.id.trim()
          : `ext-${Date.now().toString(36)}-${i}`;
      const descricao = typeof r.descricao === "string" ? r.descricao : "";
      const valor = parseNum(r.valor) ?? 0;
      return { id, descricao, valor: Math.max(0, valor) };
    });
  }
  return {
    agendamentoId,
    jogadoresPagos,
    pagamentoCampoQuitado: Boolean(o.pagamentoCampoQuitado),
    pagamentoGoleirosQuitado: Boolean(o.pagamentoGoleirosQuitado),
    pagamentoJuizQuitado: Boolean(o.pagamentoJuizQuitado),
    despesasExtras,
    updatedAt:
      typeof o.updatedAt === "string" && o.updatedAt.length > 0
        ? o.updatedAt
        : new Date().toISOString(),
  };
}

export function normalizeFinancasHistoricoFromUnknown(raw: unknown): FinancasHistoricoEntry | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" && o.id ? o.id : null;
  const at = typeof o.at === "string" && o.at ? o.at : null;
  const kind = o.kind === "globais" || o.kind === "racha" ? o.kind : null;
  const titulo = typeof o.titulo === "string" ? o.titulo : "";
  const resumo = typeof o.resumo === "string" ? o.resumo : "";
  const updatedByName =
    o.updatedByName === null
      ? null
      : typeof o.updatedByName === "string"
        ? o.updatedByName
        : null;
  const agendamentoId =
    o.agendamentoId === null
      ? null
      : typeof o.agendamentoId === "string"
        ? o.agendamentoId
        : null;
  if (!id || !at || !kind) return null;
  const globais = normalizeFinancasGlobaisFromUnknown(o.globais);
  let racha: RachaFinancas | null = null;
  if (kind === "racha" && o.racha && typeof o.racha === "object" && !Array.isArray(o.racha)) {
    const rid =
      typeof (o.racha as Record<string, unknown>).agendamentoId === "string"
        ? (o.racha as Record<string, unknown>).agendamentoId
        : "unknown";
    racha = normalizeRachaFinancasFromUnknown(String(rid), o.racha);
  }
  if (kind === "racha" && !racha) return null;
  return {
    id,
    at,
    kind,
    agendamentoId,
    titulo,
    resumo,
    updatedByName,
    globais,
    racha: kind === "racha" ? racha : null,
  };
}

export const FINANCAS_HISTORICO_MAX = 100;

export function appendFinancasHistorico(db: AppData, entry: FinancasHistoricoEntry): void {
  if (!Array.isArray(db.financasHistorico)) {
    db.financasHistorico = [];
  }
  db.financasHistorico.unshift(entry);
  if (db.financasHistorico.length > FINANCAS_HISTORICO_MAX) {
    db.financasHistorico.length = FINANCAS_HISTORICO_MAX;
  }
}

export function cloneFinancasGlobais(g: FinancasGlobais): FinancasGlobais {
  return { ...g };
}

export function cloneRachaFinancas(f: RachaFinancas): RachaFinancas {
  return {
    ...f,
    jogadoresPagos: [...f.jogadoresPagos],
    despesasExtras: f.despesasExtras.map((d) => ({ ...d })),
  };
}

export function playerIdsFromDraft(draft: LastDraft | null | undefined): string[] {
  if (!draft) return [];
  const s = new Set<string>();
  for (const t of draft.teams) {
    for (const id of t.playerIds) {
      if (id) s.add(id);
    }
  }
  if (draft.golEntradaPlayerId) s.add(draft.golEntradaPlayerId);
  if (draft.golFundoPlayerId) s.add(draft.golFundoPlayerId);
  return [...s];
}

/** Jogadores do sorteio que pagam cota de linha (cadastro diferente de goleiro). */
export function playerIdsForCotaFromDraft(
  draft: LastDraft | null | undefined,
  players: Player[]
): string[] {
  if (!draft) return [];
  const map = new Map(players.map((p) => [p.id, p]));
  return playerIdsFromDraft(draft).filter((id) => {
    const p = map.get(id);
    return !p || p.category !== "goleiro";
  });
}

export function countJogadoresPagosCota(
  f: RachaFinancas,
  draft: LastDraft | null | undefined,
  players: Player[]
): number {
  const eligible = new Set(playerIdsForCotaFromDraft(draft, players));
  return f.jogadoresPagos.filter((id) => eligible.has(id)).length;
}

export function goalkeeperCountForPayment(draft: LastDraft | null | undefined): number {
  if (!draft) return 0;
  const g = new Set<string>();
  if (draft.golEntradaPlayerId) g.add(draft.golEntradaPlayerId);
  if (draft.golFundoPlayerId) g.add(draft.golFundoPlayerId);
  return g.size;
}

export function createDefaultFinancas(agendamentoId: string): RachaFinancas {
  return {
    agendamentoId,
    jogadoresPagos: [],
    pagamentoCampoQuitado: false,
    pagamentoGoleirosQuitado: false,
    pagamentoJuizQuitado: false,
    despesasExtras: [],
    updatedAt: new Date().toISOString(),
  };
}

export function somaDespesasExtras(
  arr: RachaFinancas["despesasExtras"] | undefined
): number {
  if (!Array.isArray(arr)) return 0;
  return arr.reduce((s, d) => s + (Number.isFinite(d.valor) ? d.valor : 0), 0);
}

/**
 * Saldo do racha: receita (cota × quem pagou) menos despesas quitadas e extras.
 * Com `players`, só entram na receita pagamentos de quem não é goleiro no cadastro.
 */
export function computeSaldoRacha(
  globais: FinancasGlobais,
  f: RachaFinancas,
  draft: LastDraft | null | undefined,
  players?: Player[]
): number {
  const n =
    players !== undefined
      ? countJogadoresPagosCota(f, draft, players)
      : f.jogadoresPagos.length;
  const receita = (globais.valorPorJogador ?? 0) * n;
  let saidas = 0;
  if (f.pagamentoCampoQuitado) saidas += globais.valorAluguelCampo ?? 0;
  if (f.pagamentoGoleirosQuitado) {
    const n = goalkeeperCountForPayment(draft);
    saidas += (globais.valorPorGoleiro ?? 0) * n;
  }
  if (f.pagamentoJuizQuitado) saidas += globais.valorJuiz ?? 0;
  saidas += somaDespesasExtras(f.despesasExtras);
  return receita - saidas;
}

export function recebidoJogadoresCalculado(
  globais: FinancasGlobais,
  f: RachaFinancas,
  draft: LastDraft | null | undefined,
  players?: Player[]
): number {
  const n =
    players !== undefined
      ? countJogadoresPagosCota(f, draft, players)
      : f.jogadoresPagos.length;
  return (globais.valorPorJogador ?? 0) * n;
}

export function despesasFixasQuitadasCalculado(
  globais: FinancasGlobais,
  f: RachaFinancas,
  draft: LastDraft | null | undefined
): number {
  let saidas = 0;
  if (f.pagamentoCampoQuitado) saidas += globais.valorAluguelCampo ?? 0;
  if (f.pagamentoGoleirosQuitado) {
    const n = goalkeeperCountForPayment(draft);
    saidas += (globais.valorPorGoleiro ?? 0) * n;
  }
  if (f.pagamentoJuizQuitado) saidas += globais.valorJuiz ?? 0;
  return saidas;
}

export function computeSaldoTotalGeral(
  globais: FinancasGlobais,
  financasByAgendamento: Record<string, RachaFinancas>,
  draftsByAgendamento: Record<string, LastDraft>,
  players?: Player[]
): number {
  let s = 0;
  for (const id of Object.keys(financasByAgendamento)) {
    const f = financasByAgendamento[id];
    if (!f) continue;
    const draft = draftsByAgendamento[id] ?? null;
    s += computeSaldoRacha(globais, f, draft, players);
  }
  return s;
}

/**
 * Caixa atualizado no fechamento geral: valor inicial informado em `caixaTotal`
 * mais a soma dos resultados líquidos (receitas − despesas) de cada racha com registro.
 */
export function computeCaixaAtualizadoConsolidado(
  globais: FinancasGlobais,
  financasByAgendamento: Record<string, RachaFinancas>,
  draftsByAgendamento: Record<string, LastDraft>,
  players: Player[]
): number {
  const inicial = globais.caixaTotal ?? 0;
  return inicial + computeSaldoTotalGeral(globais, financasByAgendamento, draftsByAgendamento, players);
}

export function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function buildHistoricoResumoGlobais(g: FinancasGlobais): string {
  const parts: string[] = [];
  if (g.caixaTotal != null) parts.push(`Caixa ${formatBRL(g.caixaTotal)}`);
  if (g.valorPorJogador != null) parts.push(`Cota ${formatBRL(g.valorPorJogador)}`);
  if (g.valorAluguelCampo != null) parts.push(`Campo ${formatBRL(g.valorAluguelCampo)}`);
  if (g.valorPorGoleiro != null) parts.push(`Goleiro ${formatBRL(g.valorPorGoleiro)}`);
  if (g.valorJuiz != null) parts.push(`Juiz ${formatBRL(g.valorJuiz)}`);
  return parts.length > 0 ? parts.join(" · ") : "(sem valores numéricos)";
}

export function buildHistoricoResumoRacha(
  globais: FinancasGlobais,
  f: RachaFinancas,
  draft: LastDraft | null | undefined,
  rachaTitulo: string,
  players?: Player[]
): string {
  const n =
    players !== undefined
      ? countJogadoresPagosCota(f, draft, players)
      : f.jogadoresPagos.length;
  const saldo = computeSaldoRacha(globais, f, draft, players);
  const tags: string[] = [];
  if (f.pagamentoCampoQuitado) tags.push("campo OK");
  if (f.pagamentoGoleirosQuitado) tags.push("goleiros OK");
  if (f.pagamentoJuizQuitado) tags.push("juiz OK");
  const ext = somaDespesasExtras(f.despesasExtras);
  if (ext > 0) tags.push(`extras ${formatBRL(ext)}`);
  return `${n} pagantes · ${tags.join(", ") || "sem quit despesas fixas"} · saldo ${formatBRL(saldo)} · ${rachaTitulo}`;
}
