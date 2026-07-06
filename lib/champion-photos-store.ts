import fs from "fs";
import path from "path";
import { isSupabaseConfigured, supabaseAdmin } from "./supabase-admin";
import type { ChampionPhotosEntry } from "./types";

const SUPA_TABLE = "champion_photos";
const DATA_DIR = path.join(process.cwd(), "data");
const PHOTOS_FILE = path.join(DATA_DIR, "champion-photos.json");

type Row = {
  agendamento_id: string;
  best_team_photo_url: string | null;
  best_player_photo_url: string | null;
  updated_at: string;
};

function rowToEntry(row: Row): ChampionPhotosEntry {
  return {
    bestTeamPhotoUrl: row.best_team_photo_url,
    bestPlayerPhotoUrl: row.best_player_photo_url,
    updatedAt: row.updated_at,
  };
}

function entryToRow(agendamentoId: string, entry: ChampionPhotosEntry): Row {
  return {
    agendamento_id: agendamentoId,
    best_team_photo_url: entry.bestTeamPhotoUrl,
    best_player_photo_url: entry.bestPlayerPhotoUrl,
    updated_at: entry.updatedAt,
  };
}

function readLocalMap(): Record<string, ChampionPhotosEntry> {
  if (!fs.existsSync(PHOTOS_FILE)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(PHOTOS_FILE, "utf-8")) as Record<
      string,
      ChampionPhotosEntry
    >;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return raw;
  } catch {
    return {};
  }
}

function writeLocalMap(map: Record<string, ChampionPhotosEntry>): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(PHOTOS_FILE, JSON.stringify(map, null, 2), "utf-8");
}

export function hasChampionPhotoPayload(
  photos: Record<string, ChampionPhotosEntry>
): boolean {
  return Object.values(photos).some(
    (e) => e?.bestTeamPhotoUrl || e?.bestPlayerPhotoUrl
  );
}

/** Grava fotos legadas (JSON antigo) na tabela/arquivo dedicado. */
export async function migrateLegacyChampionPhotos(
  photos: Record<string, ChampionPhotosEntry>
): Promise<void> {
  if (!hasChampionPhotoPayload(photos)) return;

  if (isSupabaseConfigured() && supabaseAdmin) {
    const rows = Object.entries(photos)
      .filter(([, e]) => e?.bestTeamPhotoUrl || e?.bestPlayerPhotoUrl)
      .map(([id, e]) => entryToRow(id, e));
    if (rows.length === 0) return;
    const { error } = await supabaseAdmin
      .from(SUPA_TABLE)
      .upsert(rows, { onConflict: "agendamento_id" });
    if (error) {
      throw new Error(error.message || "Erro ao migrar fotos para o Supabase");
    }
    return;
  }

  const current = readLocalMap();
  for (const [id, e] of Object.entries(photos)) {
    if (!e?.bestTeamPhotoUrl && !e?.bestPlayerPhotoUrl) continue;
    current[id] = e;
  }
  writeLocalMap(current);
}

export async function readChampionPhotosMap(): Promise<
  Record<string, ChampionPhotosEntry>
> {
  if (isSupabaseConfigured() && supabaseAdmin) {
    const { data, error } = await supabaseAdmin.from(SUPA_TABLE).select("*");
    if (error) {
      throw new Error(error.message || "Erro ao ler fotos no Supabase");
    }
    const out: Record<string, ChampionPhotosEntry> = {};
    for (const row of (data ?? []) as Row[]) {
      out[row.agendamento_id] = rowToEntry(row);
    }
    return out;
  }
  return readLocalMap();
}

export async function readChampionPhotoEntry(
  agendamentoId: string
): Promise<ChampionPhotosEntry | null> {
  if (isSupabaseConfigured() && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from(SUPA_TABLE)
      .select("*")
      .eq("agendamento_id", agendamentoId)
      .maybeSingle();
    if (error) {
      throw new Error(error.message || "Erro ao ler foto no Supabase");
    }
    if (!data) return null;
    return rowToEntry(data as Row);
  }
  return readLocalMap()[agendamentoId] ?? null;
}

export async function upsertChampionPhotoEntry(
  agendamentoId: string,
  entry: ChampionPhotosEntry
): Promise<void> {
  if (isSupabaseConfigured() && supabaseAdmin) {
    const { error } = await supabaseAdmin
      .from(SUPA_TABLE)
      .upsert(entryToRow(agendamentoId, entry), {
        onConflict: "agendamento_id",
      });
    if (error) {
      throw new Error(error.message || "Erro ao gravar foto no Supabase");
    }
    return;
  }

  const map = readLocalMap();
  map[agendamentoId] = entry;
  writeLocalMap(map);
}
