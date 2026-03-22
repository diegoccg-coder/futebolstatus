import Link from "next/link";
import { getAuthSession } from "@/lib/auth-server";

export default async function HomePage() {
  const session = await getAuthSession();
  const admin = session?.user?.role === "admin";

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl font-bold text-white md:text-4xl">
          Sua pelada semanal
        </h1>
        <p className="mt-2 max-w-2xl text-emerald-100/85">
          Olá{session?.user?.name ? `, ${session.user.name}` : ""}. Use o{" "}
          <Link href="/painel" className="text-amber-300 underline hover:text-amber-200">
            painel
          </Link>{" "}
          para ver quem joga, rachas marcados, resultados e ranking.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        <li>
          <Link
            href="/painel"
            className="block rounded-2xl border border-emerald-800/60 bg-emerald-950/40 p-6 transition hover:border-amber-500/40"
          >
            <h2 className="font-display text-lg font-semibold text-amber-200">Painel</h2>
            <p className="mt-2 text-sm text-emerald-100/80">Atalhos para jogadores e admin.</p>
          </Link>
        </li>
        <li>
          <Link
            href="/participantes"
            className="block rounded-2xl border border-emerald-800/60 bg-emerald-950/40 p-6 transition hover:border-amber-500/40"
          >
            <h2 className="font-display text-lg font-semibold text-amber-200">Quem joga</h2>
            <p className="mt-2 text-sm text-emerald-100/80">Último sorteio e fila do racha.</p>
          </Link>
        </li>
        <li>
          <Link
            href="/agenda"
            className="block rounded-2xl border border-emerald-800/60 bg-emerald-950/40 p-6 transition hover:border-amber-500/40"
          >
            <h2 className="font-display text-lg font-semibold text-amber-200">Rachas</h2>
            <p className="mt-2 text-sm text-emerald-100/80">Datas marcadas.</p>
          </Link>
        </li>
        <li>
          <Link
            href="/resultados"
            className="block rounded-2xl border border-emerald-800/60 bg-emerald-950/40 p-6 transition hover:border-amber-500/40"
          >
            <h2 className="font-display text-lg font-semibold text-amber-200">Resultados</h2>
            <p className="mt-2 text-sm text-emerald-100/80">Jogos, gols e campeão.</p>
          </Link>
        </li>
        <li>
          <Link
            href="/ranking"
            className="block rounded-2xl border border-emerald-800/60 bg-emerald-950/40 p-6 transition hover:border-amber-500/40"
          >
            <h2 className="font-display text-lg font-semibold text-amber-200">Ranking</h2>
            <p className="mt-2 text-sm text-emerald-100/80">Artilharia e times.</p>
          </Link>
        </li>
        {admin && (
          <li>
            <Link
              href="/jogadores"
              className="block rounded-2xl border border-amber-900/50 bg-amber-950/25 p-6 transition hover:border-amber-500/50"
            >
              <h2 className="font-display text-lg font-semibold text-amber-200">
                Admin · Jogadores
              </h2>
              <p className="mt-2 text-sm text-emerald-100/80">Cadastro da pelada.</p>
            </Link>
          </li>
        )}
      </ul>

      <p className="text-sm text-emerald-500/90">
        Primeiro login do administrador: veja o arquivo <strong>README.md</strong> na pasta do
        projeto (conta criada automaticamente se ainda não houver usuários).
      </p>
    </div>
  );
}
