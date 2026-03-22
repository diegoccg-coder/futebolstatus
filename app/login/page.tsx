"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });
      if (res?.error) {
        setErr("Email ou senha incorretos.");
        return;
      }
      router.replace("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-emerald-200/80">
        Carregando…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-8 pt-8">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold text-white">Entrar</h1>
        <p className="mt-2 text-sm text-emerald-200/75">
          Use o email e a senha criados pelo administrador.
        </p>
      </div>
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-emerald-800/60 bg-emerald-950/50 p-8"
      >
        <div>
          <label htmlFor="email" className="block text-sm text-emerald-200/90">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm text-emerald-200/90">
            Senha
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
            required
          />
        </div>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-amber-500 py-2.5 font-medium text-pitch-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <p className="text-center text-xs text-emerald-600">
        Primeiro acesso? Peça ao administrador para criar seu usuário no sistema.
      </p>
    </div>
  );
}
