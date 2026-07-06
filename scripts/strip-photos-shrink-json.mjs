/**
 * Reduz egress: remove fotos do JSON principal (pelada_state) via API REST.
 * Não precisa do SQL Editor — só service_role no .env.local.
 *
 * As fotos são salvas em backups/champion-photos-latest.json antes de remover.
 * Depois que o painel voltar, rode champion_photos.sql e npm run migrate-champion-photos
 * para recolocar as fotos na tabela dedicada.
 *
 * Uso: npm run strip-photos-json
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

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

const supabase = createClient(url, key);

function hasPhotos(photos) {
  if (!photos || typeof photos !== "object") return false;
  return Object.values(photos).some(
    (e) => e && (e.bestTeamPhotoUrl || e.bestPlayerPhotoUrl)
  );
}

console.log("Lendo pelada_state…");
const { data: row, error: readErr } = await supabase
  .from("pelada_state")
  .select("data")
  .eq("id", 1)
  .single();

if (readErr) {
  console.error("Erro ao ler:", readErr.message);
  console.error(
    "\nSe a API também falhar, o projeto pode estar restrito pelo egress.",
    "Aguarde o ciclo de cobrança ou crie um projeto Supabase novo (free) e importe um backup."
  );
  process.exit(1);
}

const appData = row?.data ?? {};
const photos = appData.championPhotosByAgendamento ?? {};

if (!hasPhotos(photos)) {
  const kb = Math.round(JSON.stringify(appData).length / 1024);
  console.log(`JSON já sem fotos embutidas (${kb} KB). Nada a fazer.`);
  process.exit(0);
}

const backupDir = path.join(root, "backups", "supabase");
fs.mkdirSync(backupDir, { recursive: true });
const photosPath = path.join(backupDir, "champion-photos-latest.json");
fs.writeFileSync(
  photosPath,
  JSON.stringify(
    { exportedAt: new Date().toISOString(), championPhotosByAgendamento: photos },
    null,
    2
  ),
  "utf8"
);
console.log("Backup das fotos:", photosPath);

const stripped = { ...appData, championPhotosByAgendamento: {} };
const beforeKb = Math.round(JSON.stringify(appData).length / 1024);
const afterKb = Math.round(JSON.stringify(stripped).length / 1024);

console.log(`Gravando JSON enxuto (${beforeKb} KB → ${afterKb} KB)…`);
const { error: writeErr } = await supabase
  .from("pelada_state")
  .upsert({ id: 1, data: stripped }, { onConflict: "id" });

if (writeErr) {
  console.error("Erro ao gravar:", writeErr.message);
  process.exit(1);
}

console.log("\nPronto! O egress por leitura deve cair bastante.");
console.log("Fotos salvas localmente em backups/ — recupere na tabela quando o SQL voltar.");
