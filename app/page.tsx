"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useAppData } from "@/lib/useData";

const links = [
  { href: "/participantes", label: "Quem joga" },
  { href: "/agenda", label: "Rachas" },
  { href: "/resultados", label: "Resultados" },
  { href: "/ranking", label: "Ranking" },
  { href: "/foto-do-campeao", label: "Foto do campeão" },
];

const adminLinks = [
  { href: "/jogadores", label: "Jogadores" },
  { href: "/sorteio", label: "Sorteio" },
  { href: "/jogos", label: "Jogos" },
  { href: "/historico-de-jogos", label: "Histórico de jogos" },
  { href: "/financas", label: "Finanças" },
  { href: "/admin/usuarios", label: "Usuários" },
];

export default function HomePage() {
  const { data: session } = useSession();
  const { data, loading, error } = useAppData();

  if (loading) return <p className="text-emerald-200/80">Carregando…</p>;
  if (error || !data) return <p className="text-red-300">{error ?? "Erro"}</p>;

  const isAdmin = session?.user?.role === "admin";
  const nextRachas = [...data.agendamentos]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-bold text-white">Início</h1>
        {session?.user?.name && (
          <p className="text-sm text-emerald-200/80">
            Olá, <strong>{session.user.name}</strong>
            {isAdmin ? " · admin" : ""}
          </p>
        )}
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {links.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block rounded-lg border border-emerald-800/60 bg-emerald-950/40 px-3 py-2.5 text-sm font-medium text-amber-200 transition hover:border-amber-500/40"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      {isAdmin && (
        <div className="rounded-lg border border-amber-900/40 bg-amber-950/15 px-3 py-2.5">
          <h2 className="text-sm font-semibold text-amber-200">Admin</h2>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {adminLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-amber-100/90 underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {nextRachas.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-amber-200">Próximos rachas</h2>
          <ul className="mt-1 space-y-0.5 text-sm text-emerald-100/85">
            {nextRachas.map((a) => (
              <li key={a.id}>
                {new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR")}
                {a.time ? ` · ${a.time}` : ""}
                {a.title ? ` — ${a.title}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
