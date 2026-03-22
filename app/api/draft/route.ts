import { NextResponse } from "next/server";
import { requireAdminSession, requireSessionUser } from "@/lib/auth-server";
import { readDb, writeDb } from "@/lib/store";
import type { LastDraft, MatchFormat, MatchTeamSlot } from "@/lib/types";

export async function GET() {
  if (!(await requireSessionUser())) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const db = await readDb();
  return NextResponse.json(db.lastDraft);
}

export async function POST(req: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const body = await req.json();
  const format = (body.format as MatchFormat) === "racha" ? "racha" : "dupla";
  const teamCount = Number(body.teamCount);
  const n =
    teamCount === 3 || teamCount === 4 ? teamCount : teamCount === 2 ? 2 : 2;
  const durationMinutes =
    typeof body.durationMinutes === "number" && body.durationMinutes > 0
      ? Math.min(60, Math.round(body.durationMinutes))
      : 8;
  const rawTeams = body.teams as MatchTeamSlot[] | undefined;
  const agendamentoId =
    body.agendamentoId && String(body.agendamentoId).trim()
      ? String(body.agendamentoId).trim()
      : null;
  if (!agendamentoId) {
    return NextResponse.json(
      { error: "Selecione o racha para vincular o sorteio" },
      { status: 400 }
    );
  }
  if (!Array.isArray(rawTeams) || rawTeams.length !== n) {
    return NextResponse.json({ error: "Lista de times inválida" }, { status: 400 });
  }
  const teams: MatchTeamSlot[] = rawTeams.map((t, i) => ({
    name: String(t.name || `Time ${i + 1}`).trim() || `Time ${i + 1}`,
    playerIds: Array.isArray(t.playerIds) ? t.playerIds : [],
    rotationOrder:
      typeof t.rotationOrder === "number" ? t.rotationOrder : i + 1,
  }));
  const db = await readDb();
  if (!db.agendamentos.some((a) => a.id === agendamentoId)) {
    return NextResponse.json({ error: "Racha inválido" }, { status: 400 });
  }
  const draft: LastDraft = {
    agendamentoId,
    format: n === 2 ? "dupla" : format,
    teamCount: n,
    durationMinutes,
    teams,
    createdAt: new Date().toISOString(),
  };
  db.lastDraft = draft;
  db.draftsByAgendamento = { ...db.draftsByAgendamento, [agendamentoId]: draft };
  await writeDb(db);
  return NextResponse.json(draft);
}
