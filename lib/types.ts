export type PlayerCategory = "campo" | "goleiro";

export type Player = {
  id: string;
  name: string;
  stars: number;
  /** Linha de campo ou goleiro (cadastro separado na tela Jogadores). */
  category: PlayerCategory;
  createdAt: string;
};

export type MatchTeam = {
  name: string;
  playerIds: string[];
};

/** Time no jogo ou rascunho, com posição na fila de rotação (1 = entra primeiro na ordem sorteada). */
export type MatchTeamSlot = MatchTeam & {
  rotationOrder: number;
};

export type MatchFormat = "dupla" | "racha";

export type Goal = {
  id: string;
  scorerId: string;
  assistId?: string | null;
  /**
   * Artilheiro não estava nos dois times em campo, mas no elenco do racha (substituto).
   * Conta gol no ranking; não conta vitória do time.
   */
  scorerFromBench?: boolean;
  /** Assistência de quem não estava em campo nesta partida (substituto do racha). */
  assistFromBench?: boolean;
};

export type Match = {
  id: string;
  /** Ordem manual dos jogos dentro do racha (menor = mais cedo). */
  sortIndex: number;
  agendamentoId: string | null;
  date: string;
  weekLabel?: string;
  /** Duração de cada partida no campo (ex.: 8 min). */
  durationMinutes: number;
  format: MatchFormat;
  teamCount: 2 | 3 | 4;
  teams: MatchTeamSlot[];
  /** Índices dos times que jogaram esta partida (geralmente 2 times). */
  fieldTeamIndexes: number[];
  goals: Goal[];
  /** Índice 0..n-1 em `teams` (ordem fixa no array, não pela fila). */
  championTeamIndex: number | null;
  /** Resultado definido como empate. */
  drawResult: boolean;
  /** Gols do time em `fieldTeamIndexes[0]` (tempo regulamentar). */
  placarField0: number | null;
  /** Gols do time em `fieldTeamIndexes[1]`. */
  placarField1: number | null;
  /** Empate no placar decidido com uma cobrança de pênalti por time. */
  decisaoPorPenaltis: boolean;
  /** Pênaltis convertidos (0 ou 1) — time em fieldTeamIndexes[0]. */
  penaltisConvertidos0: number | null;
  penaltisConvertidos1: number | null;
  /** Jogadores com cartão amarelo neste jogo (ids). */
  cartoesAmarelos: string[];
  /** Jogadores com cartão vermelho neste jogo (ids). */
  cartoesVermelhos: string[];
};

export type LastDraft = {
  agendamentoId: string | null;
  format: MatchFormat;
  teamCount: 2 | 3 | 4;
  durationMinutes: number;
  teams: MatchTeamSlot[];
  createdAt: string;
  /** Goleiros do sorteio (fora dos times): entrada e fundo. */
  golEntradaPlayerId?: string | null;
  golFundoPlayerId?: string | null;
};

export type UserRole = "admin" | "jogador";

/** Usuário do sistema (senha só no servidor / arquivo local). */
export type UserRecord = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  playerId: string | null;
  createdAt: string;
};

export type UserPublic = Omit<UserRecord, "passwordHash">;

/** Racha / evento marcado no calendário. */
export type Agendamento = {
  id: string;
  date: string;
  time?: string;
  title?: string;
  notes?: string;
  /** Campo de jogo (quadra) 1, 2 ou 3. */
  campo?: 1 | 2 | 3;
  createdAt: string;
};

/** Fotos do “melhor time” e “melhor jogador” por racha (agendamento). URLs em data:image/...;base64,... */
export type ChampionPhotosEntry = {
  bestTeamPhotoUrl: string | null;
  bestPlayerPhotoUrl: string | null;
  updatedAt: string;
};

/** Sorteio em andamento na tela Sorteio, compartilhado entre admins (slots 1–5, seleção, racha). */
export type SorteioSharedWorkspace = {
  slots: SerializedSorteioSlot[];
  activeSlotIndex: number;
  selectedIds: string[];
  /** Nomes dos times por slot de sorteio (5 entradas, índice 0–4). */
  teamNamesBySlot: string[][];
  mode: "dupla" | "racha";
  rachaCount: 3 | 4;
  durationMinutes: number;
  agendamentoId: string;
  updatedAt: string;
  updatedByUserId?: string | null;
  updatedByName?: string | null;
};

export type SerializedSorteioSlot = {
  teamCount: number;
  teams: Array<{
    index: number;
    playerIds: string[];
    rotationOrder: number;
  }>;
  golEntradaPlayerId?: string | null;
  golFundoPlayerId?: string | null;
} | null;

/** Despesa extra no caixa do racha (material, lanche, etc.). */
export type DespesaExtra = {
  id: string;
  descricao: string;
  valor: number;
};

/**
 * Valores gerais da pelada (iguais para todos os rachas): caixa de referência e tarifas.
 * Receita típica: cota do jogador. Despesas fixas: aluguel, goleiros, juiz.
 */
export type FinancasGlobais = {
  /** Saldo inicial; entra no caixa atualizado geral somado ao resultado líquido de todos os rachas. */
  caixaTotal: number | null;
  valorPorJogador: number | null;
  valorAluguelCampo: number | null;
  valorPorGoleiro: number | null;
  valorJuiz: number | null;
  updatedAt: string;
};

/** Por racha: quem pagou a cota, quit despesas fixas e extras. */
export type RachaFinancas = {
  agendamentoId: string;
  jogadoresPagos: string[];
  pagamentoCampoQuitado: boolean;
  pagamentoGoleirosQuitado: boolean;
  pagamentoJuizQuitado: boolean;
  despesasExtras: DespesaExtra[];
  updatedAt: string;
};

/** Registro de alteração (últimos eventos de salvamento). */
export type FinancasHistoricoEntry = {
  id: string;
  at: string;
  kind: "globais" | "racha";
  agendamentoId: string | null;
  titulo: string;
  resumo: string;
  updatedByName: string | null;
  /** Tarifas no momento do salvamento. */
  globais: FinancasGlobais;
  /** Estado do racha (apenas quando kind === "racha"). */
  racha: RachaFinancas | null;
};

export type AppData = {
  players: Player[];
  matches: Match[];
  lastDraft: LastDraft | null;
  /** Sorteio salvo por id do agendamento (racha). */
  draftsByAgendamento: Record<string, LastDraft>;
  users: UserRecord[];
  agendamentos: Agendamento[];
  /** Fotos anexadas pelo admin, chave = id do agendamento. */
  championPhotosByAgendamento: Record<string, ChampionPhotosEntry>;
  /**
   * Estado atual da tela Sorteio (rascunho compartilhado). Qualquer admin vê e pode editar;
   * “Vincular ao racha” continua gravando o draft oficial em draftsByAgendamento.
   */
  sorteioWorkspace: SorteioSharedWorkspace | null;
  /** Finanças por id do agendamento. */
  financasByAgendamento: Record<string, RachaFinancas>;
  /** Tarifas e caixa geral (uma vez para todos os rachas). */
  financasGlobais: FinancasGlobais;
  /** Histórico de salvamentos (finanças). */
  financasHistorico: FinancasHistoricoEntry[];
};
