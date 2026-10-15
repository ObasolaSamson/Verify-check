import NextAuth from "next-auth";
import { authConfig } from "@/server/auth/config";

// Next.js 16 runs this file on the Node.js runtime in place of middleware.ts.
const { auth } = NextAuth(authConfig);

export const proxy = auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
