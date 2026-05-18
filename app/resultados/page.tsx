"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { matchHeadline, matchWinnerDisplayName } from "@/lib/matchUi";
import { useAppData } from "@/lib/useData";

/** Jogos antigos sem `agendamentoId` vinculado. */
const SEM_RACHA = "__sem_racha__";

export default function ResultadosPage() {
  const { data, loading, error, refresh } = useAppData();
  const [selectedId, setSelectedId] = useState("");

  const agendamentosSorted = useMemo(
    () =>
      data ? [...data.agendamentos].sort((a, b) => b.date.localeCompare(a.date)) : [],
    [data]
  );

  const temJogosSemRacha = useMemo(
    () => (data ? data.matches.some((m) => !m.agendamentoId) : false),
    [data]
  );

  useEffect(() => {
    if (!data) return;
    if (agendamentosSorted.length === 0 && !temJogosSemRacha) {
      setSelectedId("");
      return;
    }
    if (
      !selectedId ||
      (selectedId !== SEM_RACHA && !data.agendamentos.some((a) => a.id === selectedId))
    ) {
      const temJogo = (aid: string) =>
        data.matches.some((m) => m.agendamentoId === aid);
      const comJogo = agendamentosSorted.find((a) => temJogo(a.id));
      if (comJogo) setSelectedId(comJogo.id);
      else if (agendamentosSorted[0]) setSelectedId(agendamentosSorted[0]!.id);
      else if (temJogosSemRacha) setSelectedId(SEM_RACHA);
      else setSelectedId("");
    }
  }, [data, agendamentosSorted, selectedId, temJogosSemRacha]);

  if (loading) return <p className="text-emerald-200/80">Carregando…</p>;
  if (error || !data) return <p className="text-red-300">{error ?? "Erro"}</p>;

  const agLabel = (id: string) => {
    const a = data.agendamentos.find((x) => x.id === id);
    if (!a) return id;
    const t = a.time ? ` · ${a.time}` : "";
    return `${a.date}${t}${a.title ? ` — ${a.title}` : ""}`;
  };

  const matchesFiltered = data.matches.filter((m) => {
    if (selectedId === SEM_RACHA) return !m.agendamentoId;
    return m.agendamentoId === selectedId;
  });

  const matches = [...matchesFiltered].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Resultados</h1>
        <p className="mt-1 text-sm text-emerald-100/75">
          Escolha o racha para listar os jogos. Toque em um jogo para ver gols, cartões e vencedor.
          Quem não é administrador vê tudo em modo leitura.
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-3 rounded-lg border border-emerald-700 px-3 py-1.5 text-sm text-emerald-200 hover:bg-emerald-900/40"
        >
          Atualizar lista
        </button>
      </div>

      {agendamentosSorted.length === 0 && !temJogosSemRacha ? (
        <p className="text-emerald-400/90">Nenhum racha na agenda e nenhum jogo registrado.</p>
      ) : (
        <>
          <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 p-4">
            <label className="block text-sm font-medium text-amber-200/95">Racha</label>
            <select
              className="mt-2 w-full max-w-xl rounded-lg border border-emerald-800/60 bg-pitch-950 px-3 py-2 text-emerald-100"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {agendamentosSorted.map((a) => {
                const n = data.matches.filter((m) => m.agendamentoId === a.id).length;
                return (
                  <option key={a.id} value={a.id}>
                    {agLabel(a.id)}
                    {n > 0 ? ` (${n} jogo${n !== 1 ? "s" : ""})` : ""}
                  </option>
                );
              })}
              {temJogosSemRacha && (
                <option value={SEM_RACHA}>
                  Sem racha vinculado (
                  {data.matches.filter((m) => !m.agendamentoId).length} jogo
                  {data.matches.filter((m) => !m.agendamentoId).length !== 1 ? "s" : ""})
                </option>
              )}
            </select>
          </div>

          {matches.length === 0 ? (
            <p className="text-emerald-400/90">
              Nenhum jogo registrado para este racha ainda.
            </p>
          ) : (
            <ul className="divide-y divide-emerald-900/80 rounded-2xl border border-emerald-800/60">
              {matches.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/jogos/${m.id}`}
                    className="flex flex-col gap-1 px-4 py-4 transition hover:bg-emerald-950/50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-medium text-white">{matchHeadline(m)}</span>
                    <span className="text-sm text-emerald-300/90">
                      {new Date(m.date + "T12:00:00").toLocaleDateString("pt-BR")}
                      {m.weekLabel ? ` · ${m.weekLabel}` : ""}
                      {m.teamCount > 2 ? ` · Racha (${m.teamCount})` : ""}
                      {matchWinnerDisplayName(m)
                        ? ` · Vencedor: ${matchWinnerDisplayName(m)}`
                        : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
