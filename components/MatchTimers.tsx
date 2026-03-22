"use client";

import { useCallback, useEffect, useState } from "react";
import type { Player } from "@/lib/types";

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function formatTimerMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${pad2(m)}:${pad2(r)}`;
}

type MainPersist = {
  pausedAccum: number;
  runStart: number | null;
};

type SuspPersist = {
  playerId: string;
  remaining: number;
  running: boolean;
  updatedAt: number;
};

function loadMain(matchId: string): MainPersist {
  try {
    const raw = localStorage.getItem(`pelada-crono-partida-${matchId}`);
    if (!raw) return { pausedAccum: 0, runStart: null };
    const j = JSON.parse(raw) as MainPersist;
    const pausedAccum = typeof j.pausedAccum === "number" ? j.pausedAccum : 0;
    const runStart = typeof j.runStart === "number" ? j.runStart : null;
    return { pausedAccum, runStart };
  } catch {
    return { pausedAccum: 0, runStart: null };
  }
}

function saveMain(matchId: string, p: MainPersist) {
  try {
    localStorage.setItem(`pelada-crono-partida-${matchId}`, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function loadSusp(matchId: string): { playerId: string; remaining: number; running: boolean } | null {
  try {
    const raw = localStorage.getItem(`pelada-crono-exclusao-${matchId}`);
    if (!raw) return null;
    const j = JSON.parse(raw) as SuspPersist;
    if (typeof j.remaining !== "number" || typeof j.playerId !== "string") return null;
    let remaining = Math.max(0, Math.floor(j.remaining));
    if (j.running && typeof j.updatedAt === "number") {
      const passed = Math.floor((Date.now() - j.updatedAt) / 1000);
      remaining = Math.max(0, remaining - passed);
    }
    return {
      playerId: j.playerId,
      remaining,
      running: j.running && remaining > 0,
    };
  } catch {
    return null;
  }
}

function saveSusp(matchId: string, p: SuspPersist | null) {
  try {
    if (p === null) {
      localStorage.removeItem(`pelada-crono-exclusao-${matchId}`);
    } else {
      localStorage.setItem(`pelada-crono-exclusao-${matchId}`, JSON.stringify(p));
    }
  } catch {
    /* ignore */
  }
}

type Props = {
  matchId: string;
  durationMinutes: number;
  playersOnField: Player[];
  canControl: boolean;
};

export function MatchTimers({ matchId, durationMinutes, playersOnField, canControl }: Props) {
  const [mainPausedAccum, setMainPausedAccum] = useState(0);
  const [mainRunStart, setMainRunStart] = useState<number | null>(null);
  const [, setMainTick] = useState(0);

  const [suspPlayerId, setSuspPlayerId] = useState("");
  const [suspRemaining, setSuspRemaining] = useState(0);
  const [suspRunning, setSuspRunning] = useState(false);
  const [suspDoneFlash, setSuspDoneFlash] = useState(false);

  useEffect(() => {
    const m = loadMain(matchId);
    setMainPausedAccum(m.pausedAccum);
    setMainRunStart(m.runStart);
    const s = loadSusp(matchId);
    if (s && s.remaining > 0) {
      setSuspPlayerId(s.playerId);
      setSuspRemaining(s.remaining);
      setSuspRunning(s.running);
      saveSusp(matchId, {
        playerId: s.playerId,
        remaining: s.remaining,
        running: s.running,
        updatedAt: Date.now(),
      });
    } else {
      setSuspPlayerId("");
      setSuspRemaining(0);
      setSuspRunning(false);
      saveSusp(matchId, null);
    }
  }, [matchId]);

  useEffect(() => {
    saveMain(matchId, { pausedAccum: mainPausedAccum, runStart: mainRunStart });
  }, [matchId, mainPausedAccum, mainRunStart]);

  const mainLiveSec =
    mainPausedAccum +
    (mainRunStart !== null ? Math.floor((Date.now() - mainRunStart) / 1000) : 0);

  useEffect(() => {
    if (mainRunStart === null) return;
    const id = setInterval(() => setMainTick((t) => t + 1), 200);
    return () => clearInterval(id);
  }, [mainRunStart]);

  useEffect(() => {
    if (!suspRunning) return;
    const id = setInterval(() => {
      setSuspRemaining((r) => {
        if (r <= 0) return 0;
        const next = r - 1;
        if (next === 0) {
          setSuspRunning(false);
          setSuspDoneFlash(true);
          setTimeout(() => setSuspDoneFlash(false), 5000);
          saveSusp(matchId, null);
          return 0;
        }
        saveSusp(matchId, {
          playerId: suspPlayerId,
          remaining: next,
          running: true,
          updatedAt: Date.now(),
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [suspRunning, matchId, suspPlayerId]);

  const mainStart = useCallback(() => {
    if (mainRunStart !== null) return;
    setMainRunStart(Date.now());
  }, [mainRunStart]);

  const mainPause = useCallback(() => {
    if (mainRunStart === null) return;
    const add = Math.floor((Date.now() - mainRunStart) / 1000);
    setMainPausedAccum((a) => a + add);
    setMainRunStart(null);
  }, [mainRunStart]);

  const mainReset = useCallback(() => {
    setMainRunStart(null);
    setMainPausedAccum(0);
    saveMain(matchId, { pausedAccum: 0, runStart: null });
  }, [matchId]);

  const configSec = durationMinutes * 60;
  const overConfig = mainLiveSec > configSec;

  const startSuspension = useCallback(() => {
    if (!suspPlayerId) {
      alert("Selecione o jogador em campo.");
      return;
    }
    setSuspRemaining(60);
    setSuspRunning(true);
    setSuspDoneFlash(false);
    saveSusp(matchId, {
      playerId: suspPlayerId,
      remaining: 60,
      running: true,
      updatedAt: Date.now(),
    });
  }, [suspPlayerId, matchId]);

  const pauseSusp = useCallback(() => {
    setSuspRunning(false);
    if (suspRemaining > 0 && suspPlayerId) {
      saveSusp(matchId, {
        playerId: suspPlayerId,
        remaining: suspRemaining,
        running: false,
        updatedAt: Date.now(),
      });
    }
  }, [suspRemaining, suspPlayerId, matchId]);

  const resumeSusp = useCallback(() => {
    if (!suspPlayerId || suspRemaining <= 0) return;
    setSuspRunning(true);
    saveSusp(matchId, {
      playerId: suspPlayerId,
      remaining: suspRemaining,
      running: true,
      updatedAt: Date.now(),
    });
  }, [suspPlayerId, suspRemaining, matchId]);

  const resetSusp = useCallback(() => {
    setSuspRunning(false);
    setSuspRemaining(0);
    saveSusp(matchId, null);
  }, [matchId]);

  const suspName = playersOnField.find((p) => p.id === suspPlayerId)?.name;
  const suspBlockedSelect = suspRunning && suspRemaining > 0;
  const canStartSusp = Boolean(suspPlayerId && suspRemaining === 0);

  return (
    <section className="space-y-6">
      <h2 className="font-display text-lg font-semibold text-amber-200">Cronômetros</h2>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-emerald-800/60 bg-emerald-950/40 p-5">
          <h3 className="font-display text-base font-semibold text-amber-200/95">
            Tempo de jogo
          </h3>
          <p className="mt-1 text-xs text-emerald-500/90">
            Contagem neste aparelho (local). Partida combinada: {durationMinutes} min (
            {formatTimerMmSs(configSec)}).
          </p>
          <p
            className={`mt-4 font-mono text-4xl font-bold tracking-tight tabular-nums ${
              overConfig ? "text-amber-300" : "text-white"
            }`}
          >
            {formatTimerMmSs(mainLiveSec)}
          </p>
          {overConfig && (
            <p className="mt-1 text-xs text-amber-200/90">
              Acima do tempo combinado ({durationMinutes} min).
            </p>
          )}
          {canControl ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {mainRunStart === null ? (
                <button
                  type="button"
                  onClick={mainStart}
                  className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-pitch-950 hover:bg-amber-400"
                >
                  Iniciar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={mainPause}
                  className="rounded-xl border border-emerald-600 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-900/50"
                >
                  Pausar
                </button>
              )}
              <button
                type="button"
                onClick={mainReset}
                className="rounded-xl border border-emerald-800 px-4 py-2 text-sm text-emerald-400 hover:bg-emerald-950/80"
              >
                Zerar
              </button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-emerald-500/90">Somente o admin controla o cronômetro.</p>
          )}
        </div>

        <div
          className={`rounded-2xl border p-5 ${
            suspDoneFlash
              ? "border-amber-400/70 bg-amber-950/35"
              : "border-red-900/40 bg-red-950/15"
          }`}
        >
          <h3 className="font-display text-base font-semibold text-amber-200/95">
            Suspensão (1 min)
          </h3>
          <p className="mt-1 text-xs text-emerald-500/90">
            Falta violenta ou impedir gol com a mão — escolha o jogador em campo e use a contagem
            regressiva de 1 minuto.
          </p>
          {canControl && (
            <div className="mt-3">
              <label className="text-xs text-emerald-300/90">Jogador em campo</label>
              <select
                value={suspPlayerId}
                onChange={(e) => setSuspPlayerId(e.target.value)}
                disabled={suspBlockedSelect}
                className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white disabled:opacity-50"
              >
                <option value="">Selecionar</option>
                {playersOnField.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="mt-4 font-mono text-3xl font-bold tabular-nums text-white">
            {suspRemaining > 0 ? formatTimerMmSs(suspRemaining) : "00:00"}
          </p>
          {suspName && suspRemaining > 0 && (
            <p className="mt-1 text-sm text-emerald-200/90">
              <strong className="text-white">{suspName}</strong>
              {suspRunning ? " — em andamento" : " — pausado"}
            </p>
          )}
          {suspDoneFlash && (
            <p className="mt-2 text-sm font-medium text-amber-200">
              Tempo cumprido — {suspName ?? "Jogador"} pode voltar.
            </p>
          )}
          {canControl ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canStartSusp}
                onClick={startSuspension}
                className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-pitch-950 hover:bg-amber-400 disabled:opacity-40"
              >
                Iniciar 1 min
              </button>
              {suspRemaining > 0 && !suspRunning && (
                <button
                  type="button"
                  onClick={resumeSusp}
                  className="rounded-xl border border-emerald-600 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-900/50"
                >
                  Retomar
                </button>
              )}
              {suspRunning && suspRemaining > 0 && (
                <button
                  type="button"
                  onClick={pauseSusp}
                  className="rounded-xl border border-emerald-600 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-900/50"
                >
                  Pausar
                </button>
              )}
              <button
                type="button"
                onClick={resetSusp}
                className="rounded-xl border border-emerald-800 px-4 py-2 text-sm text-emerald-400 hover:bg-emerald-950/80"
              >
                Zerar
              </button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-emerald-500/90">Somente o admin inicia a suspensão.</p>
          )}
        </div>
      </div>
    </section>
  );
}
