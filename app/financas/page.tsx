"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  computeCaixaAtualizadoConsolidado,
  computeSaldoRacha,
  computeSaldoTotalGeral,
  createDefaultFinancas,
  despesasFixasQuitadasCalculado,
  formatBRL,
  goalkeeperCountForPayment,
  playerIdsForCotaFromDraft,
  recebidoJogadoresCalculado,
  somaDespesasExtras,
} from "@/lib/financas";
import type { FinancasGlobais, RachaFinancas } from "@/lib/types";
import { useAppData } from "@/lib/useData";

function newExtraId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `ext-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function FinancasPage() {
  const { data: session } = useSession();
  const { data, loading, error, refresh } = useAppData();
  const isAdmin = session?.user?.role === "admin";

  const [selectedId, setSelectedId] = useState("");
  const [globaisForm, setGlobaisForm] = useState<FinancasGlobais | null>(null);
  const [form, setForm] = useState<RachaFinancas | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingGlobais, setSavingGlobais] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveGlobaisMsg, setSaveGlobaisMsg] = useState<string | null>(null);
  const [histOpenId, setHistOpenId] = useState<string | null>(null);

  const agendamentosSorted = useMemo(
    () =>
      data ? [...data.agendamentos].sort((a, b) => b.date.localeCompare(a.date)) : [],
    [data]
  );

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
    if (!data) {
      setGlobaisForm(null);
      return;
    }
    setGlobaisForm({ ...data.financasGlobais });
  }, [data]);

  useEffect(() => {
    if (!data || !selectedId) {
      setForm(null);
      return;
    }
    const existing = data.financasByAgendamento[selectedId];
    setForm(existing ? { ...existing } : createDefaultFinancas(selectedId));
  }, [data, selectedId]);

  const draft = useMemo(() => {
    if (!data || !selectedId) return null;
    return data.draftsByAgendamento[selectedId] ?? null;
  }, [data, selectedId]);

  const gkCount = useMemo(() => goalkeeperCountForPayment(draft), [draft]);

  const playersSorted = useMemo(() => {
    if (!data) return [];
    return playerIdsForCotaFromDraft(draft, data.players)
      .map((id) => data.players.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [data, draft]);

  const patchForm = useCallback((patch: Partial<RachaFinancas>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const patchGlobais = useCallback((patch: Partial<FinancasGlobais>) => {
    setGlobaisForm((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const saldoEste = useMemo(() => {
    if (!form || !globaisForm || !data) return 0;
    return computeSaldoRacha(globaisForm, form, draft, data.players);
  }, [form, globaisForm, draft, data]);

  const saldoTotal = useMemo(() => {
    if (!data || !form || !selectedId || !globaisForm) return 0;
    const map = { ...data.financasByAgendamento, [selectedId]: form };
    return computeSaldoTotalGeral(
      globaisForm,
      map,
      data.draftsByAgendamento ?? {},
      data.players
    );
  }, [data, form, selectedId, globaisForm]);

  const caixaInicial = globaisForm ? (globaisForm.caixaTotal ?? 0) : 0;

  const caixaConsolidado = useMemo(() => {
    if (!data || !form || !selectedId || !globaisForm) {
      return globaisForm?.caixaTotal ?? 0;
    }
    const map = { ...data.financasByAgendamento, [selectedId]: form };
    return computeCaixaAtualizadoConsolidado(
      globaisForm,
      map,
      data.draftsByAgendamento ?? {},
      data.players
    );
  }, [data, form, selectedId, globaisForm]);

  const recebidoCalc =
    form && globaisForm && data
      ? recebidoJogadoresCalculado(globaisForm, form, draft, data.players)
      : 0;
  const despesasFixasCalc =
    form && globaisForm ? despesasFixasQuitadasCalculado(globaisForm, form, draft) : 0;

  const despesasExtrasCalc = useMemo(
    () => (form ? somaDespesasExtras(form.despesasExtras) : 0),
    [form]
  );

  const totalDespesasRegistradas = despesasFixasCalc + despesasExtrasCalc;

  async function salvarGlobais() {
    if (!isAdmin || !globaisForm) return;
    setSavingGlobais(true);
    setSaveGlobaisMsg(null);
    try {
      const r = await fetch("/api/admin/financas-globais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caixaTotal: globaisForm.caixaTotal,
          valorPorJogador: globaisForm.valorPorJogador,
          valorAluguelCampo: globaisForm.valorAluguelCampo,
          valorPorGoleiro: globaisForm.valorPorGoleiro,
          valorJuiz: globaisForm.valorJuiz,
        }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) {
        setSaveGlobaisMsg(j.error ?? "Erro ao salvar");
        return;
      }
      setSaveGlobaisMsg("Salvo.");
      await refresh();
    } finally {
      setSavingGlobais(false);
    }
  }

  async function salvarRacha() {
    if (!isAdmin || !form || !selectedId) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const r = await fetch("/api/admin/financas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agendamentoId: selectedId,
          jogadoresPagos:
            draft && data
              ? form.jogadoresPagos.filter((id) =>
                  new Set(playerIdsForCotaFromDraft(draft, data.players)).has(id)
                )
              : form.jogadoresPagos,
          pagamentoCampoQuitado: form.pagamentoCampoQuitado,
          pagamentoGoleirosQuitado: form.pagamentoGoleirosQuitado,
          pagamentoJuizQuitado: form.pagamentoJuizQuitado,
          despesasExtras: form.despesasExtras,
        }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) {
        setSaveMsg(j.error ?? "Erro ao salvar");
        return;
      }
      setSaveMsg("Salvo.");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-emerald-200/80">Carregando…</p>;
  if (error || !data) return <p className="text-red-300">{error ?? "Erro"}</p>;
  if (!form || !globaisForm) {
    return <p className="text-emerald-200/80">Carregando formulário…</p>;
  }

  const agLabel = (id: string) => {
    const a = data.agendamentos.find((x) => x.id === id);
    if (!a) return id;
    const t = a.time ? ` · ${a.time}` : "";
    return `${a.date}${t}${a.title ? ` — ${a.title}` : ""}`;
  };

  function togglePago(pid: string) {
    setForm((prev) => {
      if (!prev) return prev;
      const set = new Set(prev.jogadoresPagos);
      if (set.has(pid)) set.delete(pid);
      else set.add(pid);
      return { ...prev, jogadoresPagos: [...set] };
    });
  }

  function marcarTodosPagos() {
    if (!data) return;
    const ids = playerIdsForCotaFromDraft(draft, data.players);
    setForm((prev) => (prev ? { ...prev, jogadoresPagos: [...ids] } : prev));
  }

  const historico = data.financasHistorico ?? [];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Finanças</h1>
        <p className="mt-1 text-sm text-emerald-100/75">
          <strong className="text-amber-200/95">Receita:</strong> cada jogador paga a cota para jogar.
          <strong className="ml-2 text-amber-200/95">Despesas:</strong> aluguel do campo, goleiros e
          juiz recebem esses valores. Os números abaixo valem para{" "}
          <strong>todos os rachas</strong>; em seguida você controla cada racha (quem pagou, o que já
          foi pago ao campo, etc.).
        </p>
      </div>

      {/* —— Valores globais —— */}
      <section className="rounded-2xl border border-sky-800/50 bg-sky-950/20 p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold text-sky-200">
          Valores para todos os rachas
        </h2>
        <p className="text-xs text-sky-200/70">
          O <strong className="text-sky-100/90">caixa inicial</strong> (campo abaixo) entra no{" "}
          <strong className="text-sky-100/90">caixa atualizado geral</strong>: somamos esse valor ao
          resultado líquido (receitas − despesas) de <em>todos</em> os rachas. Cota e tarifas de campo
          / goleiro / juiz valem para cada racha.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/30 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400/90">
              Receita (referência)
            </p>
            <Field
              label="Valor por jogador — cota (R$)"
              disabled={!isAdmin}
              value={globaisForm.valorPorJogador}
              onChange={(n) => patchGlobais({ valorPorJogador: n })}
            />
          </div>
          <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-300/90">
              Despesas — quem recebe
            </p>
            <Field
              label="Aluguel do campo (R$)"
              disabled={!isAdmin}
              value={globaisForm.valorAluguelCampo}
              onChange={(n) => patchGlobais({ valorAluguelCampo: n })}
            />
            <Field
              label="Valor por goleiro (R$)"
              disabled={!isAdmin}
              value={globaisForm.valorPorGoleiro}
              onChange={(n) => patchGlobais({ valorPorGoleiro: n })}
            />
            <Field
              label="Valor do juiz (R$)"
              disabled={!isAdmin}
              value={globaisForm.valorJuiz}
              onChange={(n) => patchGlobais({ valorJuiz: n })}
            />
          </div>
        </div>

        <div className="max-w-md">
          <Field
            label="Caixa inicial — saldo antes dos rachas (R$)"
            disabled={!isAdmin}
            value={globaisForm.caixaTotal}
            onChange={(n) => patchGlobais({ caixaTotal: n })}
          />
        </div>

        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={savingGlobais}
              onClick={() => void salvarGlobais()}
              className="rounded-xl bg-sky-700 px-5 py-2.5 font-medium text-white hover:bg-sky-600 disabled:opacity-50"
            >
              {savingGlobais ? "Salvando…" : "Salvar valores gerais"}
            </button>
            {saveGlobaisMsg ? (
              <span className="text-sm text-emerald-400">{saveGlobaisMsg}</span>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-emerald-400/90">Somente administradores alteram os valores gerais.</p>
        )}
      </section>

      {/* —— Por racha —— */}
      <section className="space-y-6">
        <h2 className="font-display text-lg font-semibold text-amber-200">Por racha</h2>

        <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 p-4">
          <label className="block text-sm font-medium text-amber-200/95">Racha</label>
          <select
            className="mt-2 w-full max-w-xl rounded-lg border border-emerald-800/60 bg-pitch-950 px-3 py-2 text-emerald-100"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {agendamentosSorted.map((a) => (
              <option key={a.id} value={a.id}>
                {agLabel(a.id)}
              </option>
            ))}
          </select>
          {!draft && (
            <p className="mt-3 text-sm text-amber-200/90">
              Não há sorteio salvo para este racha. Use Sorteio e &quot;Vincular ao racha&quot; para
              publicar a seleção.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/25 p-4 space-y-3">
          <p className="text-sm font-medium text-amber-200/95">
            Despesas fixas quitadas neste racha
          </p>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-emerald-100/90">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-emerald-700"
              checked={form.pagamentoCampoQuitado}
              disabled={!isAdmin}
              onChange={(e) => patchForm({ pagamentoCampoQuitado: e.target.checked })}
            />
            Aluguel do campo pago
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-emerald-100/90">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-emerald-700"
              checked={form.pagamentoGoleirosQuitado}
              disabled={!isAdmin}
              onChange={(e) => patchForm({ pagamentoGoleirosQuitado: e.target.checked })}
            />
            Goleiros pagos
            <span className="text-emerald-500/90">
              ({gkCount} no sorteio →{" "}
              {formatBRL((globaisForm.valorPorGoleiro ?? 0) * gkCount)})
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-emerald-100/90">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-emerald-700"
              checked={form.pagamentoJuizQuitado}
              disabled={!isAdmin}
              onChange={(e) => patchForm({ pagamentoJuizQuitado: e.target.checked })}
            />
            Juiz pago
          </label>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base font-semibold text-amber-200">
              <span>Jogadores — receita (cotas)</span>
              <span className="ml-2 text-sm font-normal text-emerald-400/90">
                · {playersSorted.length}{" "}
                {playersSorted.length === 1 ? "jogador" : "jogadores"} de linha
              </span>
            </h3>
            {isAdmin && playersSorted.length > 0 && (
              <button
                type="button"
                onClick={marcarTodosPagos}
                className="rounded-lg border border-amber-700/60 bg-amber-950/40 px-3 py-1.5 text-sm text-amber-100 hover:bg-amber-900/50"
              >
                Marcar todos como pagos
              </button>
            )}
          </div>
          {playersSorted.length === 0 ? (
            <p className="mt-2 text-sm text-emerald-400/90">
              Nenhum jogador de linha na seleção deste racha. Goleiros ficam só em &quot;Goleiros
              pagos&quot; nas despesas.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-emerald-900/50 rounded-xl border border-emerald-800/40">
              {playersSorted.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-emerald-100/90"
                >
                  <span>{p.name}</span>
                  <label className="flex cursor-pointer items-center gap-2 shrink-0">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-emerald-700"
                      checked={form.jogadoresPagos.includes(p.id)}
                      disabled={!isAdmin}
                      onChange={() => togglePago(p.id)}
                    />
                    Pagou
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base font-semibold text-amber-200">Despesas extras</h3>
            {isAdmin && (
              <button
                type="button"
                className="rounded-lg bg-emerald-800/50 px-3 py-1.5 text-sm text-emerald-100 hover:bg-emerald-700/50"
                onClick={() =>
                  patchForm({
                    despesasExtras: [
                      ...form.despesasExtras,
                      { id: newExtraId(), descricao: "", valor: 0 },
                    ],
                  })
                }
              >
                Adicionar despesa
              </button>
            )}
          </div>
          <ul className="mt-3 space-y-2">
            {form.despesasExtras.length === 0 ? (
              <li className="text-sm text-emerald-500/90">Nenhuma despesa extra neste racha.</li>
            ) : (
              form.despesasExtras.map((row, idx) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-end gap-2 rounded-lg border border-emerald-900/40 bg-pitch-950/40 p-3"
                >
                  <div className="min-w-[140px] flex-1">
                    <label className="text-xs text-emerald-500/90">Descrição</label>
                    <input
                      className="mt-1 w-full rounded border border-emerald-800/50 bg-pitch-950 px-2 py-1.5 text-sm text-emerald-100"
                      value={row.descricao}
                      disabled={!isAdmin}
                      onChange={(e) => {
                        const next = [...form.despesasExtras];
                        next[idx] = { ...next[idx]!, descricao: e.target.value };
                        patchForm({ despesasExtras: next });
                      }}
                    />
                  </div>
                  <div className="w-32">
                    <label className="text-xs text-emerald-500/90">Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="mt-1 w-full rounded border border-emerald-800/50 bg-pitch-950 px-2 py-1.5 text-sm text-emerald-100"
                      value={row.valor === 0 ? "" : row.valor}
                      disabled={!isAdmin}
                      onChange={(e) => {
                        const v = e.target.value;
                        const num = v === "" ? 0 : parseFloat(v);
                        const next = [...form.despesasExtras];
                        next[idx] = {
                          ...next[idx]!,
                          valor: Number.isFinite(num) ? Math.max(0, num) : 0,
                        };
                        patchForm({ despesasExtras: next });
                      }}
                    />
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1.5 text-sm text-red-300 hover:bg-red-950/40"
                      onClick={() =>
                        patchForm({
                          despesasExtras: form.despesasExtras.filter((_, i) => i !== idx),
                        })
                      }
                    >
                      Remover
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 p-5 space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-amber-200/80">
              Resumo deste racha (registrado)
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-emerald-200/90">
              <li className="flex flex-wrap justify-between gap-2">
                <span>Receitas (cotas pagas)</span>
                <strong className="text-emerald-300 tabular-nums">{formatBRL(recebidoCalc)}</strong>
              </li>
              <li className="flex flex-wrap justify-between gap-2">
                <span>Despesas fixas quitadas (campo, goleiros, juiz)</span>
                <strong className="text-rose-300/95 tabular-nums">
                  {formatBRL(despesasFixasCalc)}
                </strong>
              </li>
              <li className="flex flex-wrap justify-between gap-2">
                <span>Despesas extras</span>
                <strong className="text-rose-300/95 tabular-nums">
                  {formatBRL(despesasExtrasCalc)}
                </strong>
              </li>
              <li className="flex flex-wrap justify-between gap-2 border-t border-amber-900/30 pt-2 text-emerald-100/95">
                <span>Total de despesas</span>
                <strong className="text-rose-200 tabular-nums">
                  {formatBRL(totalDespesasRegistradas)}
                </strong>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-emerald-700/50 bg-pitch-950/60 p-4">
            <label className="block text-sm font-medium text-amber-200/95">
              Caixa atualizado deste racha
            </label>
            <p className="mt-1 text-xs text-emerald-500/90">
              Receitas registradas menos todas as despesas registradas (fixas quitadas + extras).
            </p>
            <input
              type="text"
              readOnly
              aria-readonly
              value={formatBRL(saldoEste)}
              className={`mt-3 w-full cursor-default rounded-lg border border-emerald-800/70 bg-emerald-950/80 px-4 py-3 text-xl font-semibold tabular-nums outline-none ${
                saldoEste >= 0 ? "text-emerald-300" : "text-red-300"
              }`}
            />
          </div>

          <div className="rounded-xl border border-sky-900/40 bg-sky-950/20 p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-sky-200/95">
                Caixa atualizado (geral)
              </label>
              <p className="mt-1 text-xs text-sky-200/70">
                <strong className="text-sky-100/85">Caixa inicial</strong> (cadastro geral) +{" "}
                <strong className="text-sky-100/85">soma dos resultados</strong> de cada racha com
                finanças (em cada racha: cotas − despesas).
              </p>
            </div>
            <ul className="space-y-1.5 rounded-lg border border-sky-900/30 bg-pitch-950/50 px-3 py-2 text-sm text-sky-100/90">
              <li className="flex flex-wrap justify-between gap-2">
                <span>Caixa inicial</span>
                <strong className="tabular-nums text-sky-200">
                  {globaisForm.caixaTotal == null ? "— (0)" : formatBRL(caixaInicial)}
                </strong>
              </li>
              <li className="flex flex-wrap justify-between gap-2">
                <span>Soma dos rachas (receitas − despesas)</span>
                <strong
                  className={`tabular-nums ${saldoTotal >= 0 ? "text-emerald-300" : "text-red-300"}`}
                >
                  {saldoTotal >= 0 ? "+" : ""}
                  {formatBRL(saldoTotal)}
                </strong>
              </li>
            </ul>
            <input
              type="text"
              readOnly
              aria-readonly
              value={formatBRL(caixaConsolidado)}
              className={`w-full cursor-default rounded-lg border border-sky-800/60 bg-pitch-950/80 px-4 py-3 text-lg font-semibold tabular-nums outline-none ${
                caixaConsolidado >= 0 ? "text-sky-200" : "text-red-300"
              }`}
            />
          </div>
        </div>

        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void salvarRacha()}
              className="rounded-xl bg-amber-600 px-5 py-2.5 font-medium text-pitch-950 hover:bg-amber-500 disabled:opacity-50"
            >
              {saving ? "Salvando…" : "Salvar finanças deste racha"}
            </button>
            {saveMsg ? <span className="text-sm text-emerald-400">{saveMsg}</span> : null}
          </div>
        ) : (
          <p className="text-sm text-emerald-400/90">Somente administradores podem alterar cada racha.</p>
        )}
      </section>

      {/* —— Histórico —— */}
      <section className="rounded-2xl border border-emerald-900/50 bg-pitch-950/50 p-6">
        <h2 className="font-display text-lg font-semibold text-amber-200">Histórico</h2>
        <p className="mt-1 text-sm text-emerald-200/70">
          Últimos salvamentos (valores gerais ou por racha). Expanda uma linha para ver o registro
          congelado na hora do save.
        </p>
        {historico.length === 0 ? (
          <p className="mt-4 text-sm text-emerald-500/90">Ainda não há registros.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {historico.map((h) => {
              const open = histOpenId === h.id;
              return (
                <li
                  key={h.id}
                  className="rounded-lg border border-emerald-900/40 bg-emerald-950/30 overflow-hidden"
                >
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-start justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-emerald-900/20"
                    onClick={() => setHistOpenId(open ? null : h.id)}
                  >
                    <span className="text-emerald-100/90">
                      <span className="font-medium text-amber-200/95">
                        {new Date(h.at).toLocaleString("pt-BR")}
                      </span>
                      {h.updatedByName ? (
                        <span className="text-emerald-500/90"> · {h.updatedByName}</span>
                      ) : null}
                      <br />
                      <span className="text-xs uppercase text-sky-400/90">
                        {h.kind === "globais" ? "Valores gerais" : "Racha"}
                      </span>{" "}
                      {h.kind === "racha" ? <span className="text-emerald-300">{h.titulo}</span> : null}
                    </span>
                    <span className="text-emerald-400/80 shrink-0">{open ? "▲" : "▼"}</span>
                  </button>
                  <p className="px-4 pb-2 text-xs text-emerald-200/75">{h.resumo}</p>
                  {open && (
                    <div className="border-t border-emerald-900/40 bg-pitch-950/80 px-4 py-3 text-xs text-emerald-200/90 space-y-2 font-mono whitespace-pre-wrap break-all">
                      <p className="text-amber-200/90 font-sans text-sm font-medium">Tarifas no momento</p>
                      <pre className="text-[11px] leading-relaxed">
                        {JSON.stringify(h.globais, null, 2)}
                      </pre>
                      {h.racha && (
                        <>
                          <p className="text-amber-200/90 font-sans text-sm font-medium pt-2">
                            Estado do racha
                          </p>
                          <pre className="text-[11px] leading-relaxed">
                            {JSON.stringify(h.racha, null, 2)}
                          </pre>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <button
        type="button"
        onClick={() => refresh()}
        className="text-sm text-emerald-400 underline hover:text-emerald-300"
      >
        Atualizar
      </button>
    </div>
  );
}

function Field(props: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  disabled?: boolean;
}) {
  const { label, value, onChange, disabled } = props;
  return (
    <label className="block">
      <span className="text-sm font-medium text-emerald-200/90">{label}</span>
      <input
        type="number"
        step="0.01"
        min="0"
        disabled={disabled}
        className="mt-1 w-full rounded-lg border border-emerald-800/60 bg-pitch-950 px-3 py-2 text-emerald-100 disabled:opacity-60"
        value={value === null || value === undefined ? "" : value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") {
            onChange(null);
            return;
          }
          const n = parseFloat(v);
          onChange(Number.isFinite(n) ? n : null);
        }}
      />
    </label>
  );
}
