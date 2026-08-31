"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Stars } from "@/components/Stars";
import { teamsByRotation } from "@/lib/matchUi";
import {
  buildSerializedSorteioState,
  defaultTeamNamesForCount,
  emptyTeamNamesBySlot,
  hydrateDrawSlotsFromStored,
  parseStoredSorteioJson,
  resolveTeamNamesBySlot,
  serializeSorteioState,
  sharedWorkspaceToSerialized,
  SORTEIO_SLOT_COUNT,
  SORTEIO_STORAGE_KEY,
  teamCountFromSorteioMode,
} from "@/lib/sorteio-persist";
import {
  assignGoalkeepersToGols,
  movePlayerBetweenTeams,
  pushDrawFifo,
  refreshDrawSlotsFromPlayers,
  type DrawRunResult,
  type DrawSlotRow,
} from "@/lib/sorteio-helpers";
import { formatAgendamentoLabel, getLatestAgendamento } from "@/lib/agendamentos-ui";
import {
  DEFAULT_TEAM_NAMING_STARS,
  defaultTeamNamesForDraw,
  migrateLegacyColorNamesBySlot,
  teamNamesFromStarGroup,
} from "@/lib/team-names";
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
  const { data, loading, error, refresh, patchPlayer } = useAppData();
  const [agendamentoId, setAgendamentoId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<SorteioMode>("racha");
  const [rachaCount, setRachaCount] = useState<3 | 4>(4);
  const [durationMinutes, setDurationMinutes] = useState(8);
  const [teamNamesBySlot, setTeamNamesBySlot] = useState<string[][]>(() =>
    emptyTeamNamesBySlot(4)
  );
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

  const teamNames = useMemo(
    () => teamNamesBySlot[activeSlotIndex] ?? defaultTeamNamesForCount(teamCount),
    [teamNamesBySlot, activeSlotIndex, teamCount]
  );

  function linhaPlayersFromIds(ids: string[]): Player[] {
    if (!data) return [];
    const set = new Set(ids);
    return data.players.filter(
      (p) => p.category !== "goleiro" && set.has(p.id)
    );
  }

  function selectedLinhaPlayers(): Player[] {
    return linhaPlayersFromIds([...selected]);
  }

  function applyTeamNamesFromSerialized(
    serialized: {
      teamNamesBySlot?: string[][];
      teamNames?: string[];
      mode: "dupla" | "racha";
      rachaCount: 3 | 4;
      selectedIds?: string[];
    },
    slots: Array<DrawRunResult | null>
  ) {
    const tc = teamCountFromSorteioMode(serialized.mode, serialized.rachaCount);
    const linha = linhaPlayersFromIds(serialized.selectedIds ?? [...selected]);
    const resolved = resolveTeamNamesBySlot(
      serialized.teamNamesBySlot,
      serialized.teamNames,
      tc
    );
    setTeamNamesBySlot(
      migrateLegacyColorNamesBySlot(resolved, slots, linha, tc)
    );
  }

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

  useEffect(() => {
    if (!data) return;
    setDrawSlots((prev) => refreshDrawSlotsFromPlayers(prev, playersById));
  }, [data, playersById]);

  function applySharedWorkspace(ws: SorteioSharedWorkspace, byId: Map<string, Player>) {
    const serialized = sharedWorkspaceToSerialized(ws);
    const slots = hydrateDrawSlotsFromStored(serialized, byId);
    setDrawSlots(slots);
    setActiveSlotIndex(
      Math.min(4, Math.max(0, Number(serialized.activeSlotIndex) || 0))
    );
    setSelected(new Set(serialized.selectedIds ?? []));
    applyTeamNamesFromSerialized(serialized, slots);
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
            const slots = hydrateDrawSlotsFromStored(parsed, byId);
            setDrawSlots(slots);
            setActiveSlotIndex(
              Math.min(4, Math.max(0, Number(parsed.activeSlotIndex) || 0))
            );
            setSelected(new Set(parsed.selectedIds ?? []));
            applyTeamNamesFromSerialized(parsed, slots);
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
        teamNamesBySlot,
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
    teamNamesBySlot,
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
          teamNamesBySlot,
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
    teamNamesBySlot,
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
    if (!data) return;
    const linha = selectedLinhaPlayers();
    setTeamNamesBySlot((prev) => {
      return Array.from({ length: SORTEIO_SLOT_COUNT }, (_, slotIdx) => {
        const slot = drawSlots[slotIdx];
        if (slot) {
          return defaultTeamNamesForDraw(slot.teams, linha, teamCount);
        }
        return defaultTeamNamesForCount(teamCount);
      });
    });
  }, [teamCount]);

  function setTeamName(i: number, v: string) {
    setTeamNamesBySlot((prev) => {
      const next = prev.map((row) => [...row]);
      const slot = [...(next[activeSlotIndex] ?? defaultTeamNamesForCount(teamCount))];
      slot[i] = v;
      next[activeSlotIndex] = slot;
      return next;
    });
  }

  function aplicarNomesDoGrupo(stars: number) {
    if (!data) return;
    const result = drawSlots[activeSlotIndex];
    if (!result) {
      alert("Faça o sorteio dos times antes de aplicar os nomes pelo grupo.");
      return;
    }
    const linhaMarcados = data.players.filter(
      (p) => p.category !== "goleiro" && selected.has(p.id)
    );
    const names = teamNamesFromStarGroup(
      result.teams,
      linhaMarcados,
      stars,
      teamCount
    );
    setTeamNamesBySlot((prev) => {
      const next = prev.map((row) => [...row]);
      next[activeSlotIndex] = names;
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

  async function updateStars(p: Player, n: number) {
    if (!isAdmin || n === p.stars) return;
    const prevStars = p.stars;
    suppressPersistUntilRef.current = Date.now() + 2000;
    patchPlayer({ ...p, stars: n });
    try {
      const r = await fetch(`/api/players/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stars: n }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        patchPlayer({ ...p, stars: prevStars });
        alert(j.error || "Erro ao atualizar estrelas");
        return;
      }
      const updated = (await r.json()) as Player;
      patchPlayer(updated);
    } catch {
      patchPlayer({ ...p, stars: prevStars });
      alert("Erro ao atualizar estrelas");
    }
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
      const linha = data.players.filter(
        (p) => p.category !== "goleiro" && selected.has(p.id)
      );
      setTeamNamesBySlot((prev) => {
        const next = prev.map((row) => [...row]);
        next[filledIndex] = defaultTeamNamesForDraw(run.teams, linha, teamCount);
        return next;
      });
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
    setTeamNamesBySlot((prev) => {
      const next = prev.map((row) => [...row]);
      next[i] = defaultTeamNamesForCount(teamCount);
      return next;
    });
  }

  function clearAllSlots() {
    if (!confirm("Limpar todos os 5 slots?")) return;
    setDrawSlots([...EMPTY_SLOTS]);
    setTeamNamesBySlot(emptyTeamNamesBySlot(teamCount));
    setActiveSlotIndex(0);
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
    const slotTeamNames =
      teamNamesBySlot[activeSlotIndex] ?? defaultTeamNamesForCount(teamCount);
    const teams = byIndex.map((t) => ({
      name: slotTeamNames[t.index] ?? `Time ${t.index + 1}`,
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
    setTeamNamesBySlot(emptyTeamNamesBySlot(teamCount));
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

  const latestRacha = useMemo(
    () => (data ? getLatestAgendamento(data.agendamentos) : null),
    [data]
  );

  useEffect(() => {
    if (!data || agendamentoId || !latestRacha) return;
    if (data.sorteioWorkspace?.agendamentoId) return;
    setAgendamentoId(latestRacha.id);
  }, [data, agendamentoId, latestRacha]);

  if (loading) return <p className="text-emerald-200/80">Carregando…</p>;
  if (error || !data) return <p className="text-red-300">{error ?? "Erro"}</p>;

  const playersLinha = [...data.players]
    .filter((p) => p.category !== "goleiro")
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const playersGol = [...data.players]
    .filter((p) => p.category === "goleiro")
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-xl font-bold text-white">Sorteio de times</h1>
        <button
          type="button"
          onClick={() => void refresh({ silent: true })}
          className="rounded border border-emerald-700 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-900/40"
        >
          Sincronizar
        </button>
      </div>

      {isAdmin && data.sorteioWorkspace && (
        <button
          type="button"
          onClick={() => void limparWorkspaceCompartilhado()}
          className="text-xs text-red-400/90 hover:text-red-300"
        >
          Limpar sorteio compartilhado
        </button>
      )}
      {data.sorteioWorkspace && (
        <p className="text-xs text-emerald-500/90">
          Servidor: {new Date(data.sorteioWorkspace.updatedAt).toLocaleString("pt-BR")}
          {data.sorteioWorkspace.updatedByName ? ` · ${data.sorteioWorkspace.updatedByName}` : ""}
          {workspaceSaving ? " · Salvando…" : ""}
        </p>
      )}

      {/* 1. Racha */}
      <section className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-3 space-y-2">
        <h2 className="text-sm font-semibold text-amber-200">1. Racha</h2>
        <select
          value={agendamentoId}
          onChange={(e) => setAgendamentoId(e.target.value)}
          className="w-full rounded-lg border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-sm text-white"
        >
          <option value="">Selecione o racha</option>
          {[...data.agendamentos]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((a) => (
              <option key={a.id} value={a.id}>
                {formatAgendamentoLabel(a)}
              </option>
            ))}
        </select>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-emerald-200/90">
          <label className="flex items-center gap-1">
            <input type="radio" name="mode" checked={mode === "dupla"} onChange={() => setMode("dupla")} className="text-amber-500" />
            2 times
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" name="mode" checked={mode === "racha"} onChange={() => setMode("racha")} className="text-amber-500" />
            Racha
          </label>
          {mode === "racha" && (
            <>
              <label className="flex items-center gap-1">
                <input type="radio" name="rachaN" checked={rachaCount === 3} onChange={() => setRachaCount(3)} className="text-amber-500" />
                3T
              </label>
              <label className="flex items-center gap-1">
                <input type="radio" name="rachaN" checked={rachaCount === 4} onChange={() => setRachaCount(4)} className="text-amber-500" />
                4T
              </label>
            </>
          )}
          <label className="flex items-center gap-1">
            Min
            <input type="number" min={1} max={60} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value) || 8)} className="w-12 rounded border border-emerald-800 bg-pitch-950 px-1 py-0.5 text-white" />
          </label>
        </div>
      </section>

      {data.players.length === 0 ? (
        <p className="text-sm text-emerald-300/70">Cadastre jogadores primeiro.</p>
      ) : (
        <>
          {/* 2. Jogadores de linha */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-amber-200">2. Jogadores de linha</h2>
              <div className="flex gap-2 text-xs">
                <button type="button" onClick={selectAll} className="rounded border border-emerald-700 px-2 py-0.5 text-emerald-100 hover:bg-emerald-900/50">Todos</button>
                <button type="button" onClick={clearSel} className="rounded border border-emerald-700 px-2 py-0.5 text-emerald-100 hover:bg-emerald-900/50">Limpar</button>
                <span className="self-center tabular-nums text-emerald-400">{selectedLinhaIds.length}</span>
              </div>
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-1.5">
              {playersLinha.map((p) => (
                <li key={p.id}>
                  <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition ${selected.has(p.id) ? "border-amber-500/50 bg-amber-950/30" : "border-emerald-800/60 bg-emerald-950/30"}`}>
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="h-3.5 w-3.5 shrink-0 rounded border-emerald-600 text-amber-500" />
                      <span className="min-w-0 truncate font-medium text-white">{p.name}</span>
                    </label>
                    <span
                      className="shrink-0"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {isAdmin ? (
                        <Stars value={p.stars} onChange={(n) => void updateStars(p, n)} />
                      ) : (
                        <Stars value={p.stars} readOnly />
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            {isAdmin && (
              <p className="mt-1 text-[10px] text-emerald-500/85">Toque nas estrelas para alterar o nível (atualiza os grupos).</p>
            )}
          </section>

          {/* 3. Grupos por estrela */}
          <section>
            <h2 className="text-sm font-semibold text-amber-200">3. Grupos por estrela</h2>
            {selectedLinhaIds.length === 0 ? (
              <p className="mt-1 text-xs text-emerald-500/85">Marque jogadores de linha acima.</p>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {gruposEstrelaSelecionados.map((g) => (
                  <div key={g.stars} className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-2">
                    <p className="text-xs font-semibold text-amber-200">{g.stars}★ ({g.players.length})</p>
                    {g.players.length === 0 ? (
                      <p className="mt-1 text-[10px] text-emerald-500/80">—</p>
                    ) : (
                      <ul className="mt-1 space-y-0.5">
                        {g.players.map((p) => (
                          <li key={p.id} className="truncate text-xs text-white/95">{p.name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 4. Goleiros */}
          <section>
            <h2 className="text-sm font-semibold text-amber-200">4. Goleiros</h2>
            <ul className="mt-2 grid grid-cols-2 gap-1.5">
              {playersGol.map((p) => (
                <li key={p.id}>
                  <label className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition ${selected.has(p.id) ? "border-amber-500/50 bg-amber-950/30" : "border-emerald-800/60 bg-emerald-950/30"}`}>
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="h-3.5 w-3.5 shrink-0 rounded border-emerald-600 text-amber-500" />
                    <span className="min-w-0 flex-1 truncate font-medium text-white">{p.name}</span>
                    <span className="text-[10px] text-emerald-500">GOL</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          {/* 5. Slots */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-amber-200">5. Sorteios (até 5)</h2>
              {drawSlots.some((s) => s !== null) && (
                <button type="button" onClick={clearAllSlots} className="text-xs text-red-400/90 hover:text-red-300">Limpar todos</button>
              )}
            </div>
            <div className="mt-2 grid grid-cols-5 gap-1">
              {drawSlots.map((slot, i) => (
                <div key={i} className="flex flex-col gap-0.5">
                  <button type="button" onClick={() => setActiveSlotIndex(i)} className={`rounded-lg border px-1 py-2 text-left text-[10px] leading-tight transition ${activeSlotIndex === i ? "border-amber-500/70 bg-amber-950/30" : "border-emerald-800/60 bg-emerald-950/25"}`}>
                    <span className="font-semibold text-amber-200/95">#{i + 1}</span>
                    {slot ? (
                      <span className="mt-0.5 block text-emerald-200/90">{slot.teams.map((t) => `${t.sumStars}★`).join(" ")}</span>
                    ) : (
                      <span className="mt-0.5 block text-emerald-600">—</span>
                    )}
                  </button>
                  {slot && (
                    <button type="button" onClick={() => clearSlot(i)} className="text-[9px] text-red-400/90 hover:text-red-300">Limpar</button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 6. Sortear */}
          <section>
            <h2 className="text-sm font-semibold text-amber-200">6. Sortear</h2>
            <button type="button" disabled={busy || selectedLinhaIds.length < teamCount} onClick={() => void sortear()} className="mt-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-pitch-950 hover:bg-amber-400 disabled:opacity-50">
              {busy ? "Sorteando…" : "Sortear times e ordem da fila"}
            </button>
            {selectedLinhaIds.length < teamCount && (
              <p className="mt-1 text-xs text-amber-200/80">Mínimo {teamCount} jogadores de linha.</p>
            )}
          </section>

          {!displayResult && drawSlots.some((s) => s !== null) && (
            <p className="text-xs text-amber-200/85">Clique em um slot (1–5) para ver os times.</p>
          )}

          {/* 7. Times do slot selecionado */}
          {displayResult && (
            <section>
              <h2 className="text-sm font-semibold text-amber-200">7. Times — slot #{activeSlotIndex + 1}</h2>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {[...displayResult.teams]
                  .sort((a, b) => a.index - b.index)
                  .map((slot) => (
                    <div key={slot.index} className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-3">
                      <h3 className="text-sm font-semibold text-amber-200">
                        {teamNames[slot.index] ?? `Time ${slot.index + 1}`}
                      </h3>
                      <p className="text-xs text-emerald-300/80">
                        {slot.sumStars}★ · Fila: {slot.rotationOrder}º
                      </p>
                      <ul className="mt-2 space-y-1">
                        {slot.players.map((p: Player) => (
                          <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate">{p.name}</span>
                            <div className="flex shrink-0 items-center gap-1">
                              <Stars value={p.stars} readOnly />
                              <select
                                className="max-w-[7rem] rounded border border-emerald-800 bg-pitch-950 px-1 py-0.5 text-[10px] text-emerald-200"
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
                                <option value="">Mover…</option>
                                {displayResult.teams.map((_, ti) =>
                                  ti !== slot.index ? (
                                    <option key={ti} value={String(ti)}>
                                      {teamNames[ti] ?? `T${ti + 1}`}
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
            </section>
          )}

          {/* 8. Goleiros dos gols */}
          {displayResult && (
            <section className="rounded-lg border border-sky-900/45 bg-sky-950/20 p-3">
              <h2 className="text-sm font-semibold text-sky-200">8. Goleiros dos gols</h2>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-sky-800/50 bg-pitch-950/40 px-2 py-2">
                  <p className="text-[10px] font-medium text-sky-300/95">Gol 1 (Entrada)</p>
                  <p className="mt-0.5 text-xs font-semibold text-white">
                    {displayResult.golEntradaPlayerId
                      ? playersById.get(displayResult.golEntradaPlayerId)?.name ?? "—"
                      : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-sky-800/50 bg-pitch-950/40 px-2 py-2">
                  <p className="text-[10px] font-medium text-sky-300/95">Gol 2 (Fundo)</p>
                  <p className="mt-0.5 text-xs font-semibold text-white">
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
                className="mt-2 rounded border border-sky-700/60 px-3 py-1 text-xs text-sky-100 hover:bg-sky-950/50 disabled:opacity-40"
              >
                Sortear de novo
              </button>
            </section>
          )}

          {/* 9. Nomes dos times */}
          <section>
            <h2 className="text-sm font-semibold text-amber-200">
              9. Nomes dos times — slot #{activeSlotIndex + 1}
            </h2>
            <p className="mt-1 text-[10px] text-emerald-400/85">
              Após o sorteio, os times são nomeados automaticamente pelo grupo{" "}
              {DEFAULT_TEAM_NAMING_STARS}★ (primeiro jogador desse nível em cada time).
              Use os botões abaixo para escolher outro grupo.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {gruposEstrelaSelecionados
                .filter((g) => g.players.length > 0)
                .map((g) => (
                  <button
                    key={g.stars}
                    type="button"
                    disabled={!displayResult}
                    onClick={() => aplicarNomesDoGrupo(g.stars)}
                    className="rounded-lg border border-emerald-700/60 bg-emerald-950/50 px-2.5 py-1 text-[11px] text-emerald-100 hover:bg-emerald-900/60 disabled:opacity-40"
                  >
                    {g.stars}★ ({g.players.length})
                    {g.stars === DEFAULT_TEAM_NAMING_STARS ? " · padrão" : ""}
                  </button>
                ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {Array.from({ length: teamCount }, (_, i) => (
                <div key={i}>
                  <label className="text-[10px] text-emerald-400/90">Time {i + 1}</label>
                  <input
                    value={teamNames[i] ?? ""}
                    onChange={(e) => setTeamName(i, e.target.value)}
                    className="mt-0.5 w-full rounded-lg border border-emerald-800 bg-pitch-950 px-2 py-1.5 text-sm text-white"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* 10. Ordem da fila */}
          {displayResult && mode === "racha" && filaOrdenada.length > 0 && (
            <section className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3">
              <h2 className="text-sm font-semibold text-amber-200">10. Ordem da fila</h2>
              <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-xs text-emerald-100/90">
                {filaOrdenada.map((slot) => (
                  <li key={slot.index}>
                    <strong>{slot.label}</strong> — {slot.sumStars}★
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* 11. Vincular */}
          <section>
            <h2 className="text-sm font-semibold text-amber-200">11. Vincular ao racha</h2>
            <button
              type="button"
              onClick={() => void salvarRascunho()}
              disabled={!displayResult || !agendamentoId || busy}
              className="mt-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-pitch-950 hover:bg-amber-400 disabled:opacity-50"
            >
              Vincular sorteio ao racha
            </button>
            {!agendamentoId && (
              <p className="mt-1 text-xs text-amber-200/80">Selecione o racha no passo 1.</p>
            )}
            {!displayResult && (
              <p className="mt-1 text-xs text-amber-200/80">Selecione um slot preenchido.</p>
            )}
          </section>
        </>
      )}

      {data.lastDraft && (
        <p className="text-xs text-emerald-400/80">
          Último sorteio salvo:{" "}
          {new Date(data.lastDraft.createdAt).toLocaleString("pt-BR")} —{" "}
          {data.lastDraft.teamCount} times
          {data.lastDraft.format === "racha" ? " (racha)" : ""}, {data.lastDraft.durationMinutes} min.{" "}
          {teamsByRotation(data.lastDraft.teams).map((t) => t.name).join(" → ")}
          {(typeof data.lastDraft.golEntradaPlayerId === "string" ||
            typeof data.lastDraft.golFundoPlayerId === "string") && (
            <>
              {" "}
              · G1: {data.lastDraft.golEntradaPlayerId ? playersById.get(data.lastDraft.golEntradaPlayerId)?.name ?? "—" : "—"}
              {" "}
              · G2: {data.lastDraft.golFundoPlayerId ? playersById.get(data.lastDraft.golFundoPlayerId)?.name ?? "—" : "—"}
            </>
          )}
        </p>
      )}
    </div>
  );
}
