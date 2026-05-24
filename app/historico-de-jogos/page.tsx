"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { JogosRachaList } from "@/components/JogosRachaList";
import { formatAgendamentoLabel, getLatestAgendamento } from "@/lib/agendamentos-ui";
import { sortMatchesForRacha } from "@/lib/jogos-helpers";
import type { Agendamento, Match } from "@/lib/types";
import { useAppData } from "@/lib/useData";

const SEM_RACHA = "__sem_racha__";

export default function HistoricoDeJogosPage() {
  const { data, loading, error, refresh } = useAppData();
  const [filterId, setFilterId] = useState("");

  const latestRacha = useMemo(
    () => (data ? getLatestAgendamento(data.agendamentos) : null),
    [data]
  );

  const pastAgendamentos = useMemo(() => {
    if (!data) return [];
    return [...data.agendamentos]
      .filter((a) => a.id !== latestRacha?.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data, latestRacha?.id]);

  const matchesSemRacha = useMemo(
    () => (data ? data.matches.filter((m) => !m.agendamentoId) : []),
    [data]
  );

  const grouped = useMemo(() => {
    const groups: Array<{
      id: string;
      agendamento: Agendamento | null;
      jogos: Match[];
    }> = pastAgendamentos.map((agendamento) => ({
      id: agendamento.id,
      agendamento,
      jogos: sortMatchesForRacha(
        (data?.matches ?? []).filter((m) => m.agendamentoId === agendamento.id)
      ),
    }));
    if (matchesSemRacha.length > 0) {
      groups.push({
        id: SEM_RACHA,
        agendamento: null,
        jogos: sortMatchesForRacha(matchesSemRacha),
      });
    }
    return groups.filter((g) => g.jogos.length > 0);
  }, [data, pastAgendamentos, matchesSemRacha]);

  const visibleGroups = filterId
    ? grouped.filter((g) => g.id === filterId)
    : grouped;

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

  if (loading) return <p className="text-emerald-200/80">Carregando…</p>;
  if (error || !data) return <p className="text-red-300">{error ?? "Erro"}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold text-white">Histórico de jogos</h1>
        <Link
          href="/jogos"
          className="text-xs text-amber-300/95 underline hover:text-amber-200"
        >
          Jogos do racha atual
        </Link>
      </div>

      {latestRacha && (
        <p className="text-xs text-emerald-400/90">
          O racha atual ({formatAgendamentoLabel(latestRacha)}) está na página{" "}
          <Link href="/jogos" className="text-amber-300 underline">
            Jogos
          </Link>
          .
        </p>
      )}

      {grouped.length === 0 ? (
        <p className="text-sm text-emerald-500/90">Nenhum jogo em rachas anteriores.</p>
      ) : (
        <>
          <div>
            <label className="text-xs text-amber-200/95">Filtrar racha</label>
            <select
              value={filterId}
              onChange={(e) => setFilterId(e.target.value)}
              className="mt-1 w-full max-w-xl rounded-lg border border-emerald-800/60 bg-pitch-950 px-2 py-1.5 text-sm text-emerald-100"
            >
              <option value="">Todos os rachas anteriores</option>
              {grouped.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.agendamento
                    ? formatAgendamentoLabel(g.agendamento)
                    : "Sem racha vinculado"}
                  {` (${g.jogos.length} jogo${g.jogos.length !== 1 ? "s" : ""})`}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            {visibleGroups.map((g) => (
              <section
                key={g.id}
                className="rounded-lg border border-emerald-800/60 bg-emerald-950/25"
              >
                <div className="border-b border-emerald-900/70 px-3 py-2">
                  <h2 className="text-sm font-semibold text-amber-200">
                    {g.agendamento
                      ? g.agendamento.title || formatAgendamentoLabel(g.agendamento)
                      : "Sem racha vinculado"}
                  </h2>
                  {g.agendamento && (
                    <p className="text-xs text-emerald-300/90">
                      {formatAgendamentoLabel(g.agendamento)} · {g.jogos.length} jogo
                      {g.jogos.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
                <div className="p-2">
                  <JogosRachaList
                    matches={g.jogos}
                    onDelete={deleteMatch}
                    emptyMessage="Nenhum jogo."
                  />
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
