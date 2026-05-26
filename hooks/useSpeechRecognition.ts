"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: {
    results: { length: number; [index: number]: { [index: number]: { transcript: string } } };
  }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export function isLikelyIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

let sharedRecognition: BrowserSpeechRecognition | null = null;

function getSharedRecognition(Ctor: SpeechRecognitionCtor): BrowserSpeechRecognition {
  if (!sharedRecognition) {
    sharedRecognition = new Ctor();
    sharedRecognition.lang = "pt-BR";
    sharedRecognition.interimResults = false;
    sharedRecognition.maxAlternatives = 1;
  }
  return sharedRecognition;
}

async function warmupMicrophone(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
  } catch {
    /* permissão negada será tratada ao iniciar reconhecimento */
  }
}

export function useSpeechRecognition() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const warmedRef = useRef(false);
  const activeRef = useRef(false);

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    setListening(false);
    try {
      sharedRecognition?.stop();
    } catch {
      /* já parado */
    }
  }, []);

  const listen = useCallback(
    (onFinal: (transcript: string) => void) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor) {
        setError(
          "Reconhecimento de voz não disponível neste navegador. No iPhone, use Safari (não Chrome) e permita o microfone."
        );
        return;
      }

      setError(null);

      const run = async () => {
        if (!warmedRef.current) {
          warmedRef.current = true;
          await warmupMicrophone();
          if (isLikelyIOS()) {
            await new Promise((r) => setTimeout(r, 300));
          }
        }

        const recognition = getSharedRecognition(Ctor);
        recognition.continuous = false;
        recognition.interimResults = false;

        activeRef.current = true;
        setListening(true);

        recognition.onresult = (event) => {
          const last = event.results[event.results.length - 1];
          const transcript = last?.[0]?.transcript?.trim() ?? "";
          if (transcript) onFinal(transcript);
        };

        recognition.onerror = (event) => {
          activeRef.current = false;
          setListening(false);
          if (event.error === "aborted" || event.error === "no-speech") {
            if (event.error === "no-speech") {
              setError("Nenhuma fala detectada. Segure o botão e fale de novo.");
            }
            return;
          }
          if (event.error === "not-allowed") {
            setError("Microfone bloqueado. Ative em Ajustes → Safari → Microfone.");
            return;
          }
          setError(`Erro ao ouvir (${event.error}). Tente novamente.`);
        };

        recognition.onend = () => {
          activeRef.current = false;
          setListening(false);
        };

        try {
          recognition.abort();
        } catch {
          /* ignore */
        }

        try {
          recognition.start();
        } catch {
          setListening(false);
          activeRef.current = false;
          setError("Não foi possível iniciar o microfone. Toque de novo.");
        }
      };

      void run();
    },
    []
  );

  return { supported, listening, error, listen, stop, setError };
}
