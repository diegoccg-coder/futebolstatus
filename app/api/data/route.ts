import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth-server";
import { createDefaultFinancasGlobais } from "@/lib/financas";
import { readDb } from "@/lib/store";
import type { UserRecord } from "@/lib/types";

function stripUsers(dbUsers: UserRecord[], include: boolean) {
  if (!include) return [];
  return dbUsers.map(({ passwordHash: _, ...u }) => u);
}

export async function GET() {
  try {
    const sessionUser = await requireSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const db = await readDb();
    const isAdmin = sessionUser.role === "admin";
    const financasByAgendamento = isAdmin ? (db.financasByAgendamento ?? {}) : {};
    const financasGlobais = isAdmin
      ? (db.financasGlobais ?? createDefaultFinancasGlobais())
      : createDefaultFinancasGlobais();
    const financasHistorico = isAdmin ? (db.financasHistorico ?? []) : [];
    return NextResponse.json(
      {
        players: db.players,
        matches: db.matches,
        lastDraft: db.lastDraft,
        draftsByAgendamento: db.draftsByAgendamento,
        agendamentos: db.agendamentos,
        sorteioWorkspace: db.sorteioWorkspace ?? null,
        financasByAgendamento,
        financasGlobais,
        financasHistorico,
        users: stripUsers(db.users, isAdmin),
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        },
      }
    );
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Erro ao carregar dados do servidor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
