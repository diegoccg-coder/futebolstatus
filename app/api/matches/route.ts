import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth-server";
import { newId, readDb, writeDb } from "@/lib/store";
import type { Match, MatchFormat, MatchTeamSlot } from "@/lib/types";

export async function POST(req: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const body = await req.json();
  const date = String(body.date ?? "").trim();
  const weekLabel = body.weekLabel ? String(body.weekLabel).trim() : undefined;
  const agendamentoId =
    body.agendamentoId && String(body.agendamentoId).trim()
      ? String(body.agendamentoId).trim()
      : null;
  if (!date) {
    return NextResponse.json({ error: "Data obrigatória" }, { status: 400 });
  }
  const durationMinutes =
    typeof body.durationMinutes === "number" && body.durationMinutes > 0
      ? Math.min(60, Math.round(body.durationMinutes))
      : 8;
  const format = (body.format as MatchFormat) === "racha" ? "racha" : "dupla";
  const teamCount = Number(body.teamCount);
  const n =
    teamCount === 3 || teamCount === 4 ? teamCount : teamCount === 2 ? 2 : 2;
  const rawTeams = body.teams as MatchTeamSlot[] | undefined;
  if (!Array.isArray(rawTeams) || rawTeams.length !== n) {
    return NextResponse.json({ error: "Times inválidos" }, { status: 400 });
  }
  const teams: MatchTeamSlot[] = rawTeams.map((t, i) => ({
    name: String(t.name || `Time ${i + 1}`).trim() || `Time ${i + 1}`,
    playerIds: Array.isArray(t.playerIds) ? t.playerIds : [],
    rotationOrder:
      typeof t.rotationOrder === "number" ? t.rotationOrder : i + 1,
  }));
  const rawField = Array.isArray(body.fieldTeamIndexes)
    ? (body.fieldTeamIndexes as number[])
    : [];
  const dedupField = [...new Set(rawField)].filter(
    (i) => Number.isInteger(i) && i >= 0 && i < n
  );
  const fieldTeamIndexes =
    dedupField.length >= 2 ? dedupField.slice(0, 2) : [0, 1];
  const db = await readDb();
  if (!agendamentoId) {
    return NextResponse.json(
      { error: "Selecione o racha para vincular o jogo" },
      { status: 400 }
    );
  }
  if (!db.agendamentos.some((a) => a.id === agendamentoId)) {
    return NextResponse.json({ error: "Racha inválido" }, { status: 400 });
  }
  const match: Match = {
    id: newId(),
    agendamentoId,
    date,
    weekLabel,
    durationMinutes,
    format: n === 2 ? "dupla" : format,
    teamCount: n,
    teams,
    fieldTeamIndexes,
    goals: [],
    championTeamIndex: null,
    placarField0: null,
    placarField1: null,
    decisaoPorPenaltis: false,
    penaltisConvertidos0: null,
    penaltisConvertidos1: null,
    cartoesAmarelos: [],
  };
  db.matches.unshift(match);
  await writeDb(db);
  return NextResponse.json(match);
}
