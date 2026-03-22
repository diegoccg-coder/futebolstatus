export type Player = {
  id: string;
  name: string;
  stars: number;
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
};

export type Match = {
  id: string;
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
};

export type LastDraft = {
  agendamentoId: string | null;
  format: MatchFormat;
  teamCount: 2 | 3 | 4;
  durationMinutes: number;
  teams: MatchTeamSlot[];
  createdAt: string;
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

/** Pelada / racha marcado no calendário. */
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

export type AppData = {
  players: Player[];
  matches: Match[];
  lastDraft: LastDraft | null;
  /** Sorteio salvo por id do agendamento (racha). */
  draftsByAgendamento: Record<string, LastDraft>;
  users: UserRecord[];
  agendamentos: Agendamento[];
};
