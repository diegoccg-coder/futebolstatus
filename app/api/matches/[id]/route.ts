import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth-server";
import {
  fieldPlayerIdsOnMatch,
  rachaDraftGoleiroPlayerIds,
  rachaDraftLinhaPlayerIds,
} from "@/lib/matchUi";
import { newId, readDb, writeDb } from "@/lib/store";
import { sortMatchesForRacha } from "@/lib/jogos-helpers";
import type { AppData, Goal, Match, MatchTeamSlot } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

function matchesInSameRacha(db: AppData, agendamentoId: string): Match[] {
  return sortMatchesForRacha(
    db.matches.filter((x) => x.agendamentoId === agendamentoId)
  );
}

function renumberSortIndexes(matches: Match[]) {
  matches.forEach((m, i) => {
    m.sortIndex = i;
  });
}

function clampPlacar(v: unknown): number | null {
  if (v === null || v === "") return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(99, n);
}

function playerIdsEligibleForCards(m: Match): Set<string> {
  const set = new Set<string>();
  const idx = Array.isArray(m.fieldTeamIndexes) ? m.fieldTeamIndexes.slice(0, 2) : [0, 1];
  for (const i of idx) {
    const t = m.teams[i];
    if (t) for (const pid of t.playerIds) set.add(pid);
  }
  return set;
}

function registeredPlayerOrNull(db: AppData, playerId: string) {
  return db.players.find((x) => x.id === playerId) ?? null;
}

function reconcileScoring(m: Match) {
  const tie =
    m.placarField0 !== null &&
    m.placarField1 !== null &&
    m.placarField0 === m.placarField1;
  if (!tie) {
    m.decisaoPorPenaltis = false;
    m.penaltisConvertidos0 = null;
    m.penaltisConvertidos1 = null;
  }
}

