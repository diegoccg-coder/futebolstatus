"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { matchHeadline, matchWinnerDisplayName, teamsByRotation } from "@/lib/matchUi";
import type { Match, MatchTeamSlot } from "@/lib/types";

/** Ordem de cadastro: primeiro jogo criado → último (id começa com timestamp em base36). */
function compareMatchCreationOrder(a: Match, b: Match): number {
  const head = (id: string) => id.split("-")[0] ?? id;
  const ta = parseInt(head(a.id), 36);
  const tb = parseInt(head(b.id), 36);
  const na = Number.isFinite(ta) ? ta : 0;
  const nb = Number.isFinite(tb) ? tb : 0;
  if (na !== nb) return na - nb;
  return a.id.localeCompare(b.id);
}
import { useAppData } from "@/lib/useData";

const COLOR_NAMES = ["Amarelo", "Laranja", "Verde", "Preto"] as const;

function isGenericName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    n === "time a" ||
    n === "time b" ||
    n === "time c" ||
    n === "time d" ||
    n === "time 1" ||
    n === "time 2" ||
    n === "time 3" ||
    n === "time 4"
  );
}

function displayTeamName(name: string, idx: number): string {
  if (!name.trim() || isGenericName(name)) {
    return COLOR_NAMES[idx] ?? `Time ${idx + 1}`;
  }
  return name;
}

function emptyTeams(n: 2 | 3 | 4): MatchTeamSlot[] {
  const labels =
    n === 2
      ? ["Amarelo", "Laranja"]
      : n === 3
        ? ["Amarelo", "Laranja", "Verde"]
        : ["Amarelo", "Laranja", "Verde", "Preto"];
  return labels.map((name, i) => ({
    name,
    playerIds: [],
    rotationOrder: i + 1,
  }));
}

