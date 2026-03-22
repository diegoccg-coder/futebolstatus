import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdminSession } from "@/lib/auth-server";
import { newId, readDb, writeDb } from "@/lib/store";
import type { UserPublic, UserRecord, UserRole } from "@/lib/types";

function toPublic(u: UserRecord): UserPublic {
  const { passwordHash: _, ...rest } = u;
  return rest;
}

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const db = await readDb();
  return NextResponse.json(db.users.map((u) => toPublic(u)));
}

export async function POST(req: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const body = await req.json();
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const name = String(body.name ?? "").trim();
  const password = String(body.password ?? "");
  const role = body.role === "admin" ? "admin" : ("jogador" as UserRole);
  const playerId =
    body.playerId && String(body.playerId).trim() ? String(body.playerId).trim() : null;
  if (!email || !name || password.length < 4) {
    return NextResponse.json(
      { error: "Email, nome e senha (mín. 4 caracteres) são obrigatórios" },
      { status: 400 }
    );
  }
  const db = await readDb();
  if (db.users.some((u) => u.email.toLowerCase() === email)) {
    return NextResponse.json({ error: "Email já cadastrado" }, { status: 400 });
  }
  const user = {
    id: newId(),
    email,
    name,
    passwordHash: bcrypt.hashSync(password, 10),
    role,
    playerId,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  await writeDb(db);
  return NextResponse.json(toPublic(user));
}
