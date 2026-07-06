/**
 * Gera data/database.json enxuto a partir do backup local (sem fotos no JSON).
 * Use antes de import-db em um projeto Supabase novo.
 *
 * Uso: npm run prepare-import-from-backup
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const backupPath = path.join(root, "backups", "supabase", "pelada_state-latest.json");
const outPath = path.join(root, "data", "database.json");
const photosOut = path.join(root, "backups", "supabase", "champion-photos-latest.json");

if (!fs.existsSync(backupPath)) {
  console.error("Backup não encontrado:", backupPath);
  console.error("Rode npm run backup-supabase quando o Supabase voltar, ou use outro arquivo.");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(backupPath, "utf8"));
const appData = raw.row?.data ?? raw.data ?? raw;
if (!appData || typeof appData !== "object") {
  console.error("Formato de backup inválido.");
  process.exit(1);
}

const photos = appData.championPhotosByAgendamento ?? {};
const hasPhotos = Object.values(photos).some(
  (e) => e && (e.bestTeamPhotoUrl || e.bestPlayerPhotoUrl)
);

if (hasPhotos) {
  fs.mkdirSync(path.dirname(photosOut), { recursive: true });
  fs.writeFileSync(
    photosOut,
    JSON.stringify(
      { exportedAt: new Date().toISOString(), championPhotosByAgendamento: photos },
      null,
      2
    ),
    "utf8"
  );
  console.log("Fotos salvas em:", photosOut);
}

const stripped = { ...appData, championPhotosByAgendamento: {} };
const beforeKb = Math.round(JSON.stringify(appData).length / 1024);
const afterKb = Math.round(JSON.stringify(stripped).length / 1024);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(stripped, null, 2), "utf8");

const matches = Array.isArray(stripped.matches) ? stripped.matches.length : 0;
const players = Array.isArray(stripped.players) ? stripped.players.length : 0;

console.log("\nArquivo pronto para importação:", outPath);
console.log(`Tamanho: ${beforeKb} KB → ${afterKb} KB`);
console.log(`Jogadores: ${players} | Jogos: ${matches}`);
console.log("\nPróximo passo (projeto Supabase NOVO com .env.local atualizado):");
console.log("  1. Execute pelada_state.sql no SQL Editor do projeto novo");
console.log("  2. npm run import-db");
