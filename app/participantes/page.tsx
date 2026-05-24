"use client";

import { useEffect, useMemo, useState } from "react";
import { Stars } from "@/components/Stars";
import { formatAgendamentoLabel } from "@/lib/agendamentos-ui";
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold text-white">Quem vai jogar</h1>
        <button
          type="button"
          onClick={() => refresh()}
          className="rounded border border-emerald-700 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-900/40"
        >
          Atualizar
        </button>
      </div>

      {agendamentosSorted.length === 0 ? (
        <p className="text-sm text-emerald-400/90">Nenhum racha na agenda ainda.</p>
      ) : (
        <>
          <section className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-3 space-y-2">
            <h2 className="text-sm font-semibold text-amber-200">1. Racha</h2>
            <select
              className="w-full rounded-lg border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-sm text-white"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {agendamentosSorted.map((a) => (
                <option key={a.id} value={a.id}>
                  {formatAgendamentoLabel(a)}
                  {data.draftsByAgendamento[a.id] ? "" : " (sem sorteio)"}
                </option>
              ))}
            </select>
          </section>

          {!draft ? (
            <p className="text-xs text-emerald-400/90">
              Sem sorteio vinculado. Use a página Sorteio → Vincular ao racha.
            </p>
          ) : (
            <>
              <p className="text-xs text-emerald-300/90">
                {new Date(draft.createdAt).toLocaleString("pt-BR")} · {draft.teamCount}T ·{" "}
                {draft.durationMinutes} min{draft.format === "racha" ? " · racha" : ""}
              </p>

              {(draft.golEntradaPlayerId || draft.golFundoPlayerId || draft.format === "racha") && (
                <section className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-3 space-y-2">
                  <h2 className="text-sm font-semibold text-amber-200">2. Goleiros e fila</h2>
                  {(draft.golEntradaPlayerId || draft.golFundoPlayerId) && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {draft.golEntradaPlayerId && (
                        <div className="rounded border border-sky-800/50 bg-pitch-950/40 px-2 py-1.5">
                          <p className="text-[10px] text-sky-300/95">Gol entrada</p>
                          <p className="font-medium text-white">{playerName(draft.golEntradaPlayerId) ?? "—"}</p>
                        </div>
                      )}
                      {draft.golFundoPlayerId && (
                        <div className="rounded border border-sky-800/50 bg-pitch-950/40 px-2 py-1.5">
                          <p className="text-[10px] text-sky-300/95">Gol fundo</p>
                          <p className="font-medium text-white">{playerName(draft.golFundoPlayerId) ?? "—"}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {draft.format === "racha" && (
                    <ol className="list-decimal space-y-0.5 pl-4 text-xs text-emerald-100/90">
                      {teamsByRotation(draft.teams).map((t) => (
                        <li key={`${t.name}-${t.rotationOrder}`}>{t.name}</li>
                      ))}
                    </ol>
                  )}
                </section>
              )}

              <section>
                <h2 className="text-sm font-semibold text-amber-200">3. Times</h2>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {draft.teams.map((t, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-2"
                    >
                      <p className="text-xs font-semibold text-amber-200">
                        {t.name}
                        {draft.teamCount > 2 && (
                          <span className="font-normal text-emerald-500/90"> · {t.rotationOrder}º</span>
                        )}
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {t.playerIds.map((pid) => {
                          const p = data.players.find((x) => x.id === pid);
                          if (!p) return null;
                          return (
                            <li key={pid} className="flex items-center justify-between gap-1 text-[11px]">
                              <span className="min-w-0 truncate text-white/95">{p.name}</span>
                              <Stars value={p.stars} readOnly />
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
