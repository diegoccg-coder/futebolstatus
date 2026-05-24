import type { Agendamento } from "./types";

/** Último racha cadastrado na agenda (mais recente por `createdAt`). */
export function getLatestAgendamento(
  agendamentos: Agendamento[]
): Agendamento | null {
  if (agendamentos.length === 0) return null;
  return [...agendamentos].sort((a, b) => {
    const ca = a.createdAt ?? "";
    const cb = b.createdAt ?? "";
    if (ca && cb && ca !== cb) return cb.localeCompare(ca);
    const d = b.date.localeCompare(a.date);
    if (d !== 0) return d;
    return b.id.localeCompare(a.id);
  })[0]!;
}

export function formatAgendamentoLabel(a: Agendamento): string {
  const date = new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR");
  const t = a.time ? ` · ${a.time}` : "";
  const title = a.title ? ` · ${a.title}` : "";
  const campo = a.campo ? ` · Campo ${a.campo}` : "";
  return `${date}${t}${title}${campo}`;
}
