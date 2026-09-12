"use client";

import { useEffect, useState } from "react";

function key(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}

export function PushNotificationButton() {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const available = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(available);
    if (!available) return;
    void navigator.serviceWorker.ready.then(registration => registration.pushManager.getSubscription()).then(async subscription => {
      if (!subscription) return;
      const response = await fetch(`/api/push/subscription?endpoint=${encodeURIComponent(subscription.endpoint)}`);
      setActive(response.ok && Boolean((await response.json()).registered));
    }).catch(() => setActive(false));
  }, []);

  if (!supported) return null;

  async function activate() {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (active && subscription) {
        const response = await fetch("/api/push/subscription", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        if (!response.ok) throw new Error("Disattivazione non riuscita.");
        await subscription.unsubscribe();
        setActive(false);
        setMessage("Notifiche disattivate su questo dispositivo.");
        return;
      }
      if (Notification.permission === "denied") throw new Error("Le notifiche sono bloccate nelle impostazioni del browser.");
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("Chiave pubblica VAPID non disponibile in questa versione del sito.");
      subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(publicKey) });
      const response = await fetch("/api/push/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription) });
      if (!response.ok) throw new Error(response.status === 401 ? "Accedi prima di attivare le notifiche." : "Registrazione del dispositivo non riuscita.");
      setActive(true);
      setMessage("Dispositivo registrato. Prova l’invio ora.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Attivazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/push/test", { method: "POST" });
      const result = await response.json() as { error?: string };
      setMessage(response.ok ? "Notifica di prova inviata: controlla anche il centro notifiche del dispositivo." : result.error ?? "Invio di prova non riuscito.");
    } catch {
      setMessage("Impossibile contattare il server per la prova.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="push-controls">
    <button type="button" className="site-install-button" disabled={busy} onClick={activate}>{active ? "🔔 Notifiche attive" : "🔔 Attiva notifiche"}</button>
    {active ? <button type="button" className="site-install-button" disabled={busy} onClick={test}>Prova notifica</button> : null}
    {message ? <span role="status">{message}</span> : null}
  </div>;
}
