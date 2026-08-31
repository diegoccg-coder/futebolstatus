"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { JogosRachaList } from "@/components/JogosRachaList";
import { formatAgendamentoLabel, getLatestAgendamento } from "@/lib/agendamentos-ui";
import { displayTeamName, formatTeamLabelWithFila, sortMatchesForRacha } from "@/lib/jogos-helpers";
import { buildGoalOptions, buildGoalPlayerOptions, assistOptionsForScorer, formatGoalPlayerLabel, playersOnField } from "@/lib/match-goal-options";
import {
  teamsByRotation,
} from "@/lib/matchUi";
import { computeKingOfHillNextMatchFromMatches } from "@/lib/racha-queue";
import type { Match, MatchTeamSlot } from "@/lib/types";
import { useAppData } from "@/lib/useData";

type PendingGoal = {
  id: string;
  scorerId: string;
  assistId: string;
};

function formatAgOption(a: { date: string; time?: string; title?: string }) {
  const label = new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR");
  return `${label}${a.time ? ` · ${a.time}` : ""}${a.title ? ` · ${a.title}` : ""}`;
}

function validateMatchResult(
  placar0: string,
  placar1: string,
  drawResult: boolean,
  decisaoPenaltis: boolean,
  pen0: string,
  pen1: string
): { ok: true } | { ok: false; message: string } {
  if (placar0.trim() === "" || placar1.trim() === "") {
    return { ok: false, message: "Informe o placar dos dois times antes de salvar." };
  }
  const p0 = Math.round(Number(placar0));
  const p1 = Math.round(Number(placar1));
  if (!Number.isFinite(p0) || p0 < 0 || p0 > 99) {
    return { ok: false, message: "Placar do time A inválido." };
  }
  if (!Number.isFinite(p1) || p1 < 0 || p1 > 99) {
    return { ok: false, message: "Placar do time B inválido." };
  }
  if (p0 === p1) {
    if (!drawResult && !decisaoPenaltis) {
      return {
        ok: false,
        message: "Placar empatado: marque «Empate» ou «Decidido nos pênaltis».",
      };
    }
    if (decisaoPenaltis) {
      if (pen0 === "" || pen1 === "") {
        return { ok: false, message: "Informe o resultado dos pênaltis dos dois times." };
      }
      if (pen0 === pen1) {
        return { ok: false, message: "Nos pênaltis precisa haver um vencedor (um gol e um erro)." };
      }
    }
  }
  return { ok: true };
}

