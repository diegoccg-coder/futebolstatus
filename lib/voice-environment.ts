export function isLikelyIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true
  );
}

export function isWebSpeechAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as typeof window & {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

export function speechErrorMessage(code: string): string {
  if (code === "not-allowed") {
    return "Microfone bloqueado. Ajustes → Safari → Microfone → Permitir para este site.";
  }
  if (code === "service-not-allowed") {
    if (isStandalonePwa()) {
      return (
        "Reconhecimento de voz não funciona no ícone da tela inicial. Abra o site pelo Safari " +
        "(barra de endereço), não pelo atalho instalado."
      );
    }
    if (isLikelyIOS()) {
      return (
        "No iPhone, ative: Ajustes → Geral → Teclado → Ativar Ditado. " +
        "Também: Ajustes → Privacidade e Segurança → Reconhecimento de Fala → Safari ligado. " +
        "Depois recarregue a página no Safari (não use Chrome)."
      );
    }
    return "Serviço de voz indisponível neste navegador. Tente Safari ou configure transcrição no servidor.";
  }
  if (code === "no-speech") {
    return "Nenhuma fala detectada. Toque em Falar, espere 1 segundo e fale o comando.";
  }
  return `Erro ao ouvir (${code}). Tente novamente.`;
}

export function pickAudioMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

export function audioFileExtension(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}
