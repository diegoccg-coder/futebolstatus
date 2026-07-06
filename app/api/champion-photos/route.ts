import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth-server";
import {
  readChampionPhotoEntry,
  readChampionPhotosMap,
} from "@/lib/champion-photos-store";

/** Fotos do campeão — carregadas sob demanda (fora de /api/data). */
export async function GET(req: Request) {
  try {
    const sessionUser = await requireSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const agendamentoId = searchParams.get("agendamentoId")?.trim() ?? "";

    if (agendamentoId) {
      const entry = await readChampionPhotoEntry(agendamentoId);
      return NextResponse.json(
        { entry },
        {
          headers: {
            "Cache-Control": "private, no-store, max-age=0, must-revalidate",
          },
        }
      );
    }

    const photos = await readChampionPhotosMap();
    return NextResponse.json(
      { photos },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        },
      }
    );
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Erro ao carregar fotos do campeão";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