export async function PATCH(req: Request, context: Ctx) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const { id } = await context.params;
  const body = await req.json();
  const db = await readDb();
  const m = db.matches.find((x) => x.id === id);
  if (!m) {
    return NextResponse.json({ error: "Jogo não encontrado" }, { status: 404 });
  }
  if (body.makeFirstInRacha === true) {
    if (!m.agendamentoId) {
      return NextResponse.json(
        { error: "Apenas jogos vinculados a racha podem ser reordenados" },
        { status: 400 }
      );
    }
    const ordered = matchesInSameRacha(db, m.agendamentoId);
    renumberSortIndexes(ordered);
    const idx = ordered.findIndex((x) => x.id === m.id);
    if (idx > 0) {
      const [removed] = ordered.splice(idx, 1);
      ordered.unshift(removed!);
      renumberSortIndexes(ordered);
    }
    await writeDb(db);
    return NextResponse.json(m);
  }
  if (body.moveInRacha === "up" || body.moveInRacha === "down") {
    if (!m.agendamentoId) {
      return NextResponse.json(
        { error: "Apenas jogos vinculados a racha podem ser reordenados" },
        { status: 400 }
      );
    }
    const ordered = matchesInSameRacha(db, m.agendamentoId);
    renumberSortIndexes(ordered);
    const idx = ordered.findIndex((x) => x.id === m.id);
    const target = body.moveInRacha === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || target < 0 || target >= ordered.length) {
      return NextResponse.json({ error: "Não é possível mover nesta direção" }, { status: 400 });
    }
    const other = ordered[target]!;
    const tmp = m.sortIndex;
    m.sortIndex = other.sortIndex;
    other.sortIndex = tmp;
    await writeDb(db);
    return NextResponse.json(m);
  }
  // Data do jogo sempre acompanha a data do racha (agendamento).
  if (m.agendamentoId) {
    const agendamento = db.agendamentos.find((a) => a.id === m.agendamentoId);
    if (agendamento) {
      m.date = agendamento.date;
    }
  }
  if (body.weekLabel !== undefined) m.weekLabel = String(body.weekLabel).trim() || undefined;
  if (typeof body.durationMinutes === "number" && body.durationMinutes > 0) {
    m.durationMinutes = Math.min(60, Math.round(body.durationMinutes));
  }
  if (Array.isArray(body.teams) && body.teams.length === m.teams.length) {
    const next: MatchTeamSlot[] = body.teams.map((t: MatchTeamSlot, i: number) => ({
      name: String(t.name ?? m.teams[i].name).trim() || m.teams[i].name,
      playerIds: Array.isArray(t.playerIds) ? t.playerIds : m.teams[i].playerIds,
      rotationOrder:
        typeof t.rotationOrder === "number"
          ? t.rotationOrder
          : m.teams[i].rotationOrder,
    }));
    m.teams = next;
  }
  if (Array.isArray(body.fieldTeamIndexes)) {
    const dedup = [...new Set(body.fieldTeamIndexes as number[])].filter(
      (i) => Number.isInteger(i) && i >= 0 && i < m.teams.length
    );
    if (dedup.length >= 2) {
      m.fieldTeamIndexes = dedup.slice(0, 2);
      if (
        m.championTeamIndex !== null &&
        !m.fieldTeamIndexes.includes(m.championTeamIndex)
      ) {
        m.championTeamIndex = null;
      }
      const eligible = playerIdsEligibleForCards(m);
      m.cartoesAmarelos = m.cartoesAmarelos.filter((id) => eligible.has(id));
    }
  }
  if (body.championTeamIndex !== undefined) {
    const idx = body.championTeamIndex;
    m.championTeamIndex =
      idx === null
        ? null
        : typeof idx === "number" &&
            idx >= 0 &&
            idx < m.teams.length &&
            m.fieldTeamIndexes.includes(idx)
          ? idx
          : null;
    if (m.championTeamIndex !== null) {
      m.drawResult = false;
    }
  }
  if (body.drawResult !== undefined) {
    m.drawResult = Boolean(body.drawResult);
    if (m.drawResult) {
      m.championTeamIndex = null;
    }
  }
  if (body.addGoal) {
    const g = body.addGoal as { scorerId: string };
    const scorerId = String(g.scorerId ?? "").trim();
    if (!scorerId) {
      return NextResponse.json({ error: "Artilheiro obrigatório" }, { status: 400 });
    }
    const scorer = registeredPlayerOrNull(db, scorerId);
    if (!scorer) {
      return NextResponse.json(
        { error: "Artilheiro precisa ser jogador cadastrado" },
        { status: 400 }
      );
    }

    const field = fieldPlayerIdsOnMatch(m);
    const drafts = db.draftsByAgendamento ?? {};
    const rachaLinha =
      m.agendamentoId != null ? rachaDraftLinhaPlayerIds(m, drafts) : new Set<string>();
    const rachaGoleiros =
      m.agendamentoId != null ? rachaDraftGoleiroPlayerIds(m, drafts) : new Set<string>();

    let scorerFromBench: boolean | undefined;
    if (scorer.category === "goleiro") {
      if (!rachaGoleiros.has(scorerId)) {
        return NextResponse.json(
          {
            error:
              "Goleiro precisa estar no Gol 1 ou Gol 2 do sorteio salvo deste racha",
          },
          { status: 400 }
        );
      }
    } else {
      const scorerOk = field.has(scorerId) || rachaLinha.has(scorerId);
      if (!scorerOk) {
        return NextResponse.json(
          {
            error:
              "Artilheiro precisa estar em campo nesta partida ou no elenco do racha (sorteio salvo)",
          },
          { status: 400 }
        );
      }
      scorerFromBench = !field.has(scorerId) ? true : undefined;
    }

    const goal: Goal = {
      id: newId(),
      scorerId,
      scorerFromBench,
    };
    m.goals.push(goal);
  }
  if (body.removeGoalId) {
    m.goals = m.goals.filter((g) => g.id !== body.removeGoalId);
  }

  if (body.placarField0 !== undefined) {
    m.placarField0 = clampPlacar(body.placarField0);
  }
  if (body.placarField1 !== undefined) {
    m.placarField1 = clampPlacar(body.placarField1);
  }
  reconcileScoring(m);

  if (body.decisaoPorPenaltis !== undefined) {
    m.decisaoPorPenaltis = Boolean(body.decisaoPorPenaltis);
    if (!m.decisaoPorPenaltis) {
      m.penaltisConvertidos0 = null;
      m.penaltisConvertidos1 = null;
    }
  }
  reconcileScoring(m);

  const parsePen = (v: unknown): number | null => {
    if (v === null || v === "") return null;
    const n = Number(v);
    if (n === 0 || n === 1) return n;
    return null;
  };
  if (body.penaltisConvertidos0 !== undefined) {
    m.penaltisConvertidos0 = parsePen(body.penaltisConvertidos0);
  }
  if (body.penaltisConvertidos1 !== undefined) {
    m.penaltisConvertidos1 = parsePen(body.penaltisConvertidos1);
  }
  reconcileScoring(m);

  if (m.decisaoPorPenaltis) {
    const tie =
      m.placarField0 !== null &&
      m.placarField1 !== null &&
      m.placarField0 === m.placarField1;
    if (!tie) {
      return NextResponse.json(
        { error: "Só é possível marcar pênaltis quando o placar está empatado" },
        { status: 400 }
      );
    }
  }

  if (body.cartoesAmarelos !== undefined) {
    const eligible = playerIdsEligibleForCards(m);
    if (!Array.isArray(body.cartoesAmarelos)) {
      return NextResponse.json({ error: "cartoesAmarelos inválido" }, { status: 400 });
    }
    const next = (body.cartoesAmarelos as unknown[])
      .map((x) => String(x))
      .filter((id, i, arr) => eligible.has(id) && arr.indexOf(id) === i);
    m.cartoesAmarelos = next;
  }
  if (body.addCartaoAmarelo) {
    const pid = String((body.addCartaoAmarelo as { playerId?: string }).playerId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ error: "Jogador obrigatório" }, { status: 400 });
    }
    if (!playerIdsEligibleForCards(m).has(pid)) {
      return NextResponse.json(
        { error: "Jogador precisa estar em um dos times em campo" },
        { status: 400 }
      );
    }
    if (!m.cartoesAmarelos.includes(pid)) {
      m.cartoesAmarelos = [...m.cartoesAmarelos, pid];
    }
  }
  if (body.removeCartaoAmarelo !== undefined) {
    const pid = String(body.removeCartaoAmarelo).trim();
    m.cartoesAmarelos = m.cartoesAmarelos.filter((x) => x !== pid);
  }

  await writeDb(db);
  return NextResponse.json(m);
}

export async function DELETE(_req: Request, context: Ctx) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const { id } = await context.params;
  const db = await readDb();
  const before = db.matches.length;
  db.matches = db.matches.filter((x) => x.id !== id);
  if (db.matches.length === before) {
    return NextResponse.json({ error: "Jogo não encontrado" }, { status: 404 });
  }
  await writeDb(db);
  return NextResponse.json({ ok: true });
}
