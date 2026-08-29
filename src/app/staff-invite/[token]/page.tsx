import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { db } from "@/db/client";
import { businesses, staffMembers } from "@/db/schema";
import { staffInvitations } from "@/db/schema/staff-invitations";
import { auth } from "@/lib/auth";
import { hashStaffInvitationToken } from "@/lib/staff-invitations";
import { SocialAuthButtons } from "@/app/(auth)/social-auth-buttons";
import { LogoutButton } from "@/app/app/logout-button";
import { acceptStaffInvitation } from "./actions";
import { InviteAuthForm } from "./invite-auth-form";

export default async function StaffInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invitation] = await db.select({
    email: staffInvitations.email,
    expiresAt: staffInvitations.expiresAt,
    acceptedAt: staffInvitations.acceptedAt,
    staffName: staffMembers.name,
    businessName: businesses.name,
  }).from(staffInvitations)
    .innerJoin(staffMembers, and(eq(staffMembers.id, staffInvitations.staffId), eq(staffMembers.businessId, staffInvitations.businessId)))
    .innerJoin(businesses, eq(businesses.id, staffInvitations.businessId))
    .where(eq(staffInvitations.tokenHash, hashStaffInvitationToken(token))).limit(1);

  if (!invitation) return <InviteMessage title="Invito non valido" message="Il collegamento non esiste o è stato sostituito da un invito più recente." />;
  if (invitation.acceptedAt) return <InviteMessage title="Invito già utilizzato" message="L’account è già stato collegato al salone." link="/app" />;
  if (invitation.expiresAt <= new Date()) return <InviteMessage title="Invito scaduto" message="Chiedi al titolare del salone di reinviare l’invito." />;

  const session = await auth.api.getSession({ headers: await headers() });
  const callbackURL = `/staff-invite/${token}`;

  return <main className="auth-shell"><section className="auth-card wide-card"><p className="eyebrow">Invito staff</p><h1>Entra in {invitation.businessName}.</h1><p className="muted">Ciao {invitation.staffName}, completa l’accesso con l’indirizzo {invitation.email}.</p>
    {session ? session.user.email.toLowerCase() === invitation.email ? <div className="panel"><p>Hai effettuato l’accesso come <strong>{session.user.email}</strong>.</p><form action={acceptStaffInvitation}><input type="hidden" name="token" value={token}/><button className="primary-button">Accetta invito ed entra</button></form></div> : <div className="panel"><p>Sei collegato come <strong>{session.user.email}</strong>. Devi usare {invitation.email}.</p><LogoutButton redirectTo={callbackURL}/></div> : <>
      <SocialAuthButtons appleEnabled={Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET)} callbackURL={callbackURL} googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}/>
      <InviteAuthForm email={invitation.email} name={invitation.staffName}/>
    </>}
  </section></main>;
}

function InviteMessage({ title, message, link }: { title: string; message: string; link?: string }) {
  return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">Invito staff</p><h1>{title}</h1><p className="muted">{message}</p>{link ? <Link className="primary-button link-button" href={link}>Vai al gestionale</Link> : null}</section></main>;
}
