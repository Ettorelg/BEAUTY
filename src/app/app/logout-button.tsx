"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function LogoutButton({ redirectTo = "/login" }: { redirectTo?: string }) {
  const router = useRouter();
  return <button className="ghost-button" onClick={async () => {
    await authClient.signOut();
    router.push(redirectTo);
    router.refresh();
  }}>Esci</button>;
}
