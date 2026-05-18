"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppData } from "@/lib/useData";

const MAX_IMAGE_SIDE = 1600;
const JPEG_QUALITY = 0.82;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Não foi possível ler o arquivo"));
    r.readAsDataURL(file);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível abrir a imagem"));
    img.src = url;
  });
}

async function imageFileToOptimizedDataUrl(file: File): Promise<string> {
  const raw = await readFileAsDataUrl(file);
  const img = await loadImage(raw);

  const ratio = Math.min(MAX_IMAGE_SIDE / img.width, MAX_IMAGE_SIDE / img.height, 1);
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return raw;
  ctx.drawImage(img, 0, 0, w, h);

  // JPEG reduz bastante o tamanho e evita erro de limite no upload.
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

export default function FotoDoCampeaoPage() {
  const { data: session } = useSession();
  const { data, loading, error, refresh } = useAppData();
  const isAdmin = session?.user?.role === "admin";

  const [selectedId, setSelectedId] = useState("");
  const [teamUrl, setTeamUrl] = useState<string | null>(null);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const agendamentosSorted = useMemo(
    () =>
      data ? [...data.agendamentos].sort((a, b) => b.date.localeCompare(a.date)) : [],
    [data]
  );

  const syncFromData = useCallback(() => {
    if (!data || !selectedId) {
      setTeamUrl(null);
      setPlayerUrl(null);
      return;
    }
    const e = data.championPhotosByAgendamento[selectedId];
    setTeamUrl(e?.bestTeamPhotoUrl ?? null);
    setPlayerUrl(e?.bestPlayerPhotoUrl ?? null);
  }, [data, selectedId]);

  useEffect(() => {
    if (!data) return;
    if (agendamentosSorted.length === 0) {
      setSelectedId("");
      return;
    }
    if (!selectedId || !data.agendamentos.some((a) => a.id === selectedId)) {
      setSelectedId(agendamentosSorted[0]!.id);
    }
  }, [data, agendamentosSorted, selectedId]);

  useEffect(() => {
    syncFromData();
  }, [syncFromData]);

  async function save(partial: {
    bestTeamPhotoUrl?: string | null;
    bestPlayerPhotoUrl?: string | null;
  }) {
    if (!isAdmin || !selectedId) return;
    setSaving(true);
    try {
      const r = await fetch("/api/admin/champion-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agendamentoId: selectedId,
          ...partial,
        }),
      });
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        let msg = "Erro ao salvar";
        try {
          const j = JSON.parse(text) as { error?: string };
          if (j?.error) msg = j.error;
        } catch {
          if (text) msg = text;
        }
        alert(msg);
        return;
      }
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function onPickTeam(file: File | null) {
    if (!file || !isAdmin) return;
    try {
      const url = await imageFileToOptimizedDataUrl(file);
      setTeamUrl(url);
      await save({ bestTeamPhotoUrl: url });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao enviar imagem");
    }
  }

  async function onPickPlayer(file: File | null) {
    if (!file || !isAdmin) return;
    try {
      const url = await imageFileToOptimizedDataUrl(file);
      setPlayerUrl(url);
      await save({ bestPlayerPhotoUrl: url });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao enviar imagem");
    }
  }

  function labelAgenda(id: string) {
    const a = data?.agendamentos.find((x) => x.id === id);
    if (!a) return id;
    const d = new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR");
    const title = a.title?.trim();
    return title ? `${d} — ${title}` : d;
  }

  if (loading) return <p className="text-emerald-200/80">Carregando…</p>;
  if (error || !data) return <p className="text-red-300">{error ?? "Erro"}</p>;

  const entry = selectedId ? data.championPhotosByAgendamento[selectedId] : undefined;
  const updatedLabel = entry?.updatedAt
    ? new Date(entry.updatedAt).toLocaleString("pt-BR")
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Foto do campeão</h1>
        <p className="mt-1 max-w-2xl text-sm text-emerald-100/75">
          Escolha o <strong>racha</strong> (agendamento). O admin pode anexar a foto do{" "}
          <strong>melhor time</strong> e do <strong>melhor jogador</strong> daquele dia. Todos os
          logados podem ver as fotos aqui.
        </p>
      </div>

      {agendamentosSorted.length === 0 ? (
        <p className="text-sm text-emerald-500/90">
          Cadastre rachas em <strong>Rachas</strong> para poder registrar fotos.
        </p>
      ) : (
        <>
          <label className="block max-w-md">
            <span className="text-sm text-emerald-200/90">Racha</span>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
            >
              {agendamentosSorted.map((a) => (
                <option key={a.id} value={a.id}>
                  {labelAgenda(a.id)}
                </option>
              ))}
            </select>
          </label>

          {updatedLabel && (
            <p className="text-xs text-emerald-500/90">Última atualização: {updatedLabel}</p>
          )}

          <div className="grid gap-8 md:grid-cols-2">
            <section className="rounded-2xl border border-emerald-900/50 bg-emerald-950/25 p-5">
              <h2 className="font-display text-lg font-semibold text-amber-200">Melhor time</h2>
              <p className="mt-1 text-xs text-emerald-500/90">Foto do time campeão deste racha.</p>
              {teamUrl ? (
                <div className="mt-4 overflow-hidden rounded-xl border border-emerald-800/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={teamUrl}
                    alt="Melhor time"
                    className="max-h-80 w-full object-contain bg-black/30"
                  />
                </div>
              ) : (
                <p className="mt-4 text-sm text-emerald-500/90">Nenhuma foto ainda.</p>
              )}
              {isAdmin && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-pitch-950 hover:bg-amber-400">
                    {teamUrl ? "Trocar foto" : "Anexar foto"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="sr-only"
                      disabled={saving || !selectedId}
                      onChange={(e) => void onPickTeam(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {teamUrl && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setTeamUrl(null);
                        void save({ bestTeamPhotoUrl: null });
                      }}
                      className="text-sm text-red-400/90 hover:text-red-300 disabled:opacity-50"
                    >
                      Remover
                    </button>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-emerald-900/50 bg-emerald-950/25 p-5">
              <h2 className="font-display text-lg font-semibold text-amber-200">Melhor jogador</h2>
              <p className="mt-1 text-xs text-emerald-500/90">
                Foto do destaque individual deste racha.
              </p>
              {playerUrl ? (
                <div className="mt-4 overflow-hidden rounded-xl border border-emerald-800/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={playerUrl}
                    alt="Melhor jogador"
                    className="max-h-80 w-full object-contain bg-black/30"
                  />
                </div>
              ) : (
                <p className="mt-4 text-sm text-emerald-500/90">Nenhuma foto ainda.</p>
              )}
              {isAdmin && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-pitch-950 hover:bg-amber-400">
                    {playerUrl ? "Trocar foto" : "Anexar foto"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="sr-only"
                      disabled={saving || !selectedId}
                      onChange={(e) => void onPickPlayer(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {playerUrl && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setPlayerUrl(null);
                        void save({ bestPlayerPhotoUrl: null });
                      }}
                      className="text-sm text-red-400/90 hover:text-red-300 disabled:opacity-50"
                    >
                      Remover
                    </button>
                  )}
                </div>
              )}
            </section>
          </div>

          {!isAdmin && (
            <p className="text-xs text-emerald-500/90">
              Somente administradores enviam ou removem fotos.
            </p>
          )}
        </>
      )}
    </div>
  );
}
