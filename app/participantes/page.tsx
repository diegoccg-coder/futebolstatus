"use client";

import { Stars } from "@/components/Stars";
import { teamsByRotation } from "@/lib/matchUi";
import { useAppData } from "@/lib/useData";

export default function ParticipantesPage() {
  const { data, loading, error, refresh } = useAppData();

  if (loading) return <p className="text-emerald-200/80">Carregando…</p>;
  if (error || !data) return <p className="text-red-300">{error ?? "Erro"}</p>;

  const draft = data.lastDraft;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Quem vai jogar</h1>
        <p className="mt-1 text-sm text-emerald-100/75">
          Último sorteio salvo pelo administrador. Se ainda não houver, peça para rodar o
          sorteio e clicar em &quot;Salvar como rascunho&quot;.
        </p>
      </div>

      {!draft ? (
        <p className="text-emerald-400/90">Nenhum sorteio publicado ainda.</p>
      ) : (
        <>
          <p className="text-sm text-emerald-300/90">
            Atualizado em {new Date(draft.createdAt).toLocaleString("pt-BR")} ·{" "}
            {draft.teamCount} times · partidas de {draft.durationMinutes} min
            {draft.format === "racha" ? " (racha)" : ""}.
          </p>
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
