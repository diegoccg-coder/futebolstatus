"use client";

import {
  commandSummary,
  parseVoiceCommand,
  type VoiceCommand,
} from "@/lib/voice-commands";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import type { Player } from "@/lib/types";
import { useCallback, useState } from "react";

type PendingConfirm =
  | { heard: string; command: VoiceCommand }
  | { heard: string; error: string };

type Props = {
  goalPlayers: Player[];
  yellowPlayers: Player[];
  teamNameA: string;
  teamNameB: string;
  onConfirmGoal: (playerId: string) => Promise<boolean>;
  onConfirmYellow: (playerId: string) => Promise<boolean>;
  onConfirmScore: (scoreA: number, scoreB: number) => Promise<boolean>;
};

export function MatchVoiceInput({
  goalPlayers,
  yellowPlayers,
  teamNameA,
  teamNameB,
  onConfirmGoal,
  onConfirmYellow,
  onConfirmScore,
}: Props) {
  const { supported, listening, error, listen, stop, setError } = useSpeechRecognition();
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [applying, setApplying] = useState(false);

  const handleTranscript = useCallback(
    (transcript: string) => {
      const result = parseVoiceCommand(transcript, {
        goalPlayers,
        yellowPlayers,
        teamNameA,
        teamNameB,
      });
      if (result.ok) {
        setPending({ heard: result.heard, command: result.command });
      } else {
        setPending({ heard: result.heard, error: result.error });
      }
    },
    [goalPlayers, yellowPlayers, teamNameA, teamNameB]
  );

  function startListening() {
    setPending(null);
    setError(null);
    listen(handleTranscript);
  }

  async function confirm() {
    if (!pending || "error" in pending) return;
    setApplying(true);
    try {
      let ok = false;
      const cmd = pending.command;
      if (cmd.kind === "goal") ok = await onConfirmGoal(cmd.player.id);
      else if (cmd.kind === "yellow") ok = await onConfirmYellow(cmd.player.id);
      else if (cmd.kind === "score") {
        ok = await onConfirmScore(cmd.scoreFieldA, cmd.scoreFieldB);
      }
      if (ok) setPending(null);
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className="rounded-lg border border-sky-900/50 bg-sky-950/25 p-3 space-y-2">
      <h2 className="text-sm font-semibold text-sky-200">Comando por voz</h2>
      <p className="text-[10px] text-emerald-100/75 leading-relaxed">
        Exemplos: <span className="text-sky-200/90">&quot;gol João&quot;</span>,{" "}
        <span className="text-sky-200/90">&quot;amarelo Pedro&quot;</span>,{" "}
        <span className="text-sky-200/90">&quot;placar {teamNameA || "azul"} 2 {teamNameB || "preto"} 1&quot;</span>
        . Confirme antes de aplicar.
      </p>

      {!supported && (
        <p className="text-xs text-amber-200/90">
          Voz indisponível neste navegador. No iPhone use <strong>Safari</strong> (não Chrome) e
          permita microfone para este site.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!supported || applying}
          onClick={() => (listening ? stop() : startListening())}
          className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
            listening
              ? "bg-red-600/90 text-white animate-pulse"
              : "bg-sky-600 text-white hover:bg-sky-500"
          } disabled:opacity-50`}
        >
          {listening ? "Parar de ouvir" : "Falar comando"}
        </button>
        {pending && (
          <button
            type="button"
            disabled={applying}
            onClick={() => setPending(null)}
            className="rounded-lg border border-emerald-700 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-900/40 disabled:opacity-50"
          >
            Cancelar
          </button>
        )}
      </div>

      {listening && (
        <p className="text-xs text-sky-200/95">
          Ouvindo… Fale agora. No iPhone, aguarde 1 segundo após tocar antes de falar.
        </p>
      )}

      {error && <p className="text-xs text-red-300/95">{error}</p>}

      {pending && (
        <div
          className={`rounded-lg border p-3 space-y-2 ${
            "error" in pending
              ? "border-amber-800/60 bg-amber-950/30"
              : "border-emerald-700/50 bg-emerald-950/40"
          }`}
        >
          <p className="text-[10px] uppercase tracking-wide text-emerald-400/80">Ouvi</p>
          <p className="text-sm text-white">&quot;{pending.heard}&quot;</p>
          {"error" in pending ? (
            <p className="text-xs text-amber-200/95">{pending.error}</p>
          ) : (
            <>
              <p className="text-[10px] uppercase tracking-wide text-emerald-400/80">
                Confirmar
              </p>
              <p className="text-sm font-semibold text-amber-100">
                {commandSummary(pending.command)}
              </p>
              <button
                type="button"
                disabled={applying}
                onClick={() => void confirm()}
                className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-medium text-pitch-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {applying ? "Aplicando…" : "Confirmar e aplicar"}
              </button>
            </>
          )}
          {"error" in pending && (
            <button
              type="button"
              onClick={startListening}
              className="w-full rounded-lg border border-sky-700 py-2 text-xs text-sky-200 hover:bg-sky-950/50"
            >
              Tentar de novo
            </button>
          )}
        </div>
      )}
    </section>
  );
}
