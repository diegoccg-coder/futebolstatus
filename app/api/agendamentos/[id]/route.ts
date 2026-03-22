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
  const i = db.agendamentos.findIndex((a) => a.id === id);
  if (i === -1) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }
  const a = db.agendamentos[i];
  if (body.date !== undefined) a.date = String(body.date).trim();
  if (body.time !== undefined) a.time = String(body.time).trim() || undefined;
  if (body.title !== undefined) a.title = String(body.title).trim() || undefined;
  if (body.notes !== undefined) a.notes = String(body.notes).trim() || undefined;
  if (body.campo !== undefined) {
    const c = body.campo;
    if (c === null || c === "") {
      delete (a as { campo?: 1 | 2 | 3 }).campo;
    } else {
      const n = Number(c);
      if (n === 1 || n === 2 || n === 3) {
        (a as { campo: 1 | 2 | 3 }).campo = n;
      }
    }
  }
  await writeDb(db);
  return NextResponse.json(a);
}

export async function DELETE(_req: Request, context: Ctx) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const { id } = await context.params;
  const db = await readDb();
  const before = db.agendamentos.length;
  db.agendamentos = db.agendamentos.filter((a) => a.id !== id);
  if (db.agendamentos.length === before) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }
  const { [id]: _removed, ...restDrafts } = db.draftsByAgendamento;
  db.draftsByAgendamento = restDrafts;
  await writeDb(db);
  return NextResponse.json({ ok: true });
}
