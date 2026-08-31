"use client";

import Link from "next/link";
import { matchHeadline, matchWinnerDisplayName } from "@/lib/matchUi";
import type { Match } from "@/lib/types";

type Props = {
  matches: Match[];
  reorderable?: boolean;
  onMove?: (matchId: string, direction: "up" | "down") => void;
  onMakeFirst?: (matchId: string) => void;
  onDelete?: (matchId: string) => void;
  onEdit?: (match: Match) => void;
  editingId?: string | null;
  emptyMessage?: string;
};

export function JogosRachaList({
  matches,
  reorderable = false,
  onMove,
  onMakeFirst,
  onDelete,
  onEdit,
  editingId,
  emptyMessage = "Nenhum jogo neste racha.",
}: Props) {
  if (matches.length === 0) {
    return <p className="text-sm text-emerald-500/90">{emptyMessage}</p>;
  }

  return (
    <ul className="divide-y divide-emerald-900/80 rounded-lg border border-emerald-800/60">
      {matches.map((m, idx) => {
        const isEditing = editingId === m.id;
        return (
        <li
          key={m.id}
          className={isEditing ? "bg-amber-950/30 ring-1 ring-inset ring-amber-700/50" : undefined}
        >
          <div className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 gap-2">
              <span
                className="inline-flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded bg-emerald-900/50 px-1 font-mono text-xs font-semibold tabular-nums text-amber-200/95"
                title="Ordem no racha"
              >
                {idx + 1}
              </span>
              {onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(m)}
                  className="min-w-0 flex-1 text-left transition hover:text-amber-100"
                >
                  <span className="block text-sm font-medium text-white">
                    {matchHeadline(m)}
                    {isEditing && (
                      <span className="ml-2 text-[10px] font-normal text-amber-300">(editando)</span>
                    )}
                  </span>
                  <span className="block text-xs text-emerald-300/90">
                    {new Date(m.date + "T12:00:00").toLocaleDateString("pt-BR")}
                    {m.weekLabel ? ` · ${m.weekLabel}` : ""}
                    {m.teamCount > 2 ? ` · Racha (${m.teamCount})` : ""}
                    {` · ${m.durationMinutes} min`}
                    {m.drawResult
                      ? " · Empate"
                      : matchWinnerDisplayName(m)
                        ? ` · ${matchWinnerDisplayName(m)}`
                        : ""}
                  </span>
                </button>
              ) : (
              <Link
                href={`/jogos/${m.id}`}
                className="min-w-0 flex-1 transition hover:text-amber-100"
              >
                <span className="block text-sm font-medium text-white">{matchHeadline(m)}</span>
                <span className="block text-xs text-emerald-300/90">
                  {new Date(m.date + "T12:00:00").toLocaleDateString("pt-BR")}
                  {m.weekLabel ? ` · ${m.weekLabel}` : ""}
                  {m.teamCount > 2 ? ` · Racha (${m.teamCount})` : ""}
                  {` · ${m.durationMinutes} min`}
                  {m.drawResult
                    ? " · Empate"
                    : matchWinnerDisplayName(m)
                      ? ` · ${matchWinnerDisplayName(m)}`
                      : ""}
                </span>
              </Link>
              )}
            </div>
            {(reorderable || onDelete || onEdit) && (
              <div className="flex shrink-0 flex-wrap items-center gap-2 self-start">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(m)}
                    className="text-xs text-amber-300/95 hover:text-amber-200"
                  >
                    Editar
                  </button>
                )}
                {reorderable && onMove && (
                  <>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => onMove(m.id, "up")}
                      className="rounded border border-emerald-800 px-1.5 py-0.5 text-xs text-emerald-200 hover:bg-emerald-900/40 disabled:opacity-30"
                      title="Subir na ordem"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={idx === matches.length - 1}
                      onClick={() => onMove(m.id, "down")}
                      className="rounded border border-emerald-800 px-1.5 py-0.5 text-xs text-emerald-200 hover:bg-emerald-900/40 disabled:opacity-30"
                      title="Descer na ordem"
                    >
                      ↓
                    </button>
                  </>
                )}
                {reorderable && onMakeFirst && idx > 0 && (
                  <button
                    type="button"
                    onClick={() => onMakeFirst(m.id)}
                    className="text-xs text-amber-300/95 hover:text-amber-200"
                  >
                    1º
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(m.id)}
                    className="text-xs text-red-400/90 hover:text-red-300"
                  >
                    Excluir
                  </button>
                )}
              </div>
            )}
          </div>
        </li>
        );
      })}
    </ul>
  );
}
