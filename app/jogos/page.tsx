"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { JogosRachaList } from "@/components/JogosRachaList";
import { formatAgendamentoLabel, getLatestAgendamento } from "@/lib/agendamentos-ui";
import {
  computeQueueAfterGames,
  displayTeamName,
  emptyTeams,
  sortMatchesForRacha,
} from "@/lib/jogos-helpers";
import { teamsByRotation } from "@/lib/matchUi";
import type { MatchTeamSlot } from "@/lib/types";
import { useAppData } from "@/lib/useData";

export default function JogosPage() {
  const { data, loading, error, refresh } = useAppData();
  const [weekLabel, setWeekLabel] = useState("");
  const [teamCountNew, setTeamCountNew] = useState<2 | 3 | 4>(2);
  const [durationMinutes, setDurationMinutes] = useState(8);
  const [teamsForm, setTeamsForm] = useState<MatchTeamSlot[]>(() => emptyTeams(2));
  const [fieldA, setFieldA] = useState(0);
  const [fieldB, setFieldB] = useState(1);
  const [saving, setSaving] = useState(false);

  const latestRacha = useMemo(
    () => (data ? getLatestAgendamento(data.agendamentos) : null),
    [data]
  );
  const agendamentoId = latestRacha?.id ?? "";

  useEffect(() => {
    setTeamsForm((prev) => {
      const n = teamCountNew;
      const base = emptyTeams(n);
      return base.map((slot, i) => ({
        ...slot,
        name: prev[i]?.name ?? slot.name,
        playerIds: prev[i]?.playerIds ?? [],
        rotationOrder: prev[i]?.rotationOrder ?? i + 1,
      }));
    });
  }, [teamCountNew]);

  const matchesSelected = useMemo(() => {
    if (!data || !agendamentoId) return [];
    return sortMatchesForRacha(
      data.matches.filter((m) => m.agendamentoId === agendamentoId)
    );
  }, [data, agendamentoId]);

  const draftForRacha =
    agendamentoId && data?.draftsByAgendamento?.[agendamentoId]
      ? data.draftsByAgendamento[agendamentoId]
      : null;

  const teamSource = draftForRacha?.teams ?? matchesSelected[0]?.teams ?? null;

  const queueNow = teamSource
    ? computeQueueAfterGames(
        teamSource.length,
        matchesSelected.map((m) => ({
          fieldTeamIndexes: m.fieldTeamIndexes,
          championTeamIndex: m.championTeamIndex,
          drawResult: m.drawResult,
        }))
      )
    : [];
  const suggestedA = queueNow[0] ?? 0;
  const suggestedB = queueNow[1] ?? 1;

  const matchesTally = matchesSelected
    .map(
      (m) =>
        `${m.id}:${m.championTeamIndex ?? "x"}:${m.drawResult ? "d" : "n"}:${(m.fieldTeamIndexes || []).join(",")}`
    )
    .join("|");

  useEffect(() => {
    if (!data || !agendamentoId) return;
    const draft = data.draftsByAgendamento?.[agendamentoId];
    const teamSrc = draft?.teams ?? matchesSelected[0]?.teams ?? null;
    if (!teamSrc) {
      setTeamCountNew(2);
      setTeamsForm(emptyTeams(2));
      setFieldA(0);
      setFieldB(1);
      return;
    }
    const n = teamSrc.length as 2 | 3 | 4;
    setTeamCountNew(n);
    setTeamsForm(
      teamSrc.map((t, i) => ({
        ...t,
        name: displayTeamName(t.name, i),
      }))
    );
    const q = computeQueueAfterGames(
      teamSrc.length,
      matchesSelected.map((m) => ({
        fieldTeamIndexes: m.fieldTeamIndexes,
        championTeamIndex: m.championTeamIndex,
        drawResult: m.drawResult,
      }))
    );
    setFieldA(q[0] ?? 0);
    setFieldB(q[1] ?? 1);
    if (draft) setDurationMinutes(draft.durationMinutes);
  }, [agendamentoId, data, draftForRacha?.createdAt, matchesTally, matchesSelected]);

  function loadDraft() {
    if (!data || !agendamentoId) return;
    const d = data.draftsByAgendamento?.[agendamentoId] ?? data.lastDraft;
    if (!d) return;
    setTeamCountNew(d.teamCount);
    setDurationMinutes(d.durationMinutes);
    setTeamsForm(
      d.teams.map((t, i) => ({
        ...t,
        name: displayTeamName(t.name, i),
      }))
    );
    setFieldA(0);
    setFieldB(1);
  }

  async function criarJogo(e: React.FormEvent) {
    e.preventDefault();
    if (!agendamentoId) return;
    setSaving(true);
    try {
      const r = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agendamentoId,
          weekLabel: weekLabel.trim() || undefined,
          durationMinutes,
          format: teamCountNew === 2 ? "dupla" : "racha",
          teamCount: teamCountNew,
          teams: teamsForm,
          fieldTeamIndexes: [fieldA, fieldB],
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        alert(j.error || "Erro");
        return;
      }
      await refresh();
      window.location.href = `/jogos/${j.id}`;
    } finally {
      setSaving(false);
    }
  }

  async function deleteMatch(matchId: string) {
    if (!confirm("Excluir este jogo?")) return;
    const r = await fetch(`/api/matches/${matchId}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert(j.error || "Erro ao excluir jogo");
      return;
    }
    await refresh();
  }

  async function moveMatch(matchId: string, direction: "up" | "down") {
    const r = await fetch(`/api/matches/${matchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moveInRacha: direction }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert(j.error || "Erro ao reordenar jogo");
      return;
    }
    await refresh();
  }

  async function makeMatchFirst(matchId: string) {
    const r = await fetch(`/api/matches/${matchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ makeFirstInRacha: true }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert(j.error || "Erro ao reordenar jogo");
      return;
    }
    await refresh();
  }

  const hasDraftForSelectedRacha = Boolean(
    agendamentoId && data?.draftsByAgendamento?.[agendamentoId]
  );
  const canLoadFromSorteio =
    !!data && (hasDraftForSelectedRacha || !!data.lastDraft);

  if (loading) return <p className="text-emerald-200/80">Carregando…</p>;
  if (error || !data) return <p className="text-red-300">{error ?? "Erro"}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold text-white">Jogos</h1>
        <Link
          href="/historico-de-jogos"
          className="text-xs text-amber-300/95 underline hover:text-amber-200"
        >
          Histórico de jogos
        </Link>
      </div>

      {!latestRacha ? (
        <p className="text-sm text-emerald-400/90">
          Nenhum racha cadastrado.{" "}
          <Link href="/agenda" className="text-amber-300 underline">
            Cadastre um racha na agenda
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="rounded-lg border border-amber-900/35 bg-amber-950/15 px-3 py-2">
            <p className="text-xs text-emerald-400/90">Racha atual (último cadastrado)</p>
            <p className="text-sm font-medium text-white">{formatAgendamentoLabel(latestRacha)}</p>
          </div>

          <form
            onSubmit={criarJogo}
            className="space-y-3 rounded-xl border border-emerald-800/60 bg-emerald-950/50 p-4"
          >
            <h2 className="text-sm font-semibold text-amber-200">Novo jogo</h2>

            {draftForRacha && (
              <div className="rounded-lg border border-amber-900/35 bg-amber-950/15 p-3 space-y-3">
                <h3 className="text-xs font-semibold text-amber-200">Sorteio vinculado</h3>
                {draftForRacha.format === "racha" && draftForRacha.teamCount > 2 && (
                  <ol className="list-decimal space-y-0.5 pl-4 text-xs text-emerald-100/90">
                    {teamsByRotation(draftForRacha.teams).map((t) => {
                      const idx = draftForRacha.teams.indexOf(t);
                      return (
                        <li key={`${t.rotationOrder}-${t.name}`}>
                          {displayTeamName(t.name, idx >= 0 ? idx : 0)}
                        </li>
                      );
                    })}
                  </ol>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  {draftForRacha.teams.map((t, idx) => (
                    <div
                      key={idx}
                      className="rounded border border-emerald-800/50 bg-emerald-950/30 p-2 text-xs"
                    >
                      <p className="font-medium text-white">{displayTeamName(t.name, idx)}</p>
                      <p className="mt-0.5 text-emerald-200/85">
                        {t.playerIds
                          .map((pid) => data.players.find((x) => x.id === pid)?.name ?? pid)
                          .join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-emerald-200/90">Apelido (opcional)</label>
                <input
                  value={weekLabel}
                  onChange={(e) => setWeekLabel(e.target.value)}
                  className="mt-0.5 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-sm text-white"
                  placeholder="Ex.: Jogo 3"
                />
              </div>
              <div>
                <label className="text-xs text-emerald-200/90">Duração (min)</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value) || 8)}
                  className="mt-0.5 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-sm text-white"
                />
              </div>
            </div>

            {teamSource ? (
              <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/30 p-3 space-y-2">
                <p className="text-xs text-emerald-200/90">
                  Times: {teamsForm.map((t, i) => displayTeamName(t.name, i)).join(" · ")}
                </p>
                {teamsForm.length > 2 && (
                  <p className="text-xs text-amber-200/90">
                    Próxima sugerida:{" "}
                    <strong>{displayTeamName(teamsForm[suggestedA]?.name ?? "", suggestedA)}</strong>{" "}
                    ×{" "}
                    <strong>{displayTeamName(teamsForm[suggestedB]?.name ?? "", suggestedB)}</strong>
                  </p>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  <select
                    value={fieldA}
                    onChange={(e) => setFieldA(Number(e.target.value))}
                    className="rounded-lg border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-sm text-white"
                  >
                    {teamsForm.map((t, i) => (
                      <option key={i} value={i}>
                        Campo A: {displayTeamName(t.name, i)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={fieldB}
                    onChange={(e) => setFieldB(Number(e.target.value))}
                    className="rounded-lg border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-sm text-white"
                  >
                    {teamsForm.map((t, i) => (
                      <option key={i} value={i}>
                        Campo B: {displayTeamName(t.name, i)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <p className="text-xs text-amber-200/85">
                Vincule o sorteio ao racha na página Sorteio para carregar os times.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={loadDraft}
                disabled={!canLoadFromSorteio}
                className="rounded-lg bg-emerald-800 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                Preencher do sorteio
              </button>
              <button
                type="submit"
                disabled={saving || !teamSource || fieldA === fieldB}
                className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-medium text-pitch-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {saving ? "Criando…" : "Criar jogo"}
              </button>
            </div>
          </form>

          <section>
            <h2 className="text-sm font-semibold text-amber-200">
              Jogos deste racha ({matchesSelected.length})
            </h2>
            <p className="mt-0.5 text-xs text-emerald-500/90">
              Use ↑ ↓ para ajustar a ordem em que os jogos aconteceram.
            </p>
            <div className="mt-2">
              <JogosRachaList
                matches={matchesSelected}
                reorderable
                onMove={moveMatch}
                onMakeFirst={makeMatchFirst}
                onDelete={deleteMatch}
                emptyMessage="Nenhum jogo cadastrado ainda neste racha."
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
