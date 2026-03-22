/**
 * Envia o conteúdo de data/database.json para Supabase (pelada_state id=1).
 *
 * Uso (na pasta do projeto):
 *   node scripts/import-database-json.mjs
 *
 * Lê automaticamente `.env.local` se as variáveis não estiverem no ambiente.
 * (Node 20+ também pode usar: node --env-file=.env.local scripts/import-database-json.mjs)
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const jsonPath = path.join(root, "data", "database.json");

/**
 * Carrega KEY=valor. Com overwrite=true, o arquivo manda (útil se o Windows deixou variável vazia).
 */
function loadEnvFile(filePath, overwrite) {
  const foundKeys = [];
  if (!fs.existsSync(filePath)) return foundKeys;
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
      foundKeys.push(name);
    }
  }
  return foundKeys;
}

const pathEnv = path.join(root, ".env");
const pathEnvLocal = path.join(root, ".env.local");
loadEnvFile(pathEnv, true);
loadEnvFile(pathEnvLocal, true);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error(
    "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local (na raiz do projeto)."
  );
  console.error("");
  console.error("Diagnóstico:");
  console.error("  Pasta do projeto:", root);
  console.error("  .env existe?", fs.existsSync(pathEnv));
  console.error("  .env.local existe?", fs.existsSync(pathEnvLocal));
  if (fs.existsSync(pathEnvLocal)) {
    const sample = fs.readFileSync(pathEnvLocal, "utf8").split(/\r?\n/).slice(0, 15);
    console.error("  Primeiras linhas do .env.local (sem valores):");
    for (const ln of sample) {
      const t = ln.trim();
      if (!t || t.startsWith("#")) {
        console.error("   ", t || "(vazio)");
        continue;
      }
      const eq = t.indexOf("=");
      const k = eq > 0 ? t.slice(0, eq).trim() : t;
      const hasVal = eq > 0 && t.slice(eq + 1).trim().length > 0;
      console.error("   ", k, hasVal ? "= (tem valor)" : "= (VAZIO ou linha inválida)");
    }
    console.error("");
    console.error("Confira os nomes EXATOS (sem espaço no nome):");
    console.error("  NEXT_PUBLIC_SUPABASE_URL");
    console.error("  SUPABASE_SERVICE_ROLE_KEY");
    console.error("");
    console.error("No Windows, o arquivo não pode ser .env.local.txt (mostrar extensões nas pastas).");
  }
  process.exit(1);
}

if (!fs.existsSync(jsonPath)) {
  console.error("Arquivo não encontrado:", jsonPath);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const supabase = createClient(url, key);

const { error } = await supabase
  .from("pelada_state")
  .upsert({ id: 1, data: raw }, { onConflict: "id" });

if (error) {
  console.error("Erro no Supabase:", error.message);
  process.exit(1);
}

console.log("OK: public.pelada_state id=1 atualizado com data/database.json");
