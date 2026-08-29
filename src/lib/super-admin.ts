import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";

const superAdminEmail = "ettorelogreco@gmail.com";

export async function requireSuperAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.email.toLowerCase() !== superAdminEmail) notFound();
  return session.user;
}

export function isSuperAdminEmail(email: string) {
  return email.toLowerCase() === superAdminEmail;
}