export default function RegistroDeJogosPage() {
  const { data, loading, error, refresh } = useAppData();
  const latestRacha = useMemo(
    () => (data ? getLatestAgendamento(data.agendamentos) : null),
    [data]
  );

  const [agendamentoId, setAgendamentoId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fieldA, setFieldA] = useState(0);
  const [fieldB, setFieldB] = useState(1);
  const [placar0, setPlacar0] = useState("");
  const [placar1, setPlacar1] = useState("");
  const [decisaoPenaltis, setDecisaoPenaltis] = useState(false);
  const [pen0, setPen0] = useState("");
  const [pen1, setPen1] = useState("");
  const [drawResult, setDrawResult] = useState(false);
  const [pendingGoals, setPendingGoals] = useState<PendingGoal[]>([]);
  const [scorerId, setScorerId] = useState("");
  const [assistId, setAssistId] = useState("");
  const [cartoesAmarelos, setCartoesAmarelos] = useState<string[]>([]);
  const [cartoesVermelhos, setCartoesVermelhos] = useState<string[]>([]);
  const [cardPick, setCardPick] = useState("");
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (latestRacha && !agendamentoId) {
      setAgendamentoId(latestRacha.id);
    }
  }, [latestRacha, agendamentoId]);

  const draft = agendamentoId && data?.draftsByAgendamento?.[agendamentoId]
    ? data.draftsByAgendamento[agendamentoId]
    : null;

  const teamsForm: MatchTeamSlot[] = useMemo(() => {
    if (!draft) return [];
    return draft.teams.map((t, i) => ({
      ...t,
      name: displayTeamName(t.name, i),
    }));
  }, [draft]);

  const matchesRacha = useMemo(() => {
    if (!data || !agendamentoId) return [];
    return sortMatchesForRacha(
      data.matches.filter((m) => m.agendamentoId === agendamentoId)
    );
  }, [data, agendamentoId]);

  const rotationIndexes = useMemo(() => {
    if (teamsForm.length === 0) return [];
    return teamsByRotation(teamsForm).map((t) => teamsForm.indexOf(t));
  }, [teamsForm]);

  const filaOrdenada = useMemo(() => {
    if (teamsForm.length <= 2) return [];
    return teamsByRotation(teamsForm);
  }, [teamsForm]);

  function teamLabel(idx: number): string {
    const t = teamsForm[idx];
    if (!t) return `Time ${idx + 1}`;
    return formatTeamLabelWithFila(t, idx);
  }

  const suggestedMatch = useMemo(() => {
    if (rotationIndexes.length < 2) return [0, 1] as [number, number];
    const prior = editingId
      ? matchesRacha.filter((m) => m.id !== editingId)
      : matchesRacha;
    return computeKingOfHillNextMatchFromMatches(rotationIndexes, prior);
  }, [rotationIndexes, matchesRacha, editingId]);

  const matchesTally = matchesRacha
    .map((m) => `${m.id}:${m.championTeamIndex ?? "x"}:${m.drawResult ? "d" : "n"}`)
    .join("|");

  useEffect(() => {
    if (editingId) return;
    setFieldA(suggestedMatch[0] ?? 0);
    setFieldB(suggestedMatch[1] ?? 1);
  }, [suggestedMatch[0], suggestedMatch[1], editingId, matchesTally]);

  const durationMinutes = draft?.durationMinutes ?? 8;

  const partialMatch = useMemo((): Pick<Match, "teams" | "fieldTeamIndexes" | "agendamentoId"> | null => {
    if (teamsForm.length === 0) return null;
    return {
      teams: teamsForm,
      fieldTeamIndexes: [fieldA, fieldB],
      agendamentoId: agendamentoId || null,
    };
  }, [teamsForm, fieldA, fieldB, agendamentoId]);

  const opcoesGol = useMemo(() => {
    if (!partialMatch || !data) {
      return { emCampo: [], outrosNoRacha: [], goleiros: [], draftDisponivel: false };
    }
    return buildGoalOptions(partialMatch, data);
  }, [partialMatch, data]);

  const opcoesGolLista = useMemo(() => {
    if (!partialMatch || !data) return [];
    return buildGoalPlayerOptions(partialMatch, data);
  }, [partialMatch, data]);

  const opcoesAssistenciaLista = useMemo(
    () => assistOptionsForScorer(opcoesGolLista, scorerId),
    [opcoesGolLista, scorerId]
  );

  useEffect(() => {
    if (!assistId) return;
    if (!opcoesAssistenciaLista.some((o) => o.player.id === assistId)) {
      setAssistId("");
    }
  }, [assistId, opcoesAssistenciaLista]);

  const playersOnFieldList = useMemo(() => {
    if (!partialMatch || !data) return [];
    return playersOnField(partialMatch, data.players);
  }, [partialMatch, data]);

  const placarEmpate = useMemo(() => {
    const a = placar0.trim() === "" ? null : Number(placar0);
    const b = placar1.trim() === "" ? null : Number(placar1);
    return a !== null && b !== null && Number.isFinite(a) && Number.isFinite(b) && a === b;
  }, [placar0, placar1]);

  const resultValidation = useMemo(
    () => validateMatchResult(placar0, placar1, drawResult, decisaoPenaltis, pen0, pen1),
    [placar0, placar1, drawResult, decisaoPenaltis, pen0, pen1]
  );

  const canSave = fieldA !== fieldB && resultValidation.ok;

  function resetForm() {
    setEditingId(null);
    setPlacar0("");
    setPlacar1("");
    setDecisaoPenaltis(false);
    setPen0("");
    setPen1("");
    setDrawResult(false);
    setPendingGoals([]);
    setScorerId("");
    setAssistId("");
    setCartoesAmarelos([]);
    setCartoesVermelhos([]);
    setCardPick("");
    setFieldA(suggestedMatch[0] ?? 0);
    setFieldB(suggestedMatch[1] ?? 1);
  }

  function loadMatchForEdit(m: Match) {
    setEditingId(m.id);
    const fa = m.fieldTeamIndexes[0] ?? 0;
    const fb = m.fieldTeamIndexes[1] ?? 1;
    setFieldA(fa);
    setFieldB(fb);
    setPlacar0(m.placarField0 === null ? "" : String(m.placarField0));
    setPlacar1(m.placarField1 === null ? "" : String(m.placarField1));
    setDecisaoPenaltis(m.decisaoPorPenaltis);
    setPen0(m.penaltisConvertidos0 === null ? "" : String(m.penaltisConvertidos0));
    setPen1(m.penaltisConvertidos1 === null ? "" : String(m.penaltisConvertidos1));
    setDrawResult(m.drawResult);
    setPendingGoals(
      m.goals.map((g) => ({
        id: g.id,
        scorerId: g.scorerId,
        assistId: g.assistId ?? "",
      }))
    );
    setCartoesAmarelos([...m.cartoesAmarelos]);
    setCartoesVermelhos([...(m.cartoesVermelhos ?? [])]);
    setScorerId("");
    setAssistId("");
    setCardPick("");
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function addPendingGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!scorerId) return;
    setPendingGoals((prev) => [
      ...prev,
      {
        id: `tmp-${Date.now()}-${prev.length}`,
        scorerId,
        assistId: assistId && assistId !== scorerId ? assistId : "",
      },
    ]);
    setScorerId("");
    setAssistId("");
  }

  function addCard(kind: "amarelo" | "vermelho") {
    if (!cardPick) return;
    if (kind === "amarelo") {
      if (!cartoesAmarelos.includes(cardPick)) {
        setCartoesAmarelos((prev) => [...prev, cardPick]);
      }
    } else if (!cartoesVermelhos.includes(cardPick)) {
      setCartoesVermelhos((prev) => [...prev, cardPick]);
    }
    setCardPick("");
  }

  function inferWinner(): number | null {
    if (drawResult) return null;
    const p0 = placar0.trim() === "" ? null : Number(placar0);
    const p1 = placar1.trim() === "" ? null : Number(placar1);
    if (p0 === null || p1 === null || !Number.isFinite(p0) || !Number.isFinite(p1)) return null;
    if (p0 > p1) return fieldA;
    if (p1 > p0) return fieldB;
    if (decisaoPenaltis && pen0 !== "" && pen1 !== "") {
      const v0 = Number(pen0);
      const v1 = Number(pen1);
      if (v0 > v1) return fieldA;
      if (v1 > v0) return fieldB;
    }
    return null;
  }

  async function salvarJogo(e: React.FormEvent) {
    e.preventDefault();
    if (!agendamentoId || teamsForm.length === 0 || fieldA === fieldB) return;

    const validation = validateMatchResult(
      placar0,
      placar1,
      drawResult,
      decisaoPenaltis,
      pen0,
      pen1
    );
    if (!validation.ok) {
      alert(validation.message);
      return;
    }

    setSaving(true);
    try {
      const p0 = placar0.trim() === "" ? null : Math.round(Number(placar0));
      const p1 = placar1.trim() === "" ? null : Math.round(Number(placar1));
      const penVal0 = pen0 === "" ? null : pen0 === "0" || pen0 === "1" ? Number(pen0) : null;
      const penVal1 = pen1 === "" ? null : pen1 === "0" || pen1 === "1" ? Number(pen1) : null;
      const winner = inferWinner();

      let matchId = editingId;

      if (!matchId) {
        const createRes = await fetch("/api/matches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agendamentoId,
            durationMinutes,
            format: teamsForm.length === 2 ? "dupla" : "racha",
            teamCount: teamsForm.length,
            teams: teamsForm,
            fieldTeamIndexes: [fieldA, fieldB],
          }),
        });
        const created = await createRes.json();
        if (!createRes.ok) {
          alert(created.error || "Erro ao criar jogo");
          return;
        }
        matchId = created.id as string;
      }

      const patchBody: Record<string, unknown> = {
        durationMinutes,
        teams: teamsForm,
        fieldTeamIndexes: [fieldA, fieldB],
        placarField0: p0,
        placarField1: p1,
        decisaoPorPenaltis: decisaoPenaltis,
        penaltisConvertidos0: penVal0,
        penaltisConvertidos1: penVal1,
        drawResult,
        championTeamIndex: drawResult ? null : winner,
        cartoesAmarelos,
        cartoesVermelhos,
      };

      const patchRes = await fetch(`/api/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      if (!patchRes.ok) {
        const j = await patchRes.json();
        alert(j.error || "Erro ao salvar");
        return;
      }

      if (editingId) {
        const existing = data?.matches.find((m) => m.id === editingId);
        if (existing) {
          for (const g of existing.goals) {
            await fetch(`/api/matches/${matchId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ removeGoalId: g.id }),
            });
          }
        }
      }

      for (const g of pendingGoals) {
        const payload: { scorerId: string; assistId?: string } = { scorerId: g.scorerId };
        if (g.assistId) payload.assistId = g.assistId;
        const goalRes = await fetch(`/api/matches/${matchId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ addGoal: payload }),
        });
        if (!goalRes.ok) {
          const j = await goalRes.json();
          alert(j.error || "Erro ao salvar gol");
          return;
        }
      }

      await refresh();
      resetForm();
      alert("Jogo salvo com sucesso!");
    } finally {
      setSaving(false);
    }
  }

  async function deleteMatch(matchId: string) {
    if (!confirm("Excluir este jogo?")) return;
    const r = await fetch(`/api/matches/${matchId}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert(j.error || "Erro ao excluir");
      return;
    }
    if (editingId === matchId) resetForm();
    await refresh();
  }

  const playersMap = new Map(data?.players.map((p) => [p.id, p]) ?? []);

  if (loading) return <p className="text-emerald-200/80">Carregando…</p>;
  if (error || !data) return <p className="text-red-300">{error ?? "Erro"}</p>;

  const agendamento = data.agendamentos.find((a) => a.id === agendamentoId);
  const teamNameA = teamLabel(fieldA);
  const teamNameB = teamLabel(fieldB);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold text-white">Registro de jogos</h1>
        <Link
          href="/ranking-do-racha"
          className="text-xs text-amber-300/95 underline hover:text-amber-200"
        >
          Ver ranking do racha →
        </Link>
      </div>

      <p className="text-xs text-emerald-300/85">
        Crie o jogo e registre placar, gols, assistências e cartões em um só lugar.
        A sugestão de confronto segue a lógica: 1×2, vencedor×3, vencedor×4… Empate: ambos saem.
      </p>

      <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-3">
        <label className="text-xs text-emerald-200/90">Racha</label>
        <select
          value={agendamentoId}
          onChange={(e) => {
            setAgendamentoId(e.target.value);
            resetForm();
          }}
          className="mt-0.5 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-sm text-white"
        >
          <option value="">Selecione…</option>
          {[...data.agendamentos]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((a) => (
              <option key={a.id} value={a.id}>
                {formatAgOption(a)}
              </option>
            ))}
        </select>
        {agendamento && (
          <p className="mt-1 text-xs text-emerald-400/90">{formatAgendamentoLabel(agendamento)}</p>
        )}
      </div>

      {!draft ? (
        <p className="text-sm text-amber-200/90">
          Vincule o sorteio ao racha na página{" "}
          <Link href="/sorteio" className="text-amber-300 underline">
            Sorteio
          </Link>{" "}
          antes de registrar jogos.
        </p>
      ) : (
        <>
          <form
            ref={formRef}
            onSubmit={salvarJogo}
            className="space-y-4 rounded-xl border border-amber-900/35 bg-amber-950/10 p-4"
          >
            <h2 className="text-sm font-semibold text-amber-200">
              {editingId ? "Editar jogo" : "Novo jogo"}
            </h2>
            {editingId && (
              <p className="rounded-lg border border-amber-800/50 bg-amber-950/25 px-2 py-1.5 text-xs text-amber-100/95">
                Ajuste placar, gols, assistências ou cartões e salve novamente. O ranking será
                atualizado com as correções.
              </p>
            )}

            {filaOrdenada.length > 0 && (
              <div className="rounded-lg border border-amber-900/35 bg-amber-950/15 px-2 py-1.5">
                <p className="text-[10px] font-medium text-amber-200/95">Ordem da fila</p>
                <p className="mt-0.5 text-xs text-emerald-200/90">
                  {filaOrdenada.map((t, i) => {
                    const idx = teamsForm.indexOf(t);
                    return (
                      <span key={t.rotationOrder}>
                        {i > 0 && " → "}
                        <strong>{formatTeamLabelWithFila(t, idx >= 0 ? idx : i)}</strong>
                      </span>
                    );
                  })}
                </p>
              </div>
            )}

            {teamsForm.length > 2 && !editingId && (
              <p className="text-xs text-emerald-200/90">
                Próximo sugerido: <strong>{teamNameA}</strong> × <strong>{teamNameB}</strong>
              </p>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="text-xs text-emerald-200/90">Time campo A</label>
                <select
                  value={fieldA}
                  onChange={(e) => setFieldA(Number(e.target.value))}
                  className="mt-0.5 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-sm text-white"
                >
                  {teamsForm.map((t, i) => (
                    <option key={i} value={i} disabled={i === fieldB}>
                      {formatTeamLabelWithFila(t, i)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-emerald-200/90">Time campo B</label>
                <select
                  value={fieldB}
                  onChange={(e) => setFieldB(Number(e.target.value))}
                  className="mt-0.5 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-sm text-white"
                >
                  {teamsForm.map((t, i) => (
                    <option key={i} value={i} disabled={i === fieldA}>
                      {formatTeamLabelWithFila(t, i)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <section className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 p-3 space-y-2">
              <h3 className="text-xs font-semibold text-amber-200">
                Placar <span className="text-red-400/90">*</span>
              </h3>
              <p className="text-[10px] text-emerald-400/85">
                Obrigatório para salvar e atualizar o ranking.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs text-emerald-300/90">
                  {teamNameA}
                  <input
                    type="number"
                    min={0}
                    max={99}
                    required
                    value={placar0}
                    onChange={(e) => setPlacar0(e.target.value)}
                    className="ml-1 w-14 rounded border border-emerald-800 bg-pitch-950 px-2 py-1 text-white"
                  />
                </label>
                <span className="text-emerald-400">×</span>
                <label className="text-xs text-emerald-300/90">
                  {teamNameB}
                  <input
                    type="number"
                    min={0}
                    max={99}
                    required
                    value={placar1}
                    onChange={(e) => setPlacar1(e.target.value)}
                    className="ml-1 w-14 rounded border border-emerald-800 bg-pitch-950 px-2 py-1 text-white"
                  />
                </label>
              </div>

              {placarEmpate && (
                <div className="rounded border border-amber-900/40 bg-amber-950/20 p-2 space-y-2">
                  <label className="flex items-center gap-2 text-xs text-emerald-200">
                    <input
                      type="checkbox"
                      checked={drawResult}
                      onChange={(e) => setDrawResult(e.target.checked)}
                      className="rounded border-emerald-700"
                    />
                    Empate (ambos saem)
                  </label>
                  <label className="flex items-center gap-2 text-xs text-emerald-200">
                    <input
                      type="checkbox"
                      checked={decisaoPenaltis}
                      onChange={(e) => {
                        setDecisaoPenaltis(e.target.checked);
                        if (e.target.checked) setDrawResult(false);
                      }}
                      className="rounded border-emerald-700"
                    />
                    Decidido nos pênaltis
                  </label>
                  {decisaoPenaltis && (
                    <div className="flex gap-2">
                      <select
                        value={pen0}
                        onChange={(e) => setPen0(e.target.value)}
                        className="rounded border border-emerald-800 bg-pitch-950 px-2 py-1 text-xs text-white"
                      >
                        <option value="">{teamNameA}</option>
                        <option value="0">Errou</option>
                        <option value="1">Gol</option>
                      </select>
                      <select
                        value={pen1}
                        onChange={(e) => setPen1(e.target.value)}
                        className="rounded border border-emerald-800 bg-pitch-950 px-2 py-1 text-xs text-white"
                      >
                        <option value="">{teamNameB}</option>
                        <option value="0">Errou</option>
                        <option value="1">Gol</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
              {!resultValidation.ok && placar0.trim() !== "" && placar1.trim() !== "" && (
                <p className="text-[10px] text-amber-300/95">{resultValidation.message}</p>
              )}
            </section>

            <section className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 p-3 space-y-2">
              <h3 className="text-xs font-semibold text-amber-200">Gols e assistências</h3>
              {!opcoesGol.draftDisponivel && (
                <p className="text-[10px] text-amber-200/85">Sem sorteio — só jogadores em campo.</p>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <select
                  value={scorerId}
                  onChange={(e) => {
                    setScorerId(e.target.value);
                    setAssistId("");
                  }}
                  className="min-w-0 flex-1 rounded border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-xs text-white"
                >
                  <option value="">Artilheiro</option>
                  {opcoesGolLista
                    .filter((o) => o.kind === "campo")
                    .map((o) => (
                      <option key={o.player.id} value={o.player.id}>
                        {formatGoalPlayerLabel(o.teamName, o.player.name)}
                      </option>
                    ))}
                  {opcoesGolLista.some((o) => o.kind === "substituto") && (
                    <optgroup label="Substitutos">
                      {opcoesGolLista
                        .filter((o) => o.kind === "substituto")
                        .map((o) => (
                          <option key={o.player.id} value={o.player.id}>
                            {formatGoalPlayerLabel(o.teamName, o.player.name)}
                          </option>
                        ))}
                    </optgroup>
                  )}
                  {opcoesGolLista.some((o) => o.kind === "goleiro") && (
                    <optgroup label="Goleiros">
                      {opcoesGolLista
                        .filter((o) => o.kind === "goleiro")
                        .map((o) => (
                          <option key={o.player.id} value={o.player.id}>
                            {formatGoalPlayerLabel(o.teamName, o.player.name)}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
                <select
                  value={assistId}
                  onChange={(e) => setAssistId(e.target.value)}
                  className="min-w-0 flex-1 rounded border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-xs text-white"
                >
                  <option value="">Assistência (opcional)</option>
                  {!scorerId && (
                    <option value="" disabled>
                      Selecione o artilheiro primeiro
                    </option>
                  )}
                  {opcoesAssistenciaLista.map((o) => (
                    <option key={o.player.id} value={o.player.id}>
                      {formatGoalPlayerLabel(o.teamName, o.player.name)}
                      {o.kind === "substituto" ? " (sub)" : ""}
                      {o.kind === "goleiro" ? " (GOL)" : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addPendingGoal}
                  disabled={!scorerId}
                  className="rounded-lg bg-emerald-800 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  + Gol
                </button>
              </div>
              {pendingGoals.length > 0 && (
                <ul className="space-y-1">
                  {pendingGoals.map((g) => {
                    const scorer = playersMap.get(g.scorerId);
                    const assister = g.assistId ? playersMap.get(g.assistId) : null;
                    const scorerOpt = opcoesGolLista.find((o) => o.player.id === g.scorerId);
                    const assistOpt = g.assistId
                      ? opcoesGolLista.find((o) => o.player.id === g.assistId)
                      : null;
                    const scorerLabel = scorerOpt
                      ? formatGoalPlayerLabel(scorerOpt.teamName, scorerOpt.player.name)
                      : scorer?.name ?? g.scorerId;
                    const assistLabel = assistOpt
                      ? formatGoalPlayerLabel(assistOpt.teamName, assistOpt.player.name)
                      : assister?.name;
                    return (
                      <li
                        key={g.id}
                        className="flex items-center justify-between gap-2 rounded border border-emerald-800/40 px-2 py-1 text-xs"
                      >
                        <span>
                          ⚽ {scorerLabel}
                          {assistLabel ? ` · ${assistLabel}` : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingGoals((prev) => prev.filter((x) => x.id !== g.id))
                          }
                          className="text-red-400/90 hover:text-red-300"
                        >
                          Remover
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 p-3 space-y-2">
              <h3 className="text-xs font-semibold text-amber-200">Cartões</h3>
              <div className="flex flex-wrap items-end gap-2">
                <select
                  value={cardPick}
                  onChange={(e) => setCardPick(e.target.value)}
                  className="min-w-0 flex-1 rounded border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-xs text-white"
                >
                  <option value="">Jogador</option>
                  {playersOnFieldList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!cardPick}
                  onClick={() => addCard("amarelo")}
                  className="rounded-lg bg-amber-500 px-2 py-1.5 text-xs font-medium text-pitch-950 hover:bg-amber-400 disabled:opacity-40"
                >
                  + Amarelo
                </button>
                <button
                  type="button"
                  disabled={!cardPick}
                  onClick={() => addCard("vermelho")}
                  className="rounded-lg bg-red-800 px-2 py-1.5 text-xs text-white hover:bg-red-700 disabled:opacity-40"
                >
                  + Vermelho
                </button>
              </div>
              {(cartoesAmarelos.length > 0 || cartoesVermelhos.length > 0) && (
                <ul className="space-y-1">
                  {cartoesAmarelos.map((pid) => (
                    <li
                      key={`y-${pid}`}
                      className="flex items-center justify-between rounded border border-amber-900/40 px-2 py-1 text-xs"
                    >
                      <span>🟨 {playersMap.get(pid)?.name ?? pid}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setCartoesAmarelos((prev) => prev.filter((x) => x !== pid))
                        }
                        className="text-red-400/90"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                  {cartoesVermelhos.map((pid) => (
                    <li
                      key={`r-${pid}`}
                      className="flex items-center justify-between rounded border border-red-900/40 px-2 py-1 text-xs"
                    >
                      <span>🟥 {playersMap.get(pid)?.name ?? pid}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setCartoesVermelhos((prev) => prev.filter((x) => x !== pid))
                        }
                        className="text-red-400/90"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving || !canSave}
                className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-medium text-pitch-950 hover:bg-amber-400 disabled:opacity-50"
                title={
                  !resultValidation.ok
                    ? resultValidation.message
                    : fieldA === fieldB
                      ? "Selecione times diferentes"
                      : undefined
                }
              >
                {saving ? "Salvando…" : editingId ? "Salvar alterações" : "Salvar jogo"}
              </button>
              {!canSave && !saving && (
                <p className="w-full text-[10px] text-emerald-400/85">
                  {!resultValidation.ok
                    ? resultValidation.message
                    : "Selecione dois times diferentes."}
                </p>
              )}
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-emerald-700 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-900/40"
                >
                  Cancelar edição
                </button>
              )}
            </div>
          </form>

          <section>
            <h2 className="text-sm font-semibold text-amber-200">
              Jogos do racha ({matchesRacha.length})
            </h2>
            <p className="mt-0.5 text-xs text-emerald-500/90">
              Clique em <strong className="text-emerald-300">Editar</strong> para corrigir gols,
              assistências ou cartões esquecidos.
            </p>
            <div className="mt-2">
            <JogosRachaList
              matches={matchesRacha}
              editingId={editingId}
              onEdit={loadMatchForEdit}
              onDelete={deleteMatch}
              emptyMessage="Nenhum jogo registrado ainda."
            />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
