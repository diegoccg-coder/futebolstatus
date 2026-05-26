"use client";

import {
  audioFileExtension,
  isLikelyIOS,
  isStandalonePwa,
  isWebSpeechAvailable,
  pickAudioMimeType,
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

export type VoiceCaptureMode = "recorder" | "webspeech" | "none";

export function useVoiceCapture() {
  const [mode, setMode] = useState<VoiceCaptureMode>("none");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverTranscribe, setServerTranscribe] = useState(false);

  const activeRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFinalRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/transcribe")
      .then((r) => (r.ok ? r.json() : { available: false }))
      .then((j: { available?: boolean }) => {
        if (cancelled) return;
        const available = Boolean(j.available);
        setServerTranscribe(available);
        if (available && (isLikelyIOS() || isStandalonePwa())) {
          setMode("recorder");
        } else if (isWebSpeechAvailable()) {
          setMode("webspeech");
        } else if (available) {
          setMode("recorder");
        } else {
          setMode("none");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setMode(isWebSpeechAvailable() ? "webspeech" : "none");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cleanupStream = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    setListening(false);
    try {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
    } catch {
      /* ignore */
    }
  }, []);

  const transcribeBlob = useCallback(async (blob: Blob, mime: string): Promise<string> => {
    const fd = new FormData();
    const ext = audioFileExtension(mime);
    fd.append("audio", blob, `comando.${ext}`);
    fd.append("filename", `comando.${ext}`);
    const r = await fetch("/api/transcribe", { method: "POST", body: fd });
    const j = (await r.json().catch(() => ({}))) as { text?: string; error?: string };
    if (!r.ok) {
      throw new Error(j.error ?? "Falha na transcrição.");
    }
    return j.text?.trim() ?? "";
  }, []);

  const listenWithRecorder = useCallback(
    async (onFinal: (text: string) => void) => {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        setError("Gravação de áudio indisponível neste navegador.");
        return;
      }

      setError(null);
      activeRef.current = true;
      setListening(true);
      onFinalRef.current = onFinal;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        activeRef.current = false;
        setListening(false);
        setError("Microfone bloqueado. Permita o acesso ao microfone para este site.");
        return;
      }

      streamRef.current = stream;
      const mime = pickAudioMimeType();
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        cleanupStream();
        activeRef.current = false;
        setListening(false);
        const blob = new Blob(chunks, { type: mime || recorder.mimeType || "audio/mp4" });
        void transcribeBlob(blob, blob.type)
          .then((text) => {
            if (text) onFinalRef.current?.(text);
            else setError("Nenhuma fala reconhecida. Tente falar mais alto e mais perto.");
          })
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : "Erro na transcrição.");
          });
      };

      recorder.onerror = () => {
        cleanupStream();
        activeRef.current = false;
        setListening(false);
        setError("Erro ao gravar áudio.");
      };

      recorder.start();
      stopTimerRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 6500);
    },
    [cleanupStream, transcribeBlob]
  );

  const listenWithWebSpeech = useCallback(
    (onFinal: (text: string) => void, onServiceBlocked?: () => void) => {
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
        if (event.error === "service-not-allowed" && onServiceBlocked) {
          onServiceBlocked();
          return;
        }
        setError(speechErrorMessage(event.error));
      };

      recognition.onend = () => {
        activeRef.current = false;
        setListening(false);
      };

      void navigator.mediaDevices
        ?.getUserMedia({ audio: true })
        .then((stream) => {
          stream.getTracks().forEach((t) => t.stop());
          if (isLikelyIOS()) {
            return new Promise<void>((r) => setTimeout(r, 400));
          }
        })
        .catch(() => {
          activeRef.current = false;
          setListening(false);
          setError("Microfone bloqueado. Permita o acesso ao microfone para este site.");
        })
        .then(() => {
          if (!activeRef.current) return;
          try {
            recognition.start();
          } catch {
            activeRef.current = false;
            setListening(false);
            setError("Não foi possível iniciar o microfone. Toque de novo.");
          }
        });
    },
    []
  );

  const listen = useCallback(
    (onFinal: (text: string) => void) => {
      if (mode === "recorder") {
        void listenWithRecorder(onFinal);
        return;
      }
      if (mode === "webspeech") {
        listenWithWebSpeech(onFinal, () => {
          if (serverTranscribe) {
            setMode("recorder");
            setError(null);
            void listenWithRecorder(onFinal);
          } else {
            setError(speechErrorMessage("service-not-allowed"));
          }
        });
        return;
      }
      setError(
        isLikelyIOS()
          ? speechErrorMessage("service-not-allowed")
          : "Comando por voz indisponível neste dispositivo."
      );
    },
    [listenWithRecorder, listenWithWebSpeech, mode, serverTranscribe]
  );

  useEffect(() => () => cleanupStream(), [cleanupStream]);

  const supported = mode !== "none";

  return {
    supported,
    listening,
    error,
    mode,
    serverTranscribe,
    listen,
    stop,
    setError,
  };
}
