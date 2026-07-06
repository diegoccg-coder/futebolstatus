/**
 * Move fotos do campeão do JSON principal (pelada_state) para a tabela champion_photos.
 * Rode uma vez após executar supabase/champion_photos.sql no SQL Editor.
 *
 * Uso: npm run migrate-champion-photos
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

function loadEnvLocal() {
  const p = join(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf-8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

function hasPhotos(photos) {
  if (!photos || typeof photos !== "object") return false;
  return Object.values(photos).some(
    (e) => e && (e.bestTeamPhotoUrl || e.bestPlayerPhotoUrl)
  );
}

const { data: row, error: readErr } = await supabase
  .from("pelada_state")
  .select("data")
  .eq("id", 1)
  .single();

if (readErr) {
  console.error("Erro ao ler pelada_state:", readErr.message);
  process.exit(1);
}

const appData = row?.data ?? {};
const photos = appData.championPhotosByAgendamento ?? {};

if (!hasPhotos(photos)) {
  console.log("Nenhuma foto no JSON principal — nada a migrar.");
  process.exit(0);
}

const rows = Object.entries(photos)
  .filter(([, e]) => e?.bestTeamPhotoUrl || e?.bestPlayerPhotoUrl)
  .map(([id, e]) => ({
    agendamento_id: id,
    best_team_photo_url: e.bestTeamPhotoUrl ?? null,
    best_player_photo_url: e.bestPlayerPhotoUrl ?? null,
    updated_at: e.updatedAt ?? new Date().toISOString(),
  }));

console.log(`Migrando ${rows.length} racha(s) com foto…`);

const { error: upsertErr } = await supabase
  .from("champion_photos")
  .upsert(rows, { onConflict: "agendamento_id" });

if (upsertErr) {
  console.error("Erro ao gravar champion_photos:", upsertErr.message);
  console.error(
    "Execute antes o SQL em supabase/champion_photos.sql no painel do Supabase."
  );
  process.exit(1);
}

const stripped = { ...appData, championPhotosByAgendamento: {} };
const beforeKb = Math.round(JSON.stringify(appData).length / 1024);
const afterKb = Math.round(JSON.stringify(stripped).length / 1024);

const { error: writeErr } = await supabase
  .from("pelada_state")
  .upsert({ id: 1, data: stripped }, { onConflict: "id" });

if (writeErr) {
  console.error("Fotos migradas, mas falhou ao limpar o JSON:", writeErr.message);
  process.exit(1);
}

console.log(`OK. JSON principal: ${beforeKb} KB → ${afterKb} KB (fotos na tabela champion_photos).`);
