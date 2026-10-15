import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { RoleKey } from "@prisma/client";
import { authConfig } from "@/server/auth/config";
import { verifyChallenge } from "@/server/auth/otp";
import { prisma } from "@/server/db";
import { writeAudit } from "@/server/audit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: "Email or phone code",
      credentials: {
        destination: { label: "Email or phone", type: "text" },
        code: { label: "Code", type: "text" },
      },
      authorize: async (credentials) => {
        const destination = String(credentials?.destination ?? "");
        const code = String(credentials?.code ?? "");
        if (!destination || !code) return null;
        const result = await verifyChallenge(destination, code);
        if (!result.ok || !result.userId) return null;
        const user = await prisma.user.findUnique({
          where: { id: result.userId },
          include: { userRoles: { include: { role: true } } },
        });
        if (!user || user.anonymizedAt) return null;
        const verified = Boolean(user.emailVerified || user.phoneVerified);
        if (!verified && !destination.startsWith("ticket:")) return null;
        await writeAudit({
          actorId: user.id,
          action: "LOGIN",
          entityType: "User",
          entityId: user.id,
        });
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          roles: user.userRoles.map((row) => row.role.key) satisfies RoleKey[],
        };
      },
    }),
  ],
});
