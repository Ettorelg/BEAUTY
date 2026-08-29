import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">Area clienti</p><h1>Account in attesa.</h1><p className="muted">Il tuo account è stato creato come cliente. Per diventare titolare, attendi che l’amministratore abiliti una licenza.</p><Link className="primary-button link-button" href="/account">Vai all’area clienti</Link></section></main>;
}

