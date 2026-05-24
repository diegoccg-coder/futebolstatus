"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { formatAgendamentoLabel } from "@/lib/agendamentos-ui";
import { useAppData } from "@/lib/useData";

export default function AgendaPage() {
  const { data: session } = useSession();
  const { data, loading, error, refresh } = useAppData();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [campo, setCampo] = useState<"" | "1" | "2" | "3">("");
  const [saving, setSaving] = useState(false);
  const isAdmin = session?.user?.role === "admin";

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    try {
      const r = await fetch("/api/agendamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          time: time || undefined,
          title,
          notes,
          campo: campo === "" ? undefined : Number(campo),
        }),
      });
      if (!r.ok) {
        const j = await r.json();
        alert(j.error || "Erro");
        return;
      }
      setTitle("");
      setNotes("");
      setCampo("");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!isAdmin || !confirm("Remover este agendamento?")) return;
    await fetch(`/api/agendamentos/${id}`, { method: "DELETE" });
    await refresh();
  }

  async function updateCampo(id: string, value: string) {
    if (!isAdmin) return;
    const r = await fetch(`/api/agendamentos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campo: value === "" ? null : Number(value),
      }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert(j.error || "Erro ao atualizar campo");
      return;
    }
    await refresh();
  }

  if (loading) return <p className="text-emerald-200/80">Carregando…</p>;
  if (error || !data) return <p className="text-red-300">{error ?? "Erro"}</p>;

  const list = [...data.agendamentos].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-bold text-white">Rachas marcados</h1>

      {isAdmin && (
        <section className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-3 space-y-2">
          <h2 className="text-sm font-semibold text-amber-200">1. Novo racha</h2>
          <form onSubmit={add} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-emerald-300/90">Data</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-0.5 w-full rounded border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-sm text-white"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] text-emerald-300/90">Hora</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="mt-0.5 w-full rounded border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-sm text-white"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-emerald-300/90">Título</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-0.5 w-full rounded border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-sm text-white"
                placeholder="Ex.: Sábado manhã"
              />
            </div>
            <div>
              <label className="text-[10px] text-emerald-300/90">Observações</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-0.5 w-full rounded border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-[10px] text-emerald-300/90">Campo</label>
              <select
                value={campo}
                onChange={(e) => setCampo(e.target.value as "" | "1" | "2" | "3")}
                className="mt-0.5 w-full rounded border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-sm text-white"
              >
                <option value="">Não definido</option>
                <option value="1">Campo 1</option>
                <option value="2">Campo 2</option>
                <option value="3">Campo 3</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-pitch-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {saving ? "Salvando…" : "Adicionar"}
            </button>
          </form>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-amber-200">{isAdmin ? "2. " : "1. "}Lista</h2>
        {list.length === 0 ? (
          <p className="mt-1 text-xs text-emerald-400/90">Nenhum racha marcado.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {list.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-2 py-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">{formatAgendamentoLabel(a)}</p>
                    {a.notes && (
                      <p className="mt-0.5 truncate text-[11px] text-emerald-300/85">{a.notes}</p>
                    )}
                    {!isAdmin && a.campo && (
                      <p className="text-[10px] text-emerald-400/90">Campo {a.campo}</p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex shrink-0 items-center gap-2">
                      <select
                        value={a.campo ?? ""}
                        onChange={(e) => void updateCampo(a.id, e.target.value)}
                        className="rounded border border-emerald-800 bg-pitch-950 px-1.5 py-1 text-xs text-white"
                        aria-label="Campo"
                      >
                        <option value="">Campo</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => remove(a.id)}
                        className="text-[10px] text-red-400/90 hover:text-red-300"
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
