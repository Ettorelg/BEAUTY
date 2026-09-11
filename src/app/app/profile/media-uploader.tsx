"use client";

import { useState } from "react";

export function MediaUploader({ name, label, defaultValue = "", previewUrl }: { name: string; label: string; defaultValue?: string; previewUrl?: string }) {
  const [key, setKey] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(defaultValue ? previewUrl : undefined);
  async function upload(file: File) {
    setBusy(true); setPreview(URL.createObjectURL(file));
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch("/api/media/upload", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setKey(data.key);
    } finally { setBusy(false); }
  }
  return <label>{label}<span style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
    {preview ? <img src={preview} alt={`Anteprima ${label}`} style={{ width: 120, height: 72, objectFit: "contain", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }} /> : null}
    <span><input type="hidden" name={name} value={key}/><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => event.target.files?.[0] && void upload(event.target.files[0])}/><small className="muted">{busy ? "Caricamento…" : key ? "Immagine caricata" : "PNG, JPG o WebP"}</small></span>
  </span></label>;
}
