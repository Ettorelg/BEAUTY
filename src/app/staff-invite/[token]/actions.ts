"use server";

import { and, eq, isNull, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { businessMemberships, staffMembers } from "@/db/schema";
import { staffInvitations } from "@/db/schema/staff-invitations";
import { auth } from "@/lib/auth";
import { hashStaffInvitationToken } from "@/lib/staff-invitations";

export async function acceptStaffInvitation(formData: FormData) {
  const token = z.string().min(32).max(200).parse(formData.get("token"));
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Accedi prima di accettare l’invito.");
  const [invitation] = await db.select({
    id: staffInvitations.id,
    businessId: staffInvitations.businessId,
    staffId: staffInvitations.staffId,
    email: staffInvitations.email,
    expiresAt: staffInvitations.expiresAt,
  }).from(staffInvitations).innerJoin(staffMembers, and(
    eq(staffMembers.id, staffInvitations.staffId),
    eq(staffMembers.businessId, staffInvitations.businessId),
    eq(staffMembers.active, true),
  )).where(and(eq(staffInvitations.tokenHash, hashStaffInvitationToken(token)), isNull(staffInvitations.acceptedAt))).limit(1);
  if (!invitation || invitation.expiresAt <= new Date()) throw new Error("Invito non valido o scaduto.");
  if (session.user.email.toLowerCase() !== invitation.email) throw new Error("Accedi con l’indirizzo email che ha ricevuto l’invito.");
  const [otherProfile] = await db.select({ id: staffMembers.id }).from(staffMembers).where(and(
    eq(staffMembers.businessId, invitation.businessId),
    eq(staffMembers.userId, session.user.id),
    ne(staffMembers.id, invitation.staffId),
  )).limit(1);
  if (otherProfile) throw new Error("Questo account è già collegato a un altro profilo operatore del salone.");

  await db.transaction(async (tx) => {
    await tx.insert(businessMemberships).values({ businessId: invitation.businessId, userId: session.user.id, role: "STAFF" }).onConflictDoNothing();
    await tx.update(staffMembers).set({ userId: session.user.id, updatedAt: new Date() })
      .where(and(eq(staffMembers.id, invitation.staffId), eq(staffMembers.businessId, invitation.businessId)));
    await tx.update(staffInvitations).set({ acceptedAt: new Date(), lastError: null, updatedAt: new Date() })
      .where(and(eq(staffInvitations.id, invitation.id), isNull(staffInvitations.acceptedAt)));
  });
  redirect("/app");
}
