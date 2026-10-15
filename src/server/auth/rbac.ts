import type { RoleKey } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db";

export type SessionUser = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  emailVerified: Date | null;
  phoneVerified: Date | null;
  roles: RoleKey[];
};

const STAFF: RoleKey[] = ["FIELD_OFFICER", "SURVEYOR", "LAWYER", "ADMIN"];

export function homeForRoles(roles: RoleKey[]) {
  if (roles.includes("ADMIN")) return "/admin";
  if (roles.some((role) => STAFF.includes(role) && role !== "ADMIN")) return "/staff";
  if (roles.includes("AGENT") && !roles.includes("CUSTOMER")) return "/agent";
  if (roles.includes("CUSTOMER")) return "/dashboard";
  return "/login";
}

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { userRoles: { include: { role: true } } },
  });
  if (!user || user.anonymizedAt) redirect("/login");
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    roles: user.userRoles.map((row) => row.role.key),
  };
}

export async function requireRole(role: RoleKey) {
  const user = await requireUser();
  if (!user.roles.includes(role)) redirect(homeForRoles(user.roles));
  return user;
}

export function hasRole(user: SessionUser, role: RoleKey) {
  return user.roles.includes(role);
}
