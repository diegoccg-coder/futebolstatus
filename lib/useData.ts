"use client";

import { useCallback, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import type { AppDataClient } from "./client-types";

export function useAppData() {
  const [data, setData] = useState<AppDataClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
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
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
