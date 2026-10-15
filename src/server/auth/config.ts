import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

const STAFF = new Set(["FIELD_OFFICER", "SURVEYOR", "LAWYER", "ADMIN"]);

function rolesOf(auth: { user?: { roles?: string[] } } | null) {
  return auth?.user?.roles ?? [];
}

export const authConfig = {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.roles = "roles" in user && Array.isArray(user.roles) ? user.roles : [];
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = String(token.uid ?? "");
      session.user.roles = Array.isArray(token.roles) ? token.roles.map(String) : [];
      return session;
    },
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const roles = rolesOf(auth);
      const loggedIn = Boolean(auth?.user?.id);
      const needsAuth =
        path.startsWith("/dashboard") ||
        path.startsWith("/agent") ||
        path.startsWith("/staff") ||
        path.startsWith("/admin") ||
        path.startsWith("/api/uploads") ||
        path.startsWith("/api/files");
      if (!needsAuth) return true;

      if (!loggedIn) {
        if (path.startsWith("/api/")) {
          return NextResponse.json({ error: "Sign in required" }, { status: 401 });
        }
        return false;
      }

      const allowed =
        (path.startsWith("/dashboard") && roles.includes("CUSTOMER")) ||
        (path.startsWith("/agent") && roles.includes("AGENT")) ||
        (path.startsWith("/staff") && roles.some((role) => STAFF.has(role))) ||
        (path.startsWith("/admin") && roles.includes("ADMIN")) ||
        path.startsWith("/api/uploads") ||
        path.startsWith("/api/files");

      if (allowed) return true;
      if (path.startsWith("/api/")) {
        return NextResponse.json({ error: "You do not have access to that" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/login", request.nextUrl));
    },
  },
} satisfies NextAuthConfig;
