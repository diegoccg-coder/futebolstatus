"use client";

import {
  isLikelyIOS,
  isStandalonePwa,
  isWebSpeechAvailable,
  speechErrorMessage,
} from "@/lib/voice-environment";
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

export function useVoiceCapture() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    setSupported(isWebSpeechAvailable() && !isStandalonePwa());
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    setListening(false);
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const listen = useCallback((onFinal: (text: string) => void) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError(
        "Reconhecimento de voz indisponível. No iPhone use Safari e ative Ditado em Ajustes → Teclado."
      );
      return;
    }

    if (isStandalonePwa()) {
      setError(speechErrorMessage("service-not-allowed"));
      return;
    }

    setError(null);
    activeRef.current = true;
    setListening(true);

    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const transcript = last?.[0]?.transcript?.trim() ?? "";
      if (transcript) onFinal(transcript);
    };

    recognition.onerror = (event) => {
      activeRef.current = false;
      setListening(false);
      if (event.error === "aborted") return;
      setError(speechErrorMessage(event.error));
    };

    recognition.onend = () => {
      activeRef.current = false;
      setListening(false);
      recognitionRef.current = null;
    };

    const startRecognition = () => {
      if (!activeRef.current) return;
      try {
        recognition.start();
      } catch {
        activeRef.current = false;
        setListening(false);
        setError("Não foi possível iniciar o microfone. Toque de novo.");
      }
    };

    void navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        if (isLikelyIOS()) {
          return new Promise<void>((r) => setTimeout(r, 500));
        }
      })
      .catch(() => {
        activeRef.current = false;
        setListening(false);
        setError("Microfone bloqueado. Permita o acesso ao microfone para este site.");
      })
      .then(startRecognition);
  }, []);

  return { supported, listening, error, listen, stop, setError };
}
