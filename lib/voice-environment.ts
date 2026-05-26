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
        "No iPhone: Ajustes → Geral → Teclado → Ativar Ditado. " +
        "Ajustes → Privacidade e Segurança → Reconhecimento de Fala → Safari ligado. " +
        "Use o Safari (não Chrome), recarregue a página e tente de novo."
      );
    }
    return "Serviço de voz indisponível neste navegador. Tente o Safari.";
  }
  if (code === "no-speech") {
    return "Nenhuma fala detectada. Toque em Falar, espere 1 segundo e fale o comando.";
  }
  return `Erro ao ouvir (${code}). Tente novamente.`;
}
