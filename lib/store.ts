import fs from "fs";
import path from "path";
import {
  hasChampionPhotoPayload,
  migrateLegacyChampionPhotos,
} from "./champion-photos-store";
import { createDefaultFinancasGlobais } from "./financas";
import { migrateAppData } from "./migrate";
import type { AppData } from "./types";
import { supabaseAdmin, isSupabaseConfigured } from "./supabase-admin";
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "database.json");

const SUPA_TABLE = "pelada_state";
const SUPA_STATE_ID = 1;

const defaultData: AppData = {
  players: [],
  matches: [],
  lastDraft: null,
  draftsByAgendamento: {},
  users: [],
  agendamentos: [],
  championPhotosByAgendamento: {},
  sorteioWorkspace: null,
  financasByAgendamento: {},
  financasGlobais: createDefaultFinancasGlobais(),
  financasHistorico: [],
};

function ensureFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), "utf-8");
  }
}

function stripChampionPhotos(data: AppData): AppData {
  return { ...data, championPhotosByAgendamento: {} };
}

async function finalizeRead(data: AppData, dirty: boolean): Promise<AppData> {
  const legacyPhotos = data.championPhotosByAgendamento ?? {};
  const hadLegacyPhotos = hasChampionPhotoPayload(legacyPhotos);

  if (hadLegacyPhotos) {
    await migrateLegacyChampionPhotos(legacyPhotos);
    dirty = true;
  }

  const withoutPhotos = stripChampionPhotos(data);

  if (dirty) {
    try {
      await writeDb(withoutPhotos);
    } catch (e) {
      console.error("writeDb após migrate:", e);
    }
  }

  return withoutPhotos;
}

export async function readDb(): Promise<AppData> {  if (isSupabaseConfigured() && supabaseAdmin) {
    // Supabase: guarda o estado inteiro do app em um único `jsonb`.
    let rowData: unknown = null;
    const { data: row, error: readError } = await supabaseAdmin
      .from(SUPA_TABLE)
      .select("data")
      .eq("id", SUPA_STATE_ID)
      .single();
    if (readError && readError.code !== "PGRST116") {
      throw new Error(readError.message || "Erro ao ler dados no Supabase");
    }
    rowData = row?.data ?? null;

    const parsed = (rowData ?? defaultData) as Partial<AppData>;
    const { data, dirty } = migrateAppData(parsed);
    return finalizeRead(data, dirty);
  }
  // Fallback local: JSON no disco.
  ensureFile();
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  try {
    const parsed = JSON.parse(raw) as Partial<AppData>;
    const { data, dirty } = migrateAppData(parsed);
    return finalizeRead(data, dirty);
  } catch {
    const { data, dirty } = migrateAppData({});
    return finalizeRead(data, dirty);
  }
}
export async function writeDb(data: AppData): Promise<void> {
  const payload = stripChampionPhotos(data);

  if (isSupabaseConfigured() && supabaseAdmin) {
    const { error } = await supabaseAdmin
      .from(SUPA_TABLE)
      .upsert({ id: SUPA_STATE_ID, data: payload }, { onConflict: "id" });    if (error) {
      throw new Error(error.message || "Erro ao gravar no Supabase");
    }
    return;
  }

  ensureFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), "utf-8");
}
export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
