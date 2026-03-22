"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
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

  const list = [...data.agendamentos].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Rachas marcados</h1>
        <p className="mt-1 text-sm text-emerald-100/75">
          Datas combinadas para a pelada. O administrador cadastra novos eventos.
        </p>
      </div>

      {isAdmin && (
        <form
          onSubmit={add}
          className="space-y-3 rounded-2xl border border-emerald-800/60 bg-emerald-950/50 p-6"
        >
          <h2 className="font-display text-base font-semibold text-amber-200">
            Novo agendamento
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-emerald-300/90">Data</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
                required
              />
            </div>
            <div>
              <label className="text-xs text-emerald-300/90">Hora (opcional)</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-emerald-300/90">Título (opcional)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
              placeholder="Ex.: Pelada sábado"
            />
          </div>
          <div>
            <label className="text-xs text-emerald-300/90">Observações</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="text-xs text-emerald-300/90">Campo de jogo</label>
            <select
              value={campo}
              onChange={(e) => setCampo(e.target.value as "" | "1" | "2" | "3")}
              className="mt-1 w-full max-w-xs rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
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
            className="rounded-xl bg-amber-500 px-4 py-2 font-medium text-pitch-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Adicionar"}
          </button>
        </form>
      )}

      {list.length === 0 ? (
        <p className="text-emerald-400/90">Nenhum racha marcado.</p>
      ) : (
        <ul className="divide-y divide-emerald-900/60 rounded-2xl border border-emerald-800/60">
          {list.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-white">
                  {new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  {a.time ? ` · ${a.time}` : ""}
                </p>
                {a.title && <p className="text-sm text-amber-200/90">{a.title}</p>}
                {a.notes && <p className="text-sm text-emerald-300/85">{a.notes}</p>}
                {!isAdmin && a.campo && (
                  <p className="text-sm text-emerald-400/90">Campo {a.campo}</p>
                )}
              </div>
              {isAdmin && (
                <div className="flex flex-col items-stretch gap-2 sm:items-end">
                  <label className="flex flex-col gap-1 text-xs text-emerald-300/90">
                    Campo
                    <select
                      value={a.campo ?? ""}
                      onChange={(e) => void updateCampo(a.id, e.target.value)}
                      className="rounded-lg border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-sm text-white"
                    >
                      <option value="">—</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => remove(a.id)}
                    className="text-sm text-red-400/90 hover:text-red-300"
                  >
                    Excluir
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
