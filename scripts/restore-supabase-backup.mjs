/**
 * Restaura no Supabase um backup gerado por scripts/backup-supabase.mjs.
 *
 * Uso:
 *   node scripts/restore-supabase-backup.mjs backups/supabase/pelada_state-latest.json
 *
 * Variáveis necessárias:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnvFile(filePath, overwrite) {
  if (!fs.existsSync(filePath)) return;
  let text = fs.readFileSync(filePath, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  for (const line of text.split(/\r?\n/)) {
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
    if (!name) continue;
    if (overwrite || process.env[name] === undefined || !String(process.env[name]).trim()) {
      process.env[name] = val;
    }
  }
}

loadEnvFile(path.join(root, ".env"), true);
loadEnvFile(path.join(root, ".env.local"), true);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Uso: node scripts/restore-supabase-backup.mjs <arquivo-backup.json>");
  process.exit(1);
}

const resolvedInput = path.isAbsolute(inputPath) ? inputPath : path.join(root, inputPath);
if (!fs.existsSync(resolvedInput)) {
  console.error("Arquivo não encontrado:", resolvedInput);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(resolvedInput, "utf8"));
const backupData = raw?.row?.data ?? raw?.data ?? null;
if (!backupData || typeof backupData !== "object") {
  console.error("Backup inválido: não encontrei objeto de dados em row.data ou data.");
  process.exit(1);
}

const supabase = createClient(url, key);
const { error } = await supabase
  .from("pelada_state")
  .upsert({ id: 1, data: backupData }, { onConflict: "id" });

if (error) {
  console.error("Erro ao restaurar:", error.message);
  process.exit(1);
}

console.log("Restore concluído com sucesso a partir de:");
console.log(" ", resolvedInput);
