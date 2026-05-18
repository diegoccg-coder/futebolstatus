import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth-server";
import { readDb, writeDb } from "@/lib/store";

/** Remove todos os jogos registrados (zera gols, vitórias e ranking derivado). */
export async function POST() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const db = await readDb();
  db.matches = [];
  await writeDb(db);
  return NextResponse.json({ ok: true });
}
