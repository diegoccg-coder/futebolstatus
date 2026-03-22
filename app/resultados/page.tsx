"use client";

import Link from "next/link";
import { matchHeadline, matchWinnerDisplayName } from "@/lib/matchUi";
import { useAppData } from "@/lib/useData";

export default function ResultadosPage() {
  const { data, loading, error, refresh } = useAppData();

  if (loading) return <p className="text-emerald-200/80">Carregando…</p>;
  if (error || !data) return <p className="text-red-300">{error ?? "Erro"}</p>;

  const matches = [...data.matches].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Resultados</h1>
        <p className="mt-1 text-sm text-emerald-100/75">
          Histórico de jogos. Abra um jogo para ver gols, assistências e campeão.
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-3 rounded-lg border border-emerald-700 px-3 py-1.5 text-sm text-emerald-200 hover:bg-emerald-900/40"
        >
          Atualizar lista
        </button>
      </div>
      {matches.length === 0 ? (
        <p className="text-emerald-400/90">Nenhum jogo registrado ainda.</p>
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
    </div>
  );
}
