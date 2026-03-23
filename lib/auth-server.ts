import { getToken } from "next-auth/jwt";
import { cookies, headers } from "next/headers";
import { authOptions } from "@/lib/auth-options";

type SessionUser = {
  id: string;
  name?: string;
  email?: string;
  role: "admin" | "jogador";
};

/**
 * Lê a sessão via JWT (cookie), igual ao NextAuth no cliente.
 * Evita `getServerSession` em Route Handlers, que em alguns casos lança exceção
 * (JWT inválido / resposta de erro) e vira 500 genérico na API.
 */
export async function getSessionUserFromJwt(): Promise<SessionUser | null> {
  const secret =
    (typeof authOptions.secret === "string" && authOptions.secret) ||
    process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  try {
    const h = headers();
    const c = cookies();
    const token = await getToken({
      req: {
        headers: Object.fromEntries(h.entries()),
        cookies: Object.fromEntries(c.getAll().map((x) => [x.name, x.value])),
      } as Parameters<typeof getToken>[0]["req"],
      secret,
    });
    if (!token) return null;
    const id =
      (typeof token.id === "string" && token.id) ||
      (typeof token.sub === "string" && token.sub);
    if (!id) return null;
    return {
      id,
      name: typeof token.name === "string" ? token.name : undefined,
      email: typeof token.email === "string" ? token.email : undefined,
      role: token.role === "admin" ? "admin" : "jogador",
    };
  } catch {
    return null;
  }
}

export async function getAuthSession() {
  const u = await getSessionUserFromJwt();
  if (!u) return null;
  return {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    user: {
      id: u.id,
      name: u.name ?? "",
      email: u.email ?? "",
      role: u.role,
    },
  };
}

export async function requireSessionUser() {
  return getSessionUserFromJwt();
}

export async function requireAdminSession() {
  const u = await getSessionUserFromJwt();
  if (!u || u.role !== "admin") return null;
  return u;
}
