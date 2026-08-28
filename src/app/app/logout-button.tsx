"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function LogoutButton() {
  const router = useRouter();
  return <button className="ghost-button" onClick={async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }}>Esci</button>;
}
