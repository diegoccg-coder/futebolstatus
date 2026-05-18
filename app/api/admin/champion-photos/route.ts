import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth-server";
import { readDb, writeDb } from "@/lib/store";

/** Limite aproximado por imagem (data URL em JSON). */
const MAX_DATA_URL_LENGTH = 4_500_000;

function validatePhotoUrl(s: string | null): string | null {
  if (s === null) return null;
  if (typeof s !== "string") {
    throw new Error("Formato de imagem inválido");
  }
  const t = s.trim();
  if (t.length === 0) return null;
  if (t.length > MAX_DATA_URL_LENGTH) {
    throw new Error("Imagem muito grande. Tente outra com menos de ~3 MB.");
  }
  if (!/^data:image\/(jpeg|jpg|png|gif|webp);base64,/i.test(t)) {
    throw new Error("Envie apenas imagem (JPEG, PNG, GIF ou WebP).");
  }
  return t;
}

/**
 * Atualiza fotos do melhor time e melhor jogador para um agendamento (racha).
 * Corpo: { agendamentoId, bestTeamPhotoUrl?, bestPlayerPhotoUrl? } — omitir um campo mantém o valor atual; null remove a foto.
 */
export async function POST(req: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const agendamentoId = String(
    (body as { agendamentoId?: string }).agendamentoId ?? ""
  ).trim();
  if (!agendamentoId) {
    return NextResponse.json({ error: "agendamentoId é obrigatório" }, { status: 400 });
  }

  const db = await readDb();
  if (!db.championPhotosByAgendamento) {
    db.championPhotosByAgendamento = {};
  }
  const exists = db.agendamentos.some((a) => a.id === agendamentoId);
  if (!exists) {
    return NextResponse.json({ error: "Racha não encontrado" }, { status: 404 });
  }

  const b = body as {
    bestTeamPhotoUrl?: string | null;
    bestPlayerPhotoUrl?: string | null;
  };

  const prev = db.championPhotosByAgendamento[agendamentoId] ?? {
    bestTeamPhotoUrl: null as string | null,
    bestPlayerPhotoUrl: null as string | null,
    updatedAt: new Date().toISOString(),
  };

  let bestTeamPhotoUrl = prev.bestTeamPhotoUrl;
  let bestPlayerPhotoUrl = prev.bestPlayerPhotoUrl;

  if (b.bestTeamPhotoUrl !== undefined) {
    try {
      bestTeamPhotoUrl = validatePhotoUrl(
        b.bestTeamPhotoUrl === null ? null : b.bestTeamPhotoUrl
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro na imagem do time";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  if (b.bestPlayerPhotoUrl !== undefined) {
    try {
      bestPlayerPhotoUrl = validatePhotoUrl(
        b.bestPlayerPhotoUrl === null ? null : b.bestPlayerPhotoUrl
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro na imagem do jogador";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  db.championPhotosByAgendamento[agendamentoId] = {
    bestTeamPhotoUrl,
    bestPlayerPhotoUrl,
    updatedAt: new Date().toISOString(),
  };

  await writeDb(db);
  return NextResponse.json({ ok: true });
}
