"use client";

import { useCallback, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import type { AppDataClient } from "./client-types";
import type { Player } from "./types";
import { createDefaultFinancasGlobais } from "./financas";

export type RefreshAppDataOptions = {
  /** Não mostra “Carregando…” (útil para atualização em segundo plano, ex.: Sorteio a cada 2 min). */
  silent?: boolean;
};

export function useAppData() {
  const [data, setData] = useState<AppDataClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (options?: RefreshAppDataOptions) => {
    const silent = options?.silent === true;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const r = await fetch("/api/data", { cache: "no-store" });
      if (r.status === 401) {
        await signOut({ callbackUrl: "/login" });
        return;
      }
      if (!r.ok) {
        let msg = "Falha ao carregar dados";
        try {
          const j = (await r.json()) as { error?: string };
          if (j?.error && typeof j.error === "string") msg = j.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const j = (await r.json()) as AppDataClient;
      setData({
        ...j,
        draftsByAgendamento: j.draftsByAgendamento ?? {},
        sorteioWorkspace: j.sorteioWorkspace ?? null,
        financasByAgendamento: j.financasByAgendamento ?? {},
        financasGlobais: j.financasGlobais ?? createDefaultFinancasGlobais(),
        financasHistorico: j.financasHistorico ?? [],
      });
      if (silent) {
        setError(null);
      }
    } catch (e) {
      if (!silent) {
        setError(e instanceof Error ? e.message : "Erro");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  const patchPlayer = useCallback((updated: Player) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        players: prev.players.map((p) =>
          p.id === updated.id ? { ...p, ...updated } : p
        ),
      };
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh, patchPlayer };
}
