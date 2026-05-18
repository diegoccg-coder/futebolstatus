/**
 * Exporta o estado atual do Supabase (public.pelada_state id=1) para arquivo JSON.
 *
 * Uso:
 *   node scripts/backup-supabase.mjs
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

const supabase = createClient(url, key);
const { data, error } = await supabase
  .from("pelada_state")
  .select("id, data, updated_at")
  .eq("id", 1)
  .single();

if (error) {
  console.error("Erro ao ler Supabase:", error.message);
  process.exit(1);
}

const now = new Date();
const stamp = now.toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(root, "backups", "supabase");
fs.mkdirSync(backupDir, { recursive: true });

const payload = {
  exportedAt: now.toISOString(),
  source: {
    supabaseUrl: url,
    table: "pelada_state",
    id: 1,
  },
  row: data,
};

const datedPath = path.join(backupDir, `pelada_state-${stamp}.json`);
const latestPath = path.join(backupDir, "pelada_state-latest.json");

fs.writeFileSync(datedPath, JSON.stringify(payload, null, 2), "utf8");
fs.writeFileSync(latestPath, JSON.stringify(payload, null, 2), "utf8");

const counts = {
  players: Array.isArray(data?.data?.players) ? data.data.players.length : 0,
  matches: Array.isArray(data?.data?.matches) ? data.data.matches.length : 0,
  agendamentos: Array.isArray(data?.data?.agendamentos) ? data.data.agendamentos.length : 0,
};

console.log("Backup criado:");
console.log(" ", datedPath);
console.log("Atualizado:");
console.log(" ", latestPath);
console.log("Resumo:", counts);
