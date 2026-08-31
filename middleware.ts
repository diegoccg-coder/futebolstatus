import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const path = req.nextUrl.pathname;
    const role = req.nextauth.token?.role as string | undefined;

    const adminOnly =
      path.startsWith("/jogadores") ||
      path.startsWith("/sorteio") ||
      path.startsWith("/financas") ||
      path.startsWith("/admin") ||
      path === "/jogos" ||
      path === "/registro-de-jogos" ||
      path === "/historico-de-jogos";

    if (adminOnly && role !== "admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const p = req.nextUrl.pathname;
        if (p.startsWith("/login")) return true;
        return !!token;
      },
    },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: [
    "/((?!api|login|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
