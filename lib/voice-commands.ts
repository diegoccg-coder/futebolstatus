import type { Player } from "./types";

export type VoiceCommandKind = "goal" | "yellow" | "score";

export type VoiceCommand =
  | { kind: "goal"; player: Player; playerLabel: string }
  | { kind: "yellow"; player: Player; playerLabel: string }
  | {
      kind: "score";
      scoreFieldA: number;
      scoreFieldB: number;
      label: string;
    };

export type VoiceParseResult =
  | { ok: true; command: VoiceCommand; heard: string }
  | { ok: false; heard: string; error: string };

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  três: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
};

export function normalizeSpeechText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumberToken(token: string): number | null {
  const t = normalizeSpeechText(token);
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 && n <= 99 ? n : null;
  }
  return NUMBER_WORDS[t] ?? null;
}

function tokensOfName(name: string): string[] {
  return normalizeSpeechText(name).split(/\s+/).filter(Boolean);
}

function nameMatchesSpoken(playerName: string, spoken: string): boolean {
  const pn = normalizeSpeechText(playerName);
  const sp = normalizeSpeechText(spoken);
  if (!sp) return false;
  if (pn === sp) return true;
  if (pn.includes(sp) || sp.includes(pn)) return true;
  const pParts = tokensOfName(playerName);
  const sParts = sp.split(/\s+/).filter(Boolean);
  if (sParts.length === 1 && pParts[0] === sParts[0]) return true;
  if (sParts.every((s) => pParts.some((p) => p === s || p.startsWith(s) || s.startsWith(p)))) {
    return true;
  }
  return false;
}

export function findPlayersBySpokenName(
  spoken: string,
  players: Player[]
): { kind: "one"; player: Player } | { kind: "many"; players: Player[] } | { kind: "none" } {
  const matches = players.filter((p) => nameMatchesSpoken(p.name, spoken));
  if (matches.length === 0) return { kind: "none" };
  if (matches.length === 1) return { kind: "one", player: matches[0]! };
  return { kind: "many", players: matches };
}

function teamMatchesSpoken(teamName: string, spoken: string): boolean {
  const tn = normalizeSpeechText(teamName);
  const sp = normalizeSpeechText(spoken);
  if (!tn || !sp) return false;
  if (tn === sp || tn.includes(sp) || sp.includes(tn)) return true;
  const tnFirst = tn.split(/\s+/)[0];
  const spFirst = sp.split(/\s+/)[0];
  return Boolean(tnFirst && spFirst && (tnFirst === spFirst || tnFirst.startsWith(spFirst)));
}

function resolveTeamSide(
  spoken: string,
  teamNameA: string,
  teamNameB: string
): "a" | "b" | null {
  const a = teamMatchesSpoken(teamNameA, spoken);
  const b = teamMatchesSpoken(teamNameB, spoken);
  if (a && !b) return "a";
  if (b && !a) return "b";
  return null;
}

function parseScoreCommand(
  raw: string,
  teamNameA: string,
  teamNameB: string
): { scoreFieldA: number; scoreFieldB: number; label: string } | null {
  const text = normalizeSpeechText(raw.replace(/^placar\s+/, ""));
  const parts = text.split(/\s+/).filter(Boolean);
  const numIdx: number[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (parseNumberToken(parts[i]!) !== null) numIdx.push(i);
  }
  if (numIdx.length < 2) return null;

  const i0 = numIdx[0]!;
  const i1 = numIdx[1]!;
  const scoreSpoken0 = parseNumberToken(parts[i0]!);
  const scoreSpoken1 = parseNumberToken(parts[i1]!);
  if (scoreSpoken0 === null || scoreSpoken1 === null) return null;

  const teamSpoken0 = parts.slice(0, i0).join(" ");
  const teamSpoken1 = parts.slice(i0 + 1, i1).join(" ");

  const side0 = resolveTeamSide(teamSpoken0, teamNameA, teamNameB);
  const side1 = resolveTeamSide(teamSpoken1, teamNameA, teamNameB);
  if (!side0 || !side1 || side0 === side1) return null;

  const scoreFieldA = side0 === "a" ? scoreSpoken0 : scoreSpoken1;
  const scoreFieldB = side0 === "a" ? scoreSpoken1 : scoreSpoken0;
  const labelA = teamNameA.trim() || "Time A";
  const labelB = teamNameB.trim() || "Time B";

  return {
    scoreFieldA,
    scoreFieldB,
    label: `${labelA} ${scoreFieldA} × ${labelB} ${scoreFieldB}`,
  };
}

export function parseVoiceCommand(
  transcript: string,
  options: {
    goalPlayers: Player[];
    yellowPlayers: Player[];
    teamNameA: string;
    teamNameB: string;
  }
): VoiceParseResult {
  const heard = transcript.trim();
  const text = normalizeSpeechText(heard);
  if (!text) {
    return { ok: false, heard, error: "Não ouvi nada. Tente de novo." };
  }

  const goalMatch = text.match(/^(?:gol|goal)\s+(?:do|da|de)?\s*(.+)$/);
  if (goalMatch) {
    const name = goalMatch[1]!.trim();
    const found = findPlayersBySpokenName(name, options.goalPlayers);
    if (found.kind === "none") {
      return { ok: false, heard, error: `Jogador não encontrado: "${name}".` };
    }
    if (found.kind === "many") {
      return {
        ok: false,
        heard,
        error: `Vários jogadores: ${found.players.map((p) => p.name).join(", ")}. Fale o nome completo.`,
      };
    }
    return {
      ok: true,
      heard,
      command: {
        kind: "goal",
        player: found.player,
        playerLabel: found.player.name,
      },
    };
  }

  const yellowMatch = text.match(
    /^(?:(?:cartao|cartão)\s+)?amarelo\s+(?:para\s+)?(.+)$/
  );
  if (yellowMatch) {
    const name = yellowMatch[1]!.trim();
    const found = findPlayersBySpokenName(name, options.yellowPlayers);
    if (found.kind === "none") {
      return { ok: false, heard, error: `Jogador não encontrado: "${name}".` };
    }
    if (found.kind === "many") {
      return {
        ok: false,
        heard,
        error: `Vários jogadores: ${found.players.map((p) => p.name).join(", ")}. Fale o nome completo.`,
      };
    }
    return {
      ok: true,
      heard,
      command: {
        kind: "yellow",
        player: found.player,
        playerLabel: found.player.name,
      },
    };
  }

  if (text.startsWith("placar ")) {
    const score = parseScoreCommand(text, options.teamNameA, options.teamNameB);
    if (!score) {
      return {
        ok: false,
        heard,
        error: 'Placar não reconhecido. Ex.: "placar azul 2 preto 1".',
      };
    }
    return {
      ok: true,
      heard,
      command: {
        kind: "score",
        scoreFieldA: score.scoreFieldA,
        scoreFieldB: score.scoreFieldB,
        label: score.label,
      },
    };
  }

  return {
    ok: false,
    heard,
    error:
      'Comando não reconhecido. Use: "gol nome", "amarelo nome" ou "placar timeA 2 timeB 1".',
  };
}

export function commandSummary(command: VoiceCommand): string {
  switch (command.kind) {
    case "goal":
      return `Gol — ${command.playerLabel}`;
    case "yellow":
      return `Cartão amarelo — ${command.playerLabel}`;
    case "score":
      return `Placar — ${command.label}`;
  }
}
