"use client";

import { useEffect, useRef, useState } from "react";

type Detector = { detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>> };

export function SalonLinkOpener() {
  const [value, setValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function openSalon(candidate = value) {
    try {
      const url = new URL(candidate.trim(), window.location.origin);
      if (url.origin !== window.location.origin || !/^\/s\/[^/]+/.test(url.pathname)) throw new Error();
      window.location.assign(`${url.pathname}${url.search}`);
    } catch {
      setError("Inserisci un link Alpha Beauty valido del punto vendita.");
    }
  }

  function stop() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }

  useEffect(() => () => stop(), []);

  async function scan() {
    setError("");
    const DetectorClass = (window as typeof window & { BarcodeDetector?: new (options: { formats: string[] }) => Detector }).BarcodeDetector;
    if (!DetectorClass) {
      setError("La scansione QR non è supportata da questo browser. Incolla il link del salone.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScanning(true);
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      const detector = new DetectorClass({ formats: ["qr_code"] });
      const check = async () => {
        if (!streamRef.current || !videoRef.current) return;
        const result = await detector.detect(videoRef.current);
        if (result[0]?.rawValue) {
          stop();
          openSalon(result[0].rawValue);
          return;
        }
        window.setTimeout(check, 250);
      };
      void check();
    } catch {
      stop();
      setError("Impossibile accedere alla fotocamera. Controlla i permessi oppure incolla il link.");
    }
  }

  return <section className="panel salon-link-opener">
    <div><p className="eyebrow">Aggiungi punto vendita</p><h2>Apri il salone dal suo invito</h2><p className="muted">Incolla il link ricevuto oppure inquadra il QR code. Il salone resterà tra i tuoi saloni dopo la prima prenotazione.</p></div>
    <div className="salon-link-controls"><input type="url" value={value} onChange={(event) => setValue(event.target.value)} placeholder="https://beauty.alphasystemsrl.it/s/..." /><button className="primary-button" type="button" onClick={() => openSalon()}>Apri link</button><button className="ghost-button" type="button" onClick={scanning ? stop : scan}>{scanning ? "Chiudi fotocamera" : "Inquadra QR code"}</button></div>
    {scanning ? <video className="salon-qr-video" ref={videoRef} muted playsInline /> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}
  </section>;
}
