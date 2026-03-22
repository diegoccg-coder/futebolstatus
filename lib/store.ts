import fs from "fs";
import path from "path";
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
};

function ensureFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), "utf-8");
  }
}

export async function readDb(): Promise<AppData> {
  if (isSupabaseConfigured() && supabaseAdmin) {
    // Supabase: guarda o estado inteiro do app em um único `jsonb`.
    let rowData: unknown = null;
    try {
      const { data } = await supabaseAdmin
        .from(SUPA_TABLE)
        .select("data")
        .eq("id", SUPA_STATE_ID)
        .single();
      rowData = data?.data ?? null;
    } catch {
      rowData = null;
    }

    const parsed = (rowData ?? defaultData) as Partial<AppData>;
    const { data, dirty } = migrateAppData(parsed);
    if (dirty) {
      await writeDb(data);
    }
    return data;
  }

  // Fallback local: JSON no disco.
  ensureFile();
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  try {
    const parsed = JSON.parse(raw) as Partial<AppData>;
    const { data, dirty } = migrateAppData(parsed);
    if (dirty) {
      await writeDb(data);
    }
    return data;
  } catch {
    const { data, dirty } = migrateAppData({});
    if (dirty) {
      await writeDb(data);
    }
    return data;
  }
}

export async function writeDb(data: AppData): Promise<void> {
  if (isSupabaseConfigured() && supabaseAdmin) {
    await supabaseAdmin
      .from(SUPA_TABLE)
      .upsert({ id: SUPA_STATE_ID, data }, { onConflict: "id" });
    return;
  }

  ensureFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
