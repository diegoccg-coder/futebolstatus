"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useAppData } from "@/lib/useData";

export default function PainelPage() {
  const { data: session } = useSession();
  const { data, loading, error } = useAppData();

  if (loading) return <p className="text-emerald-200/80">Carregando…</p>;
  if (error || !data) return <p className="text-red-300">{error ?? "Erro"}</p>;

  const isAdmin = session?.user?.role === "admin";
  const nextRachas = [...data.agendamentos]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Painel</h1>
        <p className="mt-1 text-emerald-100/80">
          Olá, <strong>{session?.user?.name}</strong>
          {isAdmin ? " (administrador)" : " (jogador)"}.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        <li>
          <Link
            href="/participantes"
            className="block rounded-xl border border-emerald-800/60 bg-emerald-950/40 p-5 hover:border-amber-500/30"
          >
            <h2 className="font-display font-semibold text-amber-200">Quem joga</h2>
            <p className="mt-1 text-sm text-emerald-200/80">
              Último sorteio salvo: times e ordem da fila.
            </p>
          </Link>
        </li>
        <li>
          <Link
            href="/agenda"
            className="block rounded-xl border border-emerald-800/60 bg-emerald-950/40 p-5 hover:border-amber-500/30"
          >
            <h2 className="font-display font-semibold text-amber-200">Rachas marcados</h2>
            <p className="mt-1 text-sm text-emerald-200/80">Datas e horários combinados.</p>
          </Link>
        </li>
        <li>
          <Link
            href="/resultados"
            className="block rounded-xl border border-emerald-800/60 bg-emerald-950/40 p-5 hover:border-amber-500/30"
          >
            <h2 className="font-display font-semibold text-amber-200">Resultados</h2>
            <p className="mt-1 text-sm text-emerald-200/80">Jogos registrados, gols e campeão.</p>
          </Link>
        </li>
        <li>
          <Link
            href="/ranking"
            className="block rounded-xl border border-emerald-800/60 bg-emerald-950/40 p-5 hover:border-amber-500/30"
          >
            <h2 className="font-display font-semibold text-amber-200">Ranking</h2>
            <p className="mt-1 text-sm text-emerald-200/80">Artilharia e times.</p>
          </Link>
        </li>
      </ul>

      {isAdmin && (
        <div className="rounded-2xl border border-amber-900/40 bg-amber-950/15 p-6">
          <h2 className="font-display text-lg font-semibold text-amber-200">
            Área do administrador
          </h2>
          <ul className="mt-3 flex flex-wrap gap-3 text-sm">
            <Link href="/jogadores" className="text-amber-100/90 underline">
              Jogadores
            </Link>
            <Link href="/sorteio" className="text-amber-100/90 underline">
              Sorteio
            </Link>
            <Link href="/jogos" className="text-amber-100/90 underline">
              Jogos
            </Link>
            <Link href="/admin/usuarios" className="text-amber-100/90 underline">
              Usuários
            </Link>
          </ul>
        </div>
      )}

      {nextRachas.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold text-amber-200">
            Próximos rachas
          </h2>
          <ul className="mt-2 space-y-2 text-sm text-emerald-100/85">
            {nextRachas.map((a) => (
              <li key={a.id}>
                {new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR")}
                {a.time ? ` às ${a.time}` : ""}
                {a.title ? ` — ${a.title}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
