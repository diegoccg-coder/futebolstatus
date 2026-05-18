import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth-server";
import { readDb, writeDb } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: Ctx) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const { id } = await context.params;
  const body = await req.json();
  const db = await readDb();
  const i = db.players.findIndex((p) => p.id === id);
  if (i === -1) {
    return NextResponse.json({ error: "Jogador não encontrado" }, { status: 404 });
  }
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name) db.players[i].name = name;
  }
  if (body.stars !== undefined) {
    db.players[i].stars = Math.min(5, Math.max(1, Number(body.stars) || 3));
  }
  if (body.category !== undefined) {
    db.players[i].category =
      body.category === "goleiro" ? "goleiro" : "campo";
  }
  await writeDb(db);
  return NextResponse.json(db.players[i]);
}

export async function DELETE(_req: Request, context: Ctx) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const { id } = await context.params;
  const db = await readDb();
  const before = db.players.length;
  db.players = db.players.filter((p) => p.id !== id);
  if (db.players.length === before) {
    return NextResponse.json({ error: "Jogador não encontrado" }, { status: 404 });
  }
  for (const m of db.matches) {
    for (const t of m.teams) {
      t.playerIds = t.playerIds.filter((x) => x !== id);
    }
    m.goals = m.goals
      .filter((g) => g.scorerId !== id)
      .map((g) =>
        g.assistId === id ? { ...g, assistId: null } : g
      );
    m.cartoesAmarelos = m.cartoesAmarelos.filter((x) => x !== id);
  }
  await writeDb(db);
  return NextResponse.json({ ok: true });
}
