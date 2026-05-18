import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth-server";
import {
  appendFinancasHistorico,
  buildHistoricoResumoRacha,
  cloneFinancasGlobais,
  cloneRachaFinancas,
  normalizeRachaFinancasFromUnknown,
} from "@/lib/financas";
import { newId, readDb, writeDb } from "@/lib/store";

function agendamentoLabel(
  a: { date: string; time?: string; title?: string } | undefined,
  id: string
): string {
  if (!a) return id;
  const t = a.time ? ` · ${a.time}` : "";
  const title = a.title ? ` — ${a.title}` : "";
  return `${a.date}${t}${title}`;
}

/**
 * Salva finanças de um racha (sem tarifas globais).
 * Corpo: { agendamentoId, ...campos de RachaFinancas }.
 */
export async function POST(req: Request) {
  const admin = await requireAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    const j = await req.json();
    body = j && typeof j === "object" && !Array.isArray(j) ? (j as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const agendamentoId = String(body.agendamentoId ?? "").trim();
  if (!agendamentoId) {
    return NextResponse.json({ error: "agendamentoId é obrigatório" }, { status: 400 });
  }

  const db = await readDb();
  if (!db.financasByAgendamento) {
    db.financasByAgendamento = {};
  }
  if (!db.financasGlobais) {
    return NextResponse.json({ error: "Estado de finanças incompleto" }, { status: 500 });
  }

  const exists = db.agendamentos.some((a) => a.id === agendamentoId);
  if (!exists) {
    return NextResponse.json({ error: "Racha não encontrado" }, { status: 404 });
  }

  const { agendamentoId: _aid, ...rest } = body;
  const next = normalizeRachaFinancasFromUnknown(agendamentoId, rest);
  next.updatedAt = new Date().toISOString();

  db.financasByAgendamento[agendamentoId] = next;

  const ag = db.agendamentos.find((x) => x.id === agendamentoId);
  const titulo = agendamentoLabel(ag, agendamentoId);
  const draft = db.draftsByAgendamento[agendamentoId] ?? null;

  appendFinancasHistorico(db, {
    id: newId(),
    at: next.updatedAt,
    kind: "racha",
    agendamentoId,
    titulo,
    resumo: buildHistoricoResumoRacha(db.financasGlobais, next, draft, titulo, db.players),
    updatedByName: admin.name?.trim() || null,
    globais: cloneFinancasGlobais(db.financasGlobais),
    racha: cloneRachaFinancas(next),
  });

  await writeDb(db);
  return NextResponse.json({ ok: true });
}
