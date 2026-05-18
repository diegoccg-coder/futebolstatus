"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Stars } from "@/components/Stars";
import { teamsByRotation } from "@/lib/matchUi";
import {
  buildSerializedSorteioState,
  hydrateDrawSlotsFromStored,
  parseStoredSorteioJson,
  serializeSorteioState,
  sharedWorkspaceToSerialized,
  SORTEIO_STORAGE_KEY,
} from "@/lib/sorteio-persist";
import {
  assignGoalkeepersToGols,
  movePlayerBetweenTeams,
  pushDrawFifo,
  type DrawRunResult,
  type DrawSlotRow,
} from "@/lib/sorteio-helpers";
import { useAppData } from "@/lib/useData";
import type { Player, SorteioSharedWorkspace } from "@/lib/types";

type SorteioMode = "dupla" | "racha";

const EMPTY_SLOTS: Array<DrawRunResult | null> = [
  null,
  null,
  null,
  null,
  null,
];

export default function SorteioPage() {
  const { data: session } = useSession();
  const { data, loading, error, refresh } = useAppData();
  const [agendamentoId, setAgendamentoId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<SorteioMode>("racha");
  const [rachaCount, setRachaCount] = useState<3 | 4>(4);
  const [durationMinutes, setDurationMinutes] = useState(8);
  const [teamNames, setTeamNames] = useState<string[]>([
    "Verde",
    "Amarelo",
    "Preto",
    "Laranja",
  ]);
  const [drawSlots, setDrawSlots] =
    useState<Array<DrawRunResult | null>>(EMPTY_SLOTS);
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [workspaceSaving, setWorkspaceSaving] = useState(false);

  const restoreRan = useRef(false);
  const readyToPersist = useRef(false);
  const lastAppliedRemoteAtRef = useRef("");
  const suppressPersistUntilRef = useRef(0);

  const isAdmin = session?.user?.role === "admin";

  const teamCount = mode === "dupla" ? 2 : rachaCount;

  const playersById = useMemo(() => {
    if (!data) return new Map<string, Player>();
    return new Map(data.players.map((p) => [p.id, p]));
  }, [data]);

  const selectedKey = useMemo(
    () => [...selected].sort().join("\n"),
    [selected]
  );

  const selectedLinhaIds = useMemo(() => {
    if (!data) return [];
    return data.players
      .filter((p) => p.category !== "goleiro" && selected.has(p.id))
      .map((p) => p.id);
  }, [data, selectedKey]);

  const selectedGoleiroIds = useMemo(() => {
    if (!data) return [];
    return data.players
      .filter((p) => p.category === "goleiro" && selected.has(p.id))
      .map((p) => p.id);
  }, [data, selectedKey]);

  /** Jogadores de linha marcados no checkbox, agrupados por estrela (como na página Jogadores). */
  const gruposEstrelaSelecionados = useMemo(() => {
    if (!data) return [];
    const linhaMarcados = data.players.filter(
      (p) => p.category !== "goleiro" && selected.has(p.id)
    );
    return [1, 2, 3, 4, 5].map((n) => ({
      stars: n,
      players: linhaMarcados
        .filter((p) => p.stars === n)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    }));
  }, [data, selectedKey]);

  function applySharedWorkspace(ws: SorteioSharedWorkspace, byId: Map<string, Player>) {
    const serialized = sharedWorkspaceToSerialized(ws);
    setDrawSlots(hydrateDrawSlotsFromStored(serialized, byId));
    setActiveSlotIndex(
      Math.min(4, Math.max(0, Number(serialized.activeSlotIndex) || 0))
    );
    setSelected(new Set(serialized.selectedIds ?? []));
    if (Array.isArray(serialized.teamNames) && serialized.teamNames.length > 0) {
      setTeamNames(serialized.teamNames);
    }
    setMode(serialized.mode === "dupla" ? "dupla" : "racha");
    setRachaCount(serialized.rachaCount === 3 ? 3 : 4);
    if (
      typeof serialized.durationMinutes === "number" &&
      serialized.durationMinutes > 0
    ) {
      setDurationMinutes(Math.min(60, serialized.durationMinutes));
    }
    setAgendamentoId(
      typeof serialized.agendamentoId === "string" ? serialized.agendamentoId : ""
    );
  }

  useEffect(() => {
    if (!data) return;

    const ws = data.sorteioWorkspace;

    if (ws) {
      if (ws.updatedAt !== lastAppliedRemoteAtRef.current) {
        applySharedWorkspace(ws, playersById);
        lastAppliedRemoteAtRef.current = ws.updatedAt;
        suppressPersistUntilRef.current = Date.now() + 1200;
      }
      if (!restoreRan.current) {
        restoreRan.current = true;
        queueMicrotask(() => {
          readyToPersist.current = true;
        });
      }
      return;
    }

    lastAppliedRemoteAtRef.current = "";

    if (!restoreRan.current) {
      restoreRan.current = true;
      if (typeof window !== "undefined") {
        const byId = new Map(data.players.map((p) => [p.id, p]));
        try {
          const raw = localStorage.getItem(SORTEIO_STORAGE_KEY);
          const parsed = parseStoredSorteioJson(raw);
          if (parsed) {
            setDrawSlots(hydrateDrawSlotsFromStored(parsed, byId));
            setActiveSlotIndex(
              Math.min(4, Math.max(0, Number(parsed.activeSlotIndex) || 0))
            );
            setSelected(new Set(parsed.selectedIds ?? []));
            if (Array.isArray(parsed.teamNames) && parsed.teamNames.length > 0) {
              setTeamNames(parsed.teamNames);
            }
            setMode(parsed.mode === "dupla" ? "dupla" : "racha");
            setRachaCount(parsed.rachaCount === 3 ? 3 : 4);
            if (
              typeof parsed.durationMinutes === "number" &&
              parsed.durationMinutes > 0
            ) {
              setDurationMinutes(Math.min(60, parsed.durationMinutes));
            }
            setAgendamentoId(
              typeof parsed.agendamentoId === "string" ? parsed.agendamentoId : ""
            );
          }
        } catch {
          /* ignore */
        }
        suppressPersistUntilRef.current = Date.now() + 1000;
      }
      queueMicrotask(() => {
        readyToPersist.current = true;
      });
    }
  }, [data, data?.sorteioWorkspace, data?.sorteioWorkspace?.updatedAt, playersById]);

  useEffect(() => {
    if (!isAdmin) return;
    const id = setInterval(() => {
      void refresh({ silent: true });
    }, 120_000);
    return () => clearInterval(id);
  }, [isAdmin, refresh]);

  useEffect(() => {
    if (!isAdmin) return;
    if (!readyToPersist.current) return;
    if (Date.now() < suppressPersistUntilRef.current) return;

    const t = setTimeout(() => {
      if (Date.now() < suppressPersistUntilRef.current) return;
      const payload = buildSerializedSorteioState({
        drawSlots,
        activeSlotIndex,
        selected,
        teamNames,
        mode,
        rachaCount,
        durationMinutes,
        agendamentoId,
      });
      setWorkspaceSaving(true);
      void fetch("/api/admin/sorteio-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(async (r) => {
          const j = (await r.json().catch(() => ({}))) as {
            updatedAt?: string;
            error?: string;
          };
          if (!r.ok) {
            console.warn(j.error ?? "Erro ao sincronizar sorteio compartilhado");
            return;
          }
          if (typeof j.updatedAt === "string") {
            lastAppliedRemoteAtRef.current = j.updatedAt;
          }
          await refresh({ silent: true });
        })
        .finally(() => setWorkspaceSaving(false));
    }, 900);

    return () => clearTimeout(t);
  }, [
    isAdmin,
    drawSlots,
    activeSlotIndex,
    selectedKey,
    teamNames,
    mode,
    rachaCount,
    durationMinutes,
    agendamentoId,
    refresh,
  ]);

  useEffect(() => {
    if (!data || !readyToPersist.current) return;
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        SORTEIO_STORAGE_KEY,
        serializeSorteioState({
          drawSlots,
          activeSlotIndex,
          selected,
          teamNames,
          mode,
          rachaCount,
          durationMinutes,
          agendamentoId,
        })
      );
    } catch {
      /* ignore */
    }
  }, [
    data,
    drawSlots,
    activeSlotIndex,
    selected,
    teamNames,
    mode,
    rachaCount,
    durationMinutes,
    agendamentoId,
  ]);

  useEffect(() => {
    if (drawSlots[activeSlotIndex] !== null) return;
    const idx = drawSlots.findIndex((s) => s !== null);
    if (idx >= 0) setActiveSlotIndex(idx);
  }, [drawSlots, activeSlotIndex]);

  useEffect(() => {
    setTeamNames((prev) => {
      const labels =
        teamCount === 2
          ? ["Verde", "Amarelo"]
          : teamCount === 3
            ? ["Verde", "Amarelo", "Preto"]
            : ["Verde", "Amarelo", "Preto", "Laranja"];
      return labels.map((d, i) => prev[i] ?? d);
    });
  }, [teamCount]);

  function setTeamName(i: number, v: string) {
    setTeamNames((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function selectAll() {
    if (!data) return;
    setSelected(new Set(data.players.map((p) => p.id)));
  }

  function clearSel() {
    setSelected(new Set());
  }

  const displayResult = drawSlots[activeSlotIndex];

  async function sortear() {
    if (!data || selectedLinhaIds.length < teamCount) return;
    setBusy(true);
    try {
      const r = await fetch("/api/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerIds: selectedLinhaIds,
          teamCount,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        alert(j.error || "Erro no sorteio");
        return;
      }
      const gols = assignGoalkeepersToGols(selectedGoleiroIds);
      const run: DrawRunResult = {
        teamCount: j.teamCount as number,
        teams: j.teams as DrawSlotRow[],
        golEntradaPlayerId: gols.golEntradaPlayerId,
        golFundoPlayerId: gols.golFundoPlayerId,
      };
      const { slots, filledIndex } = pushDrawFifo(drawSlots, run);
      setDrawSlots(slots);
      setActiveSlotIndex(filledIndex);
    } finally {
      setBusy(false);
    }
  }

  function resortearGoleirosDoSlotAtivo() {
    if (!data) return;
    const gols = assignGoalkeepersToGols(selectedGoleiroIds);
    setDrawSlots((prev) => {
      const cur = prev[activeSlotIndex];
      if (!cur) return prev;
      const next = [...prev];
      next[activeSlotIndex] = {
        ...cur,
        golEntradaPlayerId: gols.golEntradaPlayerId,
        golFundoPlayerId: gols.golFundoPlayerId,
      };
      return next;
    });
  }

  function clearSlot(i: number) {
    setDrawSlots((prev) => {
      const next = [...prev];
      next[i] = null;
      return next;
    });
  }

  async function salvarRascunho() {
    const result = displayResult;
    if (!result) {
      alert("Selecione um sorteio preenchido (1 a 5).");
      return;
    }
    if (!agendamentoId) {
      alert("Selecione o racha para vincular o sorteio.");
      return;
    }
    const byIndex = [...result.teams].sort((a, b) => a.index - b.index);
    const teams = byIndex.map((t) => ({
      name: teamNames[t.index] ?? `Time ${t.index + 1}`,
      playerIds: t.playerIds,
      rotationOrder: t.rotationOrder,
    }));
    const r = await fetch("/api/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agendamentoId,
        format: mode === "dupla" ? "dupla" : "racha",
        teamCount: result.teamCount,
        durationMinutes,
        teams,
        golEntradaPlayerId: result.golEntradaPlayerId,
        golFundoPlayerId: result.golFundoPlayerId,
      }),
    });
    if (!r.ok) {
      const j = await r.json();
      alert(j.error || "Erro ao salvar");
      return;
    }
    await refresh({ silent: true });
    alert("Rascunho salvo. Na página Jogos você pode criar a partida a partir dele.");
  }

  async function limparWorkspaceCompartilhado() {
    if (
      !confirm(
        "Limpar o sorteio compartilhado? Outros admins deixam de ver estes slots no servidor (não apaga rascunhos já vinculados ao racha em Jogos)."
      )
    ) {
      return;
    }
    const r = await fetch("/api/admin/sorteio-workspace", { method: "DELETE" });
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      alert(j.error ?? "Erro ao limpar");
      return;
    }
    lastAppliedRemoteAtRef.current = "";
    suppressPersistUntilRef.current = Date.now() + 1500;
    setDrawSlots([...EMPTY_SLOTS]);
    setSelected(new Set());
    setActiveSlotIndex(0);
    setAgendamentoId("");
    try {
      localStorage.removeItem(SORTEIO_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    await refresh({ silent: true });
  }

  const filaOrdenada = useMemo(() => {
    if (!displayResult) return [];
    const slots = displayResult.teams.map((t) => ({
      ...t,
      label: teamNames[t.index] ?? `Time ${t.index + 1}`,
    }));
    return [...slots].sort((a, b) => a.rotationOrder - b.rotationOrder);
  }, [displayResult, teamNames]);

  if (loading) return <p className="text-emerald-200/80">Carregando…</p>;
  if (error || !data) return <p className="text-red-300">{error ?? "Erro"}</p>;

  const playersLinha = [...data.players]
    .filter((p) => p.category !== "goleiro")
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const playersGol = [...data.players]
    .filter((p) => p.category === "goleiro")
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Sorteio de times</h1>
        <p className="mt-1 text-sm text-emerald-100/75">
          O sorteio dos <strong>times</strong> usa só <strong>jogadores de linha</strong>{" "}
          (estrelas). Os <strong>goleiros</strong> marcados não entram nos times: ao
          sortear, o sistema sorteia quem fica no <strong>Gol 1 (entrada)</strong> e no{" "}
          <strong>Gol 2 (fundo)</strong>. Você pode gerar até <strong>5 sorteios</strong> de
          times e usar <strong>Mover para…</strong> entre times de linha.
        </p>
        <p className="mt-2 text-sm text-amber-200/85">
          <strong>Compartilhado entre admins:</strong> os slots, seleção e racha escolhido
          são salvos no servidor automaticamente — outro administrador pode ver o mesmo
          sorteio e <strong>vincular ao racha</strong> se precisar. A página busca
          atualizações automáticas a cada ~2&nbsp;min (sem recarregar a tela); use o botão
          abaixo para puxar na hora.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void refresh({ silent: true })}
            className="rounded-lg border border-emerald-700 px-3 py-1.5 text-sm text-emerald-200 hover:bg-emerald-900/40"
          >
            Sincronizar agora
          </button>
          {isAdmin && data.sorteioWorkspace && (
            <button
              type="button"
              onClick={() => void limparWorkspaceCompartilhado()}
              className="text-sm text-red-400/90 hover:text-red-300"
            >
              Limpar sorteio compartilhado (servidor)
            </button>
          )}
        </div>
        {data.sorteioWorkspace && (
          <p className="mt-2 text-xs text-emerald-500/90">
            Última sincronização no servidor:{" "}
            {new Date(data.sorteioWorkspace.updatedAt).toLocaleString("pt-BR")}
            {data.sorteioWorkspace.updatedByName
              ? ` · ${data.sorteioWorkspace.updatedByName}`
              : ""}
            {workspaceSaving ? " · Salvando…" : ""}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-emerald-800/60 bg-emerald-950/40 p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <label className="text-sm text-emerald-200/90">Racha (agenda)</label>
            <select
              value={agendamentoId}
              onChange={(e) => setAgendamentoId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
            >
              <option value="">Selecione o racha para vincular o sorteio</option>
              {[...data.agendamentos]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR")}
                    {a.time ? ` às ${a.time}` : ""}
                    {a.title ? ` · ${a.title}` : ""}
                    {a.campo ? ` · Campo ${a.campo}` : ""}
                  </option>
                ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => void salvarRascunho()}
            disabled={!displayResult || !agendamentoId || busy}
            className="shrink-0 rounded-xl bg-amber-500 px-5 py-2.5 font-medium text-pitch-950 hover:bg-amber-400 disabled:opacity-50 disabled:hover:bg-amber-500"
          >
            Vincular sorteio ao racha
          </button>
        </div>
        <p className="text-xs text-emerald-500/90">
          Depois de <strong>Sortear times</strong>, escolha qual das 5 caixas ficou melhor e
          clique em <strong>Vincular sorteio ao racha</strong>.
        </p>
        <p className="text-sm font-medium text-amber-200/95">Formato</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-800/80 px-4 py-3 has-[:checked]:border-amber-500/50 has-[:checked]:bg-amber-950/20">
            <input
              type="radio"
              name="mode"
              checked={mode === "dupla"}
              onChange={() => setMode("dupla")}
              className="text-amber-500"
            />
            <span className="text-sm text-emerald-50">Dois times (jogo único)</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-800/80 px-4 py-3 has-[:checked]:border-amber-500/50 has-[:checked]:bg-amber-950/20">
            <input
              type="radio"
              name="mode"
              checked={mode === "racha"}
              onChange={() => setMode("racha")}
              className="text-amber-500"
            />
            <span className="text-sm text-emerald-50">Racha (rotação no campo)</span>
          </label>
        </div>
        {mode === "racha" && (
          <div className="flex flex-wrap gap-4 pt-2">
            <span className="text-sm text-emerald-200/90">Quantidade de times:</span>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="rachaN"
                checked={rachaCount === 3}
                onChange={() => setRachaCount(3)}
                className="text-amber-500"
              />
              3 times
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="rachaN"
                checked={rachaCount === 4}
                onChange={() => setRachaCount(4)}
                className="text-amber-500"
              />
              4 times
            </label>
          </div>
        )}
        <div>
          <label className="text-sm text-emerald-200/90">Duração de cada partida no campo (min)</label>
          <input
            type="number"
            min={1}
            max={60}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value) || 8)}
            className="mt-1 w-24 rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-emerald-200/90">Até 5 sorteios (compare e escolha um)</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {drawSlots.map((slot, i) => (
            <div key={i} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setActiveSlotIndex(i)}
                className={`rounded-xl border px-2 py-3 text-left text-xs transition ${
                  activeSlotIndex === i
                    ? "border-amber-500/70 bg-amber-950/30"
                    : "border-emerald-800/60 bg-emerald-950/25 hover:border-emerald-700"
                }`}
              >
                <span className="font-semibold text-amber-200/95">#{i + 1}</span>
                {slot ? (
                  <span className="mt-1 block text-[11px] leading-snug text-emerald-200/90">
                    {slot.teams
                      .map(
                        (t) =>
                          `${teamNames[t.index] ?? `T${t.index + 1}`}: ${t.sumStars}★`
                      )
                      .join(" · ")}
                    {(slot.golEntradaPlayerId || slot.golFundoPlayerId) && (
                      <span className="mt-0.5 block text-sky-300/90">
                        G1:{" "}
                        {slot.golEntradaPlayerId
                          ? playersById.get(slot.golEntradaPlayerId)?.name ?? "?"
                          : "—"}{" "}
                        · G2:{" "}
                        {slot.golFundoPlayerId
                          ? playersById.get(slot.golFundoPlayerId)?.name ?? "?"
                          : "—"}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="mt-1 block text-emerald-600">Vazio</span>
                )}
              </button>
              {slot && (
                <button
                  type="button"
                  onClick={() => clearSlot(i)}
                  className="text-[10px] text-red-400/90 hover:text-red-300"
                >
                  Limpar slot
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-emerald-500/80">
          O 6º sorteio substitui o 1º (fila). O slot destacado é o que será vinculado ao racha.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={selectAll}
          className="rounded-lg border border-emerald-700 px-3 py-1.5 text-sm text-emerald-100 hover:bg-emerald-900/50"
        >
          Marcar todos
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={clearSel}
            className="rounded-lg border border-emerald-700 px-3 py-1.5 text-sm text-emerald-100 hover:bg-emerald-900/50"
          >
            Limpar
          </button>
          <span className="text-sm tabular-nums text-emerald-300/90">
            {selected.size} selecionado(s)
          </span>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-amber-200/95">Jogadores de linha</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {playersLinha.map((p) => (
            <li key={p.id}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
                  selected.has(p.id)
                    ? "border-amber-500/50 bg-amber-950/30"
                    : "border-emerald-800/60 bg-emerald-950/30 hover:border-emerald-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                  className="h-4 w-4 rounded border-emerald-600 text-amber-500"
                />
                <span className="flex-1 font-medium text-white">{p.name}</span>
                <Stars value={p.stars} readOnly />
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-4">
        <h3 className="font-display text-lg font-semibold text-amber-200">
          Grupos por estrela (só linha selecionada)
        </h3>
        <p className="text-sm text-emerald-100/75">
          Apenas jogadores de linha com o checkbox marcado. Goleiros não entram nestes grupos.
        </p>
        {selectedLinhaIds.length === 0 ? (
          <p className="text-sm text-emerald-500/85">
            Marque pelo menos um jogador de linha para ver o agrupamento.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {gruposEstrelaSelecionados.map((g) => (
              <div
                key={g.stars}
                className="rounded-2xl border border-emerald-800/60 bg-emerald-950/40 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="font-display text-base font-semibold text-amber-200">
                    {g.stars} estrela{g.stars > 1 ? "s" : ""}
                  </div>
                  <div className="text-xs text-emerald-300/80">{g.players.length}</div>
                </div>
                {g.players.length === 0 ? (
                  <p className="mt-3 text-xs text-emerald-500/80">Nenhum selecionado</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {g.players.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-white/95">{p.name}</span>
                        <Stars value={p.stars} readOnly />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-amber-200/95">Goleiros</h3>
        <p className="mt-1 text-xs text-emerald-500/85">
          Marque os goleiros do dia. Eles <strong>não entram</strong> no balanceamento dos
          times; ao sortear (ou ao usar o botão abaixo da escalação), são sorteados entre{" "}
          <strong>Gol 1 (entrada)</strong> e <strong>Gol 2 (fundo)</strong>.
        </p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {playersGol.map((p) => (
            <li key={p.id}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
                  selected.has(p.id)
                    ? "border-amber-500/50 bg-amber-950/30"
                    : "border-emerald-800/60 bg-emerald-950/30 hover:border-emerald-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                  className="h-4 w-4 rounded border-emerald-600 text-amber-500"
                />
                <span className="flex-1 font-medium text-white">{p.name}</span>
                <span className="text-xs text-emerald-500">GOL</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {data.players.length === 0 && (
        <p className="text-emerald-300/70">Cadastre jogadores primeiro.</p>
      )}

      <div className="space-y-3">
        <p className="text-sm text-emerald-200/90">Nomes dos times (escalação)</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: teamCount }, (_, i) => (
            <div key={i}>
              <label className="text-xs text-emerald-400/90">Time {i + 1}</label>
              <input
                value={teamNames[i] ?? ""}
                onChange={(e) => setTeamName(i, e.target.value)}
                className="mt-1 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-3 py-2 text-white"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={busy || selectedLinhaIds.length < teamCount}
          onClick={() => void sortear()}
          className="rounded-xl bg-amber-500 px-6 py-2.5 font-medium text-pitch-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {busy ? "Sorteando…" : "Sortear times e ordem da fila"}
        </button>
        {selectedLinhaIds.length < teamCount && (
          <p className="text-xs text-amber-200/80">
            Selecione pelo menos {teamCount} jogadores de <strong>linha</strong> (goleiros
            não contam aqui).
          </p>
        )}
      </div>

      {!displayResult && drawSlots.some((s) => s !== null) && (
        <p className="text-sm text-amber-200/85">
          Clique em um dos sorteios (1–5) acima para ver e editar os times.
        </p>
      )}

      {displayResult && (
        <div
          className={`grid gap-6 ${
            displayResult.teamCount <= 2 ? "md:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-2"
          }`}
        >
          {[...displayResult.teams]
            .sort((a, b) => a.index - b.index)
            .map((slot) => (
              <div
                key={slot.index}
                className="rounded-2xl border border-emerald-800/60 bg-emerald-950/40 p-5"
              >
                <h2 className="font-display text-lg font-semibold text-amber-200">
                  {teamNames[slot.index] ?? `Time ${slot.index + 1}`}
                </h2>
                <p className="text-sm text-emerald-300/80">
                  Soma das estrelas: {slot.sumStars} · Posição na fila: {slot.rotationOrder}º
                </p>
                <ul className="mt-3 space-y-2">
                  {slot.players.map((p: Player) => (
                    <li
                      key={p.id}
                      className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span>{p.name}</span>
                      <div className="flex items-center gap-2">
                        <Stars value={p.stars} readOnly />
                        <select
                          className="max-w-[10rem] rounded border border-emerald-800 bg-pitch-950 px-2 py-1 text-xs text-emerald-200"
                          defaultValue=""
                          onChange={(e) => {
                            const to = e.target.value;
                            if (!to || !displayResult) return;
                            const toTeam = Number(to);
                            if (!Number.isFinite(toTeam)) return;
                            const updated = movePlayerBetweenTeams(
                              displayResult.teams,
                              slot.index,
                              toTeam,
                              p.id,
                              playersById
                            );
                            setDrawSlots((prev) => {
                              const next = [...prev];
                              const cur = next[activeSlotIndex];
                              if (!cur) return prev;
                              next[activeSlotIndex] = { ...cur, teams: updated };
                              return next;
                            });
                            e.target.value = "";
                          }}
                        >
                          <option value="">Mover para…</option>
                          {displayResult.teams.map((_, ti) =>
                            ti !== slot.index ? (
                              <option key={ti} value={String(ti)}>
                                {teamNames[ti] ?? `Time ${ti + 1}`}
                              </option>
                            ) : null
                          )}
                        </select>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      )}

      {displayResult && (
        <div className="mt-6 rounded-2xl border border-sky-900/45 bg-sky-950/20 p-5">
          <h3 className="font-display text-base font-semibold text-sky-200">
            Goleiros dos gols
          </h3>
          <p className="mt-1 text-xs text-emerald-500/90">
            Fora da composição dos times. Sorteio aleatório entre os goleiros marcados na
            lista (máx. dois sorteados para entrada e fundo).
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-sky-800/50 bg-pitch-950/40 px-4 py-3">
              <p className="text-xs font-medium text-sky-300/95">Gol 1 (Entrada)</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {displayResult.golEntradaPlayerId
                  ? playersById.get(displayResult.golEntradaPlayerId)?.name ?? "—"
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-sky-800/50 bg-pitch-950/40 px-4 py-3">
              <p className="text-xs font-medium text-sky-300/95">Gol 2 (Fundo)</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {displayResult.golFundoPlayerId
                  ? playersById.get(displayResult.golFundoPlayerId)?.name ?? "—"
                  : "—"}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={selectedGoleiroIds.length === 0 || busy}
            onClick={() => resortearGoleirosDoSlotAtivo()}
            className="mt-4 rounded-lg border border-sky-700/60 px-4 py-2 text-sm text-sky-100 hover:bg-sky-950/50 disabled:opacity-40"
          >
            Sortear de novo Gol 1 e Gol 2
          </button>
        </div>
      )}

      {displayResult && mode === "racha" && filaOrdenada.length > 0 && (
        <div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 p-5">
          <h2 className="font-display text-lg font-semibold text-amber-200">
            Ordem da fila (sorteada)
          </h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-emerald-100/90">
            {filaOrdenada.map((slot) => (
              <li key={slot.index}>
                <strong>{slot.label}</strong> — soma das estrelas: {slot.sumStars}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-emerald-200/85 leading-relaxed">
            <strong>Como funciona o racha:</strong> os <strong>dois primeiros</strong> desta
            fila começam em campo. A cada partida de ~{durationMinutes} min,{" "}
            <strong>quem ganha fica</strong>; <strong>quem perde sai</strong> e entra o{" "}
            <strong>próximo time da fila</strong> (na ordem acima, depois do 2º vem o 3º, e
            assim por diante, voltando ao início quando necessário).
          </p>
        </div>
      )}

      {displayResult && (
        <button
          type="button"
          onClick={() => void salvarRascunho()}
          disabled={!agendamentoId || busy}
          className="rounded-xl bg-amber-500 px-6 py-2.5 font-medium text-pitch-950 hover:bg-amber-400 disabled:opacity-50"
        >
          Vincular sorteio ao racha (confirmar)
        </button>
      )}

      {data.lastDraft && (
        <p className="text-sm text-emerald-400/80">
          Último sorteio salvo:{" "}
          {new Date(data.lastDraft.createdAt).toLocaleString("pt-BR")} —{" "}
          {data.lastDraft.teamCount} times
          {data.lastDraft.format === "racha" ? " (racha)" : ""}, partidas de{" "}
          {data.lastDraft.durationMinutes} min. Times:{" "}
          {teamsByRotation(data.lastDraft.teams)
            .map((t) => t.name)
            .join(" → ")}
          {data.lastDraft.format === "racha" && " (ordem da fila)"}.
          {(typeof data.lastDraft.golEntradaPlayerId === "string" ||
            typeof data.lastDraft.golFundoPlayerId === "string") && (
            <>
              {" "}
              Gols: entrada{" "}
              {data.lastDraft.golEntradaPlayerId
                ? playersById.get(data.lastDraft.golEntradaPlayerId)?.name ?? "—"
                : "—"}{" "}
              · fundo{" "}
              {data.lastDraft.golFundoPlayerId
                ? playersById.get(data.lastDraft.golFundoPlayerId)?.name ?? "—"
                : "—"}
              .
            </>
          )}
          {data.lastDraft.agendamentoId
            ? " (vinculado a um racha — também na página Jogos)."
            : ""}
        </p>
      )}
    </div>
  );
}
