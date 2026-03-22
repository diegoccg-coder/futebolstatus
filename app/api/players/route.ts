import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth-server";
import { newId, readDb, writeDb } from "@/lib/store";

export async function POST(req: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const stars = Math.min(5, Math.max(1, Number(body.stars) || 3));
  if (!name) {
    return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  }
  const db = await readDb();
  const player = {
    id: newId(),
    name,
    stars,
    createdAt: new Date().toISOString(),
  };
  db.players.push(player);
  await writeDb(db);
  return NextResponse.json(player);
}
