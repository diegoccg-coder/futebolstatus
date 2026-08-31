import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth-server";
import { readDb, writeDb } from "@/lib/store";
import type {
  SerializedSorteioSlot,
  SorteioSharedWorkspace,
} from "@/lib/types";

function isValidSlot(s: unknown): s is SerializedSorteioSlot {
  if (s === null) return true;
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  if (typeof o.teamCount !== "number" || o.teamCount < 2 || o.teamCount > 4) {
    return false;
  }
  if (!Array.isArray(o.teams)) return false;
  for (const t of o.teams) {
    if (!t || typeof t !== "object") return false;
    const tt = t as Record<string, unknown>;
    if (typeof tt.index !== "number") return false;
    if (!Array.isArray(tt.playerIds)) return false;
    if (!tt.playerIds.every((id) => typeof id === "string")) return false;
    if (typeof tt.rotationOrder !== "number") return false;
  }
  const okId = (v: unknown) => v === undefined || v === null || typeof v === "string";
  if (!okId(o.golEntradaPlayerId) || !okId(o.golFundoPlayerId)) return false;
  return true;
}

function parsePayload(body: unknown): Omit<
  SorteioSharedWorkspace,
  "updatedAt" | "updatedByUserId" | "updatedByName"
> | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  if (!Array.isArray(o.slots) || o.slots.length !== 5) return null;
  if (!o.slots.every(isValidSlot)) return null;
  if (typeof o.activeSlotIndex !== "number") return null;
  const ai = Math.min(4, Math.max(0, Math.floor(o.activeSlotIndex)));
  const dm = Number(o.durationMinutes);
  if (!Number.isFinite(dm) || dm < 1 || dm > 60) return null;
  if (!Array.isArray(o.selectedIds) || !o.selectedIds.every((x) => typeof x === "string")) {
    return null;
  }
  const mode = o.mode === "dupla" ? "dupla" : o.mode === "racha" ? "racha" : null;
  if (!mode) return null;
  const rachaCount = o.rachaCount === 3 ? 3 : o.rachaCount === 4 ? 4 : null;
  if (!rachaCount) return null;
  const teamCount = mode === "dupla" ? 2 : rachaCount;

  let teamNamesBySlot: string[][] | null = null;
  if (Array.isArray(o.teamNamesBySlot) && o.teamNamesBySlot.length === 5) {
    const ok = o.teamNamesBySlot.every(
      (row) =>
        Array.isArray(row) && row.every((x) => typeof x === "string")
    );
    if (ok) teamNamesBySlot = o.teamNamesBySlot as string[][];
  }
  if (!teamNamesBySlot && Array.isArray(o.teamNames) && o.teamNames.every((x) => typeof x === "string")) {
    const legacy = o.teamNames as string[];
    teamNamesBySlot = Array.from({ length: 5 }, (_, i) =>
      i === 0
        ? legacy
        : Array.from({ length: teamCount }, (_, j) => `Time ${j + 1}`)
    );
  }
  if (!teamNamesBySlot) return null;

  if (typeof o.agendamentoId !== "string") return null;
  return {
    slots: o.slots as SerializedSorteioSlot[],
    activeSlotIndex: ai,
    selectedIds: o.selectedIds,
    teamNamesBySlot,
    mode,
    rachaCount,
    durationMinutes: Math.round(dm),
    agendamentoId: o.agendamentoId,
  };
}

/** Salva o sorteio em andamento (compartilhado entre admins). */
export async function POST(req: Request) {
  const user = await requireAdminSession();
  if (!user) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = parsePayload(body);
  if (!parsed) {
    return NextResponse.json({ error: "Dados do sorteio inválidos" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const ws: SorteioSharedWorkspace = {
    ...parsed,
    updatedAt: now,
    updatedByUserId: user.id,
    updatedByName: user.name ?? null,
  };

  const db = await readDb();
  db.sorteioWorkspace = ws;
  await writeDb(db);

  return NextResponse.json({ ok: true, updatedAt: now });
}

/** Remove o workspace compartilhado (não apaga drafts já vinculados ao racha). */
export async function DELETE() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const db = await readDb();
  db.sorteioWorkspace = null;
  await writeDb(db);
  return NextResponse.json({ ok: true });
}