export default function JogosPage() {
  const { data, loading, error, refresh } = useAppData();
  const [agendamentoId, setAgendamentoId] = useState("");
  const [historyAgendamentoId, setHistoryAgendamentoId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [weekLabel, setWeekLabel] = useState("");
  const [teamCountNew, setTeamCountNew] = useState<2 | 3 | 4>(2);
  const [durationMinutes, setDurationMinutes] = useState(8);
  const [teamsForm, setTeamsForm] = useState<MatchTeamSlot[]>(() => emptyTeams(2));
  const [fieldA, setFieldA] = useState(0);
  const [fieldB, setFieldB] = useState(1);
  const [saving, setSaving] = useState(false);

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

  function loadDraft() {
    if (!data) return;
    const d =
      (agendamentoId && data.draftsByAgendamento?.[agendamentoId]) || data.lastDraft;
    if (!d) return;
    if (d.agendamentoId) setAgendamentoId(d.agendamentoId);
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

  function computeQueueAfterGames(
    teamCount: number,
    jogos: Array<{ fieldTeamIndexes: number[]; championTeamIndex: number | null }>
  ): number[] {
    let queue = Array.from({ length: teamCount }, (_, i) => i);
    for (const j of jogos) {
      if (!Array.isArray(j.fieldTeamIndexes) || j.fieldTeamIndexes.length < 2) continue;
      if (j.championTeamIndex === null) continue;
      const [a, b] = j.fieldTeamIndexes;
      if (a === b) continue;
      const winner = j.championTeamIndex;
      if (winner !== a && winner !== b) continue;
      const loser = winner === a ? b : a;
      const rest = queue.filter((x) => x !== winner && x !== loser);
      queue = [winner, ...rest, loser];
    }
    return queue;
  }

  async function criarJogo(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
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
    if (!confirm("Excluir este jogo? As estatísticas desse jogo serão removidas.")) return;
    const r = await fetch(`/api/matches/${matchId}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert(j.error || "Erro ao excluir jogo");
      return;
    }
    await refresh();
  }

  const matches = [...(data?.matches ?? [])].sort(compareMatchCreationOrder);
  const agendamentos = [...(data?.agendamentos ?? [])].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const matchesSelected = matches.filter((m) => m.agendamentoId === agendamentoId);

  const draftForRacha =
    agendamentoId && data?.draftsByAgendamento?.[agendamentoId]
      ? data.draftsByAgendamento[agendamentoId]
      : null;

  const teamSource =
    draftForRacha?.teams ?? matchesSelected[0]?.teams ?? null;

  const queueNow = teamSource
    ? computeQueueAfterGames(
        teamSource.length,
        matchesSelected.map((m) => ({
          fieldTeamIndexes: m.fieldTeamIndexes,
          championTeamIndex: m.championTeamIndex,
        }))
      )
    : [];
  const suggestedA = queueNow[0] ?? 0;
  const suggestedB = queueNow[1] ?? 1;

  const matchesTally = matchesSelected
    .map(
      (m) =>
        `${m.id}:${m.championTeamIndex ?? "x"}:${(m.fieldTeamIndexes || []).join(",")}`
    )
    .join("|");

  useEffect(() => {
    if (!data || !agendamentoId) return;
    const ms = [...data.matches]
      .filter((m) => m.agendamentoId === agendamentoId)
      .sort(compareMatchCreationOrder);
    const draft = data.draftsByAgendamento?.[agendamentoId];
    const teamSrc = draft?.teams ?? ms[0]?.teams ?? null;
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
      ms.map((m) => ({
        fieldTeamIndexes: m.fieldTeamIndexes,
        championTeamIndex: m.championTeamIndex,
      }))
    );
    setFieldA(q[0] ?? 0);
    setFieldB(q[1] ?? 1);
    if (draft) setDurationMinutes(draft.durationMinutes);
  }, [agendamentoId, data, draftForRacha?.createdAt, matchesTally]);

  const hasDraftForSelectedRacha = Boolean(
    agendamentoId && data?.draftsByAgendamento?.[agendamentoId]
  );
  const canLoadFromSorteio =
    !!data &&
    (hasDraftForSelectedRacha ||
      !!data.lastDraft);

  if (loading) return <p className="text-emerald-200/80">Carregando…</p>;
  if (error || !data) return <p className="text-red-300">{error ?? "Erro"}</p>;

  const grouped = agendamentos.map((a) => ({
    agendamento: a,
    jogos: matches.filter((m) => m.agendamentoId === a.id),
  }));
  const visibleGroups = historyAgendamentoId
    ? grouped.filter((g) => g.agendamento.id === historyAgendamentoId)
    : grouped;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Jogos</h1>
        <p className="mt-1 text-sm text-emerald-100/75">
          Cadastre o fluxo de jogos do racha (partidas de 8 minutos) com a regra: quem
          vence continua e quem perde vai para o fim da fila.
        </p>
      </div>

      <form
        onSubmit={criarJogo}
        className="space-y-4 rounded-2xl border border-emerald-800/60 bg-emerald-950/50 p-6"
      >
        <h2 className="font-display text-lg font-semibold text-amber-200">Novo jogo</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-emerald-200/90">Racha (agenda)</label>
            <select
              value={agendamentoId}
              onChange={(e) => setAgendamentoId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
              required
            >
              <option value="">Selecione o racha</option>
              {agendamentos.map((a) => (
                <option key={a.id} value={a.id}>
                  {new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR")}
                  {a.time ? ` às ${a.time}` : ""}
                  {a.title ? ` · ${a.title}` : ""}
                </option>
              ))}
            </select>
          </div>
          {agendamentoId && draftForRacha && (
            <div className="sm:col-span-2 rounded-xl border border-amber-900/35 bg-amber-950/15 p-4 space-y-4">
              <h3 className="font-display text-sm font-semibold text-amber-200">
                Times sorteados (vinculados no Sorteio)
              </h3>
              {draftForRacha.format === "racha" && draftForRacha.teamCount > 2 && (
                <div>
                  <p className="text-xs font-medium text-emerald-400/90">Ordem da fila</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-emerald-100/90">
                    {teamsByRotation(draftForRacha.teams).map((t) => {
                      const idx = draftForRacha.teams.indexOf(t);
                      return (
                        <li key={`${t.rotationOrder}-${t.name}`}>
                          <strong>{displayTeamName(t.name, idx >= 0 ? idx : 0)}</strong>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {draftForRacha.teams.map((t, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 p-3"
                  >
                    <p className="font-medium text-white">
                      {displayTeamName(t.name, idx)}
                      {draftForRacha.teamCount > 2 && (
                        <span className="text-emerald-500/90"> · fila {t.rotationOrder}º</span>
                      )}
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-emerald-200/90">
                      {t.playerIds.map((pid) => {
                        const p = data.players.find((x) => x.id === pid);
                        return <li key={pid}>{p?.name ?? pid}</li>;
                      })}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="text-xs text-emerald-500/80">
                Atualizado em{" "}
                {new Date(draftForRacha.createdAt).toLocaleString("pt-BR")} ·{" "}
                {draftForRacha.durationMinutes} min por partida
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm text-emerald-200/90">Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-emerald-200/90">Semana / apelido (opcional)</label>
            <input
              value={weekLabel}
              onChange={(e) => setWeekLabel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
              placeholder="Ex.: Pelada 12"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-emerald-200/90">Duração por partida no campo (min)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value) || 8)}
              className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
            />
          </div>
          <div className="text-xs text-emerald-400/90 self-end">
            Em um racha de 1h, normalmente saem 7-8 partidas de 8 minutos.
          </div>
        </div>

        {teamSource ? (
          <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-4 space-y-3">
            <p className="text-sm text-emerald-200/90">
              <strong>Times do racha:</strong>{" "}
              {teamsForm.map((t, i) => displayTeamName(t.name, i)).join(" · ")}
            </p>
            {teamsForm.length > 2 && (
              <p className="text-sm text-amber-200/90">
                Próxima partida sugerida pela fila:{" "}
                <strong>{displayTeamName(teamsForm[suggestedA]?.name ?? "", suggestedA)}</strong>{" "}
                ×{" "}
                <strong>{displayTeamName(teamsForm[suggestedB]?.name ?? "", suggestedB)}</strong>
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-emerald-300/90">Time em campo A</label>
                <select
                  value={fieldA}
                  onChange={(e) => setFieldA(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
                >
                  {teamsForm.map((t, i) => (
                    <option key={i} value={i}>
                      {displayTeamName(t.name, i)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-emerald-300/90">Time em campo B</label>
                <select
                  value={fieldB}
                  onChange={(e) => setFieldB(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
                >
                  {teamsForm.map((t, i) => (
                    <option key={i} value={i}>
                      {displayTeamName(t.name, i)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-amber-200/85">
            {agendamentoId
              ? "Não há sorteio vinculado a este racha. Use a página Sorteio e clique em “Vincular ao racha”, ou crie um jogo após o primeiro para reaproveitar os times."
              : "Selecione o racha. Se já houver sorteio vinculado, os times aparecem acima."}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadDraft}
            disabled={!canLoadFromSorteio}
            className="rounded-lg bg-emerald-800 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            Preencher do sorteio (racha ou último salvo)
          </button>
          <span className="self-center text-xs text-emerald-500">
            {hasDraftForSelectedRacha
              ? "Este racha tem sorteio salvo."
              : data.lastDraft
                ? "Há um último sorteio global — use o botão para copiar se combinar."
                : "Faça um sorteio e vincule ao racha na página Sorteio."}
          </span>
        </div>

        <button
          type="submit"
          disabled={saving || !teamSource || fieldA === fieldB}
          className="rounded-xl bg-amber-500 px-5 py-2.5 font-medium text-pitch-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {saving ? "Criando…" : "Criar jogo"}
        </button>
      </form>

      <div>
        <h2 className="font-display text-lg font-semibold text-amber-200">Histórico</h2>
        <div className="mt-3 max-w-md">
          <label className="text-xs text-emerald-300/90">Filtrar por racha</label>
          <select
            value={historyAgendamentoId}
            onChange={(e) => setHistoryAgendamentoId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
          >
            <option value="">Todos os rachas</option>
            {agendamentos.map((a) => (
              <option key={a.id} value={a.id}>
                {new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR")}
                {a.time ? ` às ${a.time}` : ""}
                {a.title ? ` · ${a.title}` : ""}
              </option>
            ))}
          </select>
        </div>
        {matches.length === 0 ? (
          <p className="mt-2 text-emerald-300/70">Nenhum jogo ainda.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {visibleGroups.map(({ agendamento, jogos }) => (
              <div
                key={agendamento.id}
                className="rounded-2xl border border-emerald-800/60 bg-emerald-950/25"
              >
                <div className="border-b border-emerald-900/70 px-4 py-3">
                  <h3 className="font-display text-base font-semibold text-amber-200">
                    {agendamento.title || "Racha"}
                  </h3>
                  <p className="text-sm text-emerald-300/90">
                    {new Date(agendamento.date + "T12:00:00").toLocaleDateString("pt-BR")}
                    {agendamento.time ? ` às ${agendamento.time}` : ""}
                    {agendamento.campo ? ` · Campo ${agendamento.campo}` : ""}
                    {` · ${jogos.length} jogo(s) · ordem: primeiro → último cadastrado`}
                  </p>
                </div>
                {jogos.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-emerald-500/90">
                    Nenhum jogo cadastrado neste racha.
                  </p>
                ) : (
                  <ul className="divide-y divide-emerald-900/80">
                    {jogos.map((m, idx) => (
                      <li key={m.id}>
                        <div className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex gap-3 sm:items-start">
                            <span
                              className="mt-0.5 inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-lg bg-emerald-900/50 px-1.5 font-mono text-xs font-semibold tabular-nums text-amber-200/95"
                              title="Ordem no racha (1º cadastrado …)"
                            >
                              {idx + 1}
                            </span>
                            <Link
                              href={`/jogos/${m.id}`}
                              className="flex min-w-0 flex-1 flex-col gap-1 transition hover:text-amber-100"
                            >
                              <span className="font-medium text-white">{matchHeadline(m)}</span>
                              <span className="text-sm text-emerald-300/90">
                                {new Date(m.date + "T12:00:00").toLocaleDateString("pt-BR")}
                                {m.weekLabel ? ` · ${m.weekLabel}` : ""}
                                {m.teamCount > 2 ? ` · Racha (${m.teamCount})` : ""}
                                {` · ${m.durationMinutes} min`}
                                {matchWinnerDisplayName(m)
                                  ? ` · Vencedor: ${matchWinnerDisplayName(m)}`
                                  : ""}
                              </span>
                            </Link>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteMatch(m.id)}
                            className="self-start text-sm text-red-400/90 hover:text-red-300"
                          >
                            Excluir jogo
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
