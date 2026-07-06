import type {
  Agendamento,
  FinancasGlobais,
  FinancasHistoricoEntry,
  LastDraft,
  Match,
  Player,
  RachaFinancas,
  SorteioSharedWorkspace,
  UserPublic,
} from "./types";

/** Resposta de GET /api/data (sem senhas; `users` vazio para perfil jogador). */
export type AppDataClient = {
  players: Player[];
  matches: Match[];
  lastDraft: LastDraft | null;
  draftsByAgendamento: Record<string, LastDraft>;
  agendamentos: Agendamento[];
  users: UserPublic[];
  sorteioWorkspace: SorteioSharedWorkspace | null;
  financasByAgendamento: Record<string, RachaFinancas>;
  financasGlobais: FinancasGlobais;
  financasHistorico: FinancasHistoricoEntry[];
};
