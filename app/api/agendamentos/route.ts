import { NextResponse } from "next/server";
import { requireAdminSession, requireSessionUser } from "@/lib/auth-server";
import { newId, readDb, writeDb } from "@/lib/store";

export async function GET() {
  if (!(await requireSessionUser())) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const db = await readDb();
  return NextResponse.json(db.agendamentos);
}

export async function POST(req: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const body = await req.json();
  const date = String(body.date ?? "").trim();
  if (!date) {
    return NextResponse.json({ error: "Data obrigatória" }, { status: 400 });
  }
  const db = await readDb();
  let campo: 1 | 2 | 3 | undefined;
  const c = body.campo;
  if (c === 1 || c === 2 || c === 3) campo = c;
  else if (c != null && c !== "") {
    const n = Number(c);
    if (n === 1 || n === 2 || n === 3) campo = n;
  }
  const item = {
    id: newId(),
    date,
    time: body.time ? String(body.time).trim() : undefined,
    title: body.title ? String(body.title).trim() : undefined,
    notes: body.notes ? String(body.notes).trim() : undefined,
    ...(campo !== undefined ? { campo } : {}),
    createdAt: new Date().toISOString(),
  };
  db.agendamentos.unshift(item);
  await writeDb(db);
  return NextResponse.json(item);
}
