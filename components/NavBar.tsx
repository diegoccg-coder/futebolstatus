"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const adminLinks = [
  { href: "/jogadores", label: "Jogadores" },
  { href: "/sorteio", label: "Sorteio" },
  { href: "/jogos", label: "Jogos" },
  { href: "/admin/usuarios", label: "Usuários" },
];

const allLinks = [
  { href: "/", label: "Início" },
  { href: "/painel", label: "Painel" },
  { href: "/participantes", label: "Quem joga" },
  { href: "/agenda", label: "Rachas" },
  { href: "/resultados", label: "Resultados" },
  { href: "/ranking", label: "Ranking" },
];

export function NavBar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  if (pathname === "/login") {
    return null;
  }

  const isAdmin = session?.user?.role === "admin";

  return (
    <header className="border-b border-emerald-800/80 bg-pitch-950/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link
          href="/"
          className="font-display text-xl font-bold tracking-tight text-amber-300"
        >
          ⚽ Pelada
        </Link>
        <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
          {allLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm transition hover:bg-emerald-900/60 hover:text-white ${
                pathname === item.href
                  ? "bg-emerald-900/50 text-white"
                  : "text-emerald-100/90"
              }`}
            >
              {item.label}
            </Link>
          ))}
          {isAdmin &&
            adminLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm transition hover:bg-amber-900/40 hover:text-amber-100 ${
                  pathname === item.href || pathname.startsWith(item.href + "/")
                    ? "bg-amber-900/30 text-amber-200"
                    : "text-amber-200/85"
                }`}
              >
                {item.label}
              </Link>
            ))}
          {status === "authenticated" && (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-lg px-3 py-2 text-sm text-emerald-400 hover:text-white"
            >
              Sair
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
