import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdminSession } from "@/lib/auth-server";
import { readDb, writeDb } from "@/lib/store";
import type { UserPublic, UserRecord, UserRole } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

function toPublic(u: UserRecord): UserPublic {
  const { passwordHash: _, ...rest } = u;
  return rest;
}

export async function PATCH(req: Request, context: Ctx) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const { id } = await context.params;
  const body = await req.json();
  const db = await readDb();
  const i = db.users.findIndex((u) => u.id === id);
  if (i === -1) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }
  const admins = db.users.filter((u) => u.role === "admin");
  if (body.role === "jogador" && db.users[i].role === "admin" && admins.length <= 1) {
    return NextResponse.json(
      { error: "Não é possível rebaixar o único administrador" },
      { status: 400 }
    );
  }
  if (body.name !== undefined) {
    const n = String(body.name).trim();
    if (n) db.users[i].name = n;
  }
  if (body.role === "admin" || body.role === "jogador") {
    db.users[i].role = body.role as UserRole;
  }
  if (body.playerId !== undefined) {
    db.users[i].playerId =
      body.playerId && String(body.playerId).trim()
        ? String(body.playerId).trim()
        : null;
  }
  if (body.password !== undefined && String(body.password).length >= 4) {
    db.users[i].passwordHash = bcrypt.hashSync(String(body.password), 10);
  }
  await writeDb(db);
  return NextResponse.json(toPublic(db.users[i]));
}

export async function DELETE(_req: Request, context: Ctx) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const { id } = await context.params;
  const db = await readDb();
  const u = db.users.find((x) => x.id === id);
  if (!u) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }
  if (u.role === "admin" && db.users.filter((x) => x.role === "admin").length <= 1) {
    return NextResponse.json(
      { error: "Não é possível excluir o único administrador" },
      { status: 400 }
    );
  }
  db.users = db.users.filter((x) => x.id !== id);
  await writeDb(db);
  return NextResponse.json({ ok: true });
}
