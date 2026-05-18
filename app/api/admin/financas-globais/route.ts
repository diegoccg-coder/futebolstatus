import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth-server";
import {
  appendFinancasHistorico,
  buildHistoricoResumoGlobais,
  cloneFinancasGlobais,
  normalizeFinancasGlobaisFromUnknown,
} from "@/lib/financas";
import { newId, readDb, writeDb } from "@/lib/store";

const KEYS = [
  "caixaTotal",
  "valorPorJogador",
  "valorAluguelCampo",
  "valorPorGoleiro",
  "valorJuiz",
] as const;

/**
 * Atualiza tarifas e caixa geral (válidos para todos os rachas).
 * Corpo: campos opcionais entre caixaTotal, valorPorJogador, valorAluguelCampo, valorPorGoleiro, valorJuiz (null limpa).
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

  const db = await readDb();
  if (!db.financasGlobais) {
    db.financasGlobais = normalizeFinancasGlobaisFromUnknown({});
  }

  const patch: Record<string, unknown> = {};
  for (const k of KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      patch[k] = body[k];
    }
  }

  const next = normalizeFinancasGlobaisFromUnknown({
    ...db.financasGlobais,
    ...patch,
  });
  next.updatedAt = new Date().toISOString();
  db.financasGlobais = next;

  appendFinancasHistorico(db, {
    id: newId(),
    at: next.updatedAt,
    kind: "globais",
    agendamentoId: null,
    titulo: "Valores gerais",
    resumo: buildHistoricoResumoGlobais(next),
    updatedByName: admin.name?.trim() || null,
    globais: cloneFinancasGlobais(next),
    racha: null,
  });

  await writeDb(db);
  return NextResponse.json({ ok: true });
}
