import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth-server";
import { readDb } from "@/lib/store";
import { balanceIntoN, randomRotationOrders, shuffle } from "@/lib/balance";

export async function POST(req: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const body = await req.json();
  const playerIds: string[] = Array.isArray(body.playerIds) ? body.playerIds : [];
  const teamCount = Number(body.teamCount);
  const n =
    teamCount === 3 || teamCount === 4 ? teamCount : teamCount === 2 ? 2 : 2;

  if (playerIds.length < n) {
    return NextResponse.json(
      { error: `Selecione pelo menos ${n} jogadores para ${n} times` },
      { status: 400 }
    );
  }
  const db = await readDb();
  const selected = db.players.filter((p) => playerIds.includes(p.id));
  if (selected.length !== playerIds.length) {
    return NextResponse.json({ error: "Jogador inválido" }, { status: 400 });
  }
  if (selected.some((p) => p.category === "goleiro")) {
    return NextResponse.json(
      { error: "Goleiros não entram no sorteio dos times — marque só jogadores de linha" },
      { status: 400 }
    );
  }
  const shuffled = shuffle(selected);
  const { teams, sums } = balanceIntoN(shuffled, n);
  const rotationOrders = randomRotationOrders(n);

  const payload = teams.map((slotPlayers, index) => ({
    index,
    playerIds: slotPlayers.map((p) => p.id),
    players: slotPlayers,
    sumStars: sums[index] ?? 0,
    rotationOrder: rotationOrders[index] ?? index + 1,
  }));

  return NextResponse.json({
    teamCount: n,
    teams: payload,
  });
}
