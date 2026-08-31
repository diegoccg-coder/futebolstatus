/**
 * Envia fotos do backup local para a tabela champion_photos no Supabase.
 * Rode após executar supabase/champion_photos.sql no projeto novo.
 *
 * Uso: npm run import-champion-photos
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const photosPath = path.join(root, "backups", "supabase", "champion-photos-latest.json");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const eq = s.indexOf("=");
    if (eq <= 0) continue;
    const name = s.slice(0, eq).trim();
    let val = s.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[name]) process.env[name] = val;
  }
}

loadEnvFile(path.join(root, ".env"));
loadEnvFile(path.join(root, ".env.local"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local");
  process.exit(1);
}

if (!fs.existsSync(photosPath)) {
  console.error("Arquivo não encontrado:", photosPath);
  console.error("Rode antes: npm run prepare-import-from-backup");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(photosPath, "utf8"));
const photos = raw.championPhotosByAgendamento ?? raw;
if (!photos || typeof photos !== "object") {
  console.error("Formato inválido em champion-photos-latest.json");
  process.exit(1);
}

const rows = Object.entries(photos)
  .filter(([, e]) => e?.bestTeamPhotoUrl || e?.bestPlayerPhotoUrl)
  .map(([id, e]) => ({
    agendamento_id: id,
    best_team_photo_url: e.bestTeamPhotoUrl ?? null,
    best_player_photo_url: e.bestPlayerPhotoUrl ?? null,
    updated_at: e.updatedAt ?? new Date().toISOString(),
  }));

if (rows.length === 0) {
  console.log("Nenhuma foto no backup local.");
  process.exit(0);
}

console.log(`Enviando ${rows.length} racha(s) com foto para champion_photos…`);

const supabase = createClient(url, key);
const { error } = await supabase
  .from("champion_photos")
  .upsert(rows, { onConflict: "agendamento_id" });

if (error) {
  console.error("Erro:", error.message);
  console.error("\nConfira se rodou supabase/champion_photos.sql no SQL Editor.");
  process.exit(1);
}

for (const r of rows) {
  const parts = [];
  if (r.best_team_photo_url) parts.push("time");
  if (r.best_player_photo_url) parts.push("jogador");
  console.log(`  ✓ ${r.agendamento_id} (${parts.join(" + ")})`);
}

console.log("\nPronto! Abra o app → Foto do campeão e confira cada racha.");
