"use client";

import { useEffect, useMemo, useState } from "react";
import { Stars } from "@/components/Stars";
import { teamsByRotation } from "@/lib/matchUi";
import { useAppData } from "@/lib/useData";

export default function ParticipantesPage() {
  const { data, loading, error, refresh } = useAppData();
  const [selectedId, setSelectedId] = useState("");

  const agendamentosSorted = useMemo(
    () =>
      data ? [...data.agendamentos].sort((a, b) => b.date.localeCompare(a.date)) : [],
    [data]
  );

  useEffect(() => {
    if (!data) return;
    if (agendamentosSorted.length === 0) {
      setSelectedId("");
      return;
    }
    if (!selectedId || !data.agendamentos.some((a) => a.id === selectedId)) {
      const comSorteio = agendamentosSorted.find((a) => data.draftsByAgendamento[a.id]);
      setSelectedId((comSorteio ?? agendamentosSorted[0])!.id);
    }
  }, [data, agendamentosSorted, selectedId]);

  if (loading) return <p className="text-emerald-200/80">Carregando…</p>;
  if (error || !data) return <p className="text-red-300">{error ?? "Erro"}</p>;

  const agLabel = (id: string) => {
    const a = data.agendamentos.find((x) => x.id === id);
    if (!a) return id;
    const t = a.time ? ` · ${a.time}` : "";
    return `${a.date}${t}${a.title ? ` — ${a.title}` : ""}`;
  };

  const draft =
    selectedId && data.draftsByAgendamento[selectedId]
      ? data.draftsByAgendamento[selectedId]
      : null;

  const players = data.players;
  function playerName(id: string | null | undefined): string | null {
    if (!id) return null;
    return players.find((x) => x.id === id)?.name ?? null;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Quem vai jogar</h1>
        <p className="mt-1 text-sm text-emerald-100/75">
          Escolha o racha para ver os jogadores do sorteio vinculado na página Sorteio (&quot;Vincular
          ao racha&quot;).
        </p>
      </div>

      {agendamentosSorted.length === 0 ? (
        <p className="text-emerald-400/90">Nenhum racha na agenda ainda.</p>
      ) : (
        <>
          <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 p-4">
            <label className="block text-sm font-medium text-amber-200/95">Racha</label>
            <select
              className="mt-2 w-full max-w-xl rounded-lg border border-emerald-800/60 bg-pitch-950 px-3 py-2 text-emerald-100"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {agendamentosSorted.map((a) => (
                <option key={a.id} value={a.id}>
                  {agLabel(a.id)}
                  {data.draftsByAgendamento[a.id] ? "" : " (sem sorteio)"}
                </option>
              ))}
            </select>
          </div>

          {!draft ? (
            <p className="text-emerald-400/90">
              Este racha ainda não tem sorteio vinculado. Peça ao administrador para rodar o sorteio,
              escolher o racha e usar &quot;Vincular ao racha&quot; na página Sorteio.
            </p>
          ) : (
            <>
              <p className="text-sm text-emerald-300/90">
                Atualizado em {new Date(draft.createdAt).toLocaleString("pt-BR")} ·{" "}
                {draft.teamCount} times · partidas de {draft.durationMinutes} min
                {draft.format === "racha" ? " (racha)" : ""}.
              </p>
              {(draft.golEntradaPlayerId || draft.golFundoPlayerId) && (
                <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-4">
                  <p className="text-sm font-medium text-amber-200/95">Goleiros (sorteio)</p>
                  <ul className="mt-2 space-y-1 text-sm text-emerald-100/90">
                    {draft.golEntradaPlayerId ? (
                      <li className="flex justify-between gap-2">
                        <span>Gol entrada</span>
                        <span className="text-emerald-200">
                          {playerName(draft.golEntradaPlayerId) ?? "—"}
                        </span>
                      </li>
                    ) : null}
                    {draft.golFundoPlayerId ? (
                      <li className="flex justify-between gap-2">
                        <span>Gol fundo</span>
                        <span className="text-emerald-200">
                          {playerName(draft.golFundoPlayerId) ?? "—"}
                        </span>
                      </li>
                    ) : null}
                  </ul>
                </div>
              )}
              {draft.format === "racha" && (
                <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 p-4">
                  <p className="text-sm font-medium text-amber-200/95">Ordem da fila</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-emerald-100/90">
                    {teamsByRotation(draft.teams).map((t) => (
                      <li key={`${t.name}-${t.rotationOrder}`}>{t.name}</li>
                    ))}
                  </ol>
                </div>
              )}
              <div
                className={`grid gap-6 ${
                  draft.teams.length <= 2 ? "md:grid-cols-2" : "sm:grid-cols-2"
                }`}
              >
                {draft.teams.map((t, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-emerald-800/60 bg-emerald-950/40 p-5"
                  >
                    <h2 className="font-display text-lg font-semibold text-amber-200">
                      {t.name}
                    </h2>
                    {draft.teamCount > 2 && (
                      <p className="text-xs text-emerald-500/90">Fila: {t.rotationOrder}º</p>
                    )}
                    <ul className="mt-3 space-y-2">
                      {t.playerIds.map((pid) => {
                        const p = data.players.find((x) => x.id === pid);
                        if (!p) return null;
                        return (
                          <li key={pid} className="flex justify-between text-sm">
                            <span>{p.name}</span>
                            <Stars value={p.stars} readOnly />
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <button
        type="button"
        onClick={() => refresh()}
        className="text-sm text-emerald-400 underline hover:text-emerald-300"
      >
        Atualizar
      </button>
    </div>
  );
}
