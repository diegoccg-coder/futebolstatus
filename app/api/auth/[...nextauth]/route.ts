import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth-options";

// Cada deploy na Vercel tem hostname único (preview vs produção). Se NEXTAUTH_URL
// não existir, o NextAuth usa este valor para cookies/callbacks — evita preview quebrado.
if (process.env.VERCEL_URL) {
  process.env.NEXTAUTH_URL ??= `https://${process.env.VERCEL_URL}`;
}

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
