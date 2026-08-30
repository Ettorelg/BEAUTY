"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Customer = { id: string; name: string; email: string | null; phone: string | null };

export function CustomerDirectorySearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) { setResults([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/agenda/customers?q=${encodeURIComponent(value)}`, { signal: controller.signal });
        const data = await response.json() as { customers?: Customer[] };
        setResults(data.customers ?? []);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  return <section className="panel">
    <label>Cerca cliente<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, email o telefono" autoComplete="off"/></label>
    {loading ? <p className="muted">Ricerca…</p> : null}
    {query.trim().length >= 2 ? <div className="data-list">{results.map((customer) => <article className="data-row" key={customer.id}><div><strong>{customer.name}</strong><p className="muted">{[customer.email, customer.phone].filter(Boolean).join(" · ")}</p></div><Link className="ghost-button link-button" href={`/app/customers/${customer.id}`}>Apri</Link></article>)}{!loading && !results.length ? <p className="muted">Nessun cliente trovato.</p> : null}</div> : null}
  </section>;
}
