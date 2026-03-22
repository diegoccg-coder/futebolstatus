import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function getAuthSession() {
  return getServerSession(authOptions);
}

export async function requireSessionUser() {
  const s = await getAuthSession();
  if (!s?.user?.id) return null;
  return s.user;
}

export async function requireAdminSession() {
  const s = await getAuthSession();
  if (!s?.user || s.user.role !== "admin") return null;
  return s.user;
}
