"use client";

import { Stars } from "@/components/Stars";
import { rankPlayers, rankTeams } from "@/lib/stats";
import { useAppData } from "@/lib/useData";

export default function RankingPage() {
  const { data, loading, error, refresh } = useAppData();

  if (loading) return <p className="text-emerald-200/80">Carregando…</p>;
  if (error || !data) return <p className="text-red-300">{error ?? "Erro"}</p>;

  const players = rankPlayers(data);
  const teams = rankTeams(data);

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Ranking</h1>
        <p className="mt-1 text-sm text-emerald-100/75">
          Gols e vitórias consideram só quem estava <strong>em campo</strong> na partida (os dois
          times do jogo). Vitórias usam o campeão cadastrado ou, se faltar, o <strong>placar</strong>{" "}
          (e pênaltis, se marcados). Use nomes de time estáveis para somar títulos (ex.: sempre
          &quot;Verde&quot; e &quot;Amarelo&quot;).
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-3 rounded-lg border border-emerald-700 px-3 py-1.5 text-sm text-emerald-200 hover:bg-emerald-900/40"
        >
          Atualizar ranking
        </button>
      </div>

      <section>
        <h2 className="font-display text-lg font-semibold text-amber-200">
          Melhores jogadores
        </h2>
        {players.every((r) => r.goals === 0 && r.assists === 0 && r.games === 0) ? (
          <p className="mt-3 text-sm text-emerald-500/90">
            Ainda não há estatísticas. Cadastre jogadores, registre jogos e gols.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="border-b border-emerald-800/80 text-emerald-400/90">
                  <th className="pb-2 pr-4">#</th>
                  <th className="pb-2 pr-4">Jogador</th>
                  <th className="pb-2 pr-4">Nível</th>
                  <th className="pb-2 pr-4">Gols</th>
                  <th className="pb-2 pr-4">Assist.</th>
                  <th className="pb-2 pr-4">Vitórias</th>
                  <th className="pb-2">Jogos</th>
                </tr>
              </thead>
              <tbody>
                {players.map((r, i) => (
                  <tr key={r.player.id} className="border-b border-emerald-900/50">
                    <td className="py-2.5 pr-4 text-emerald-500">{i + 1}</td>
                    <td className="py-2.5 pr-4 font-medium text-white">{r.player.name}</td>
                    <td className="py-2.5 pr-4">
                      <Stars value={r.player.stars} readOnly />
                    </td>
                    <td className="py-2.5 pr-4">{r.goals}</td>
                    <td className="py-2.5 pr-4">{r.assists}</td>
                    <td className="py-2.5 pr-4">{r.wins}</td>
                    <td className="py-2.5">{r.games}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-amber-200">
          Melhores times (por títulos)
        </h2>
        {teams.length === 0 ? (
          <p className="mt-3 text-sm text-emerald-500/90">
            Nenhum jogo registrado ainda para montar o ranking de times.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[20rem] text-left text-sm">
              <thead>
                <tr className="border-b border-emerald-800/80 text-emerald-400/90">
                  <th className="pb-2 pr-4">#</th>
                  <th className="pb-2 pr-4">Time</th>
                  <th className="pb-2 pr-4">Títulos</th>
                  <th className="pb-2">Jogos</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t, i) => (
                  <tr key={t.name} className="border-b border-emerald-900/50">
                    <td className="py-2.5 pr-4 text-emerald-500">{i + 1}</td>
                    <td className="py-2.5 pr-4 font-medium text-white">{t.name}</td>
                    <td className="py-2.5 pr-4">{t.wins}</td>
                    <td className="py-2.5">{t.games}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
