"use client";

import { useEffect, useState } from "react";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export function CustomerAutofill() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/agenda/customers?q=${encodeURIComponent(value)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Ricerca non disponibile");
        const data = (await response.json()) as { customers?: Customer[] };
        setResults(data.customers ?? []);
        setMessage(data.customers?.length ? "Seleziona il cliente trovato." : "Nessun cliente trovato: completa i dati per crearne uno nuovo.");
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setResults([]);
          setMessage("Ricerca clienti temporaneamente non disponibile.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function choose(customer: Customer) {
    setSelectedCustomerId(customer.id);
    setName(customer.name);
    setEmail(customer.email ?? "");
    setPhone(customer.phone ?? "");
    setQuery("");
    setResults([]);
    setMessage("Cliente selezionato: anagrafica compilata.");
  }

  return (
    <fieldset className="compact-form stacked">
      <input type="hidden" name="customerId" value={selectedCustomerId} />
      <legend>Cliente</legend>
      <input
        name="customerName"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setQuery(event.target.value);
        }}
        placeholder="Nome cliente"
        autoComplete="off"
        required
        minLength={2}
      />
      <div className="form-row">
        <input
          name="email"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setQuery(event.target.value);
          }}
          placeholder="Email"
          autoComplete="off"
        />
        <input
          name="phone"
          type="tel"
          value={phone}
          onChange={(event) => {
            setPhone(event.target.value);
            setQuery(event.target.value);
          }}
          placeholder="Telefono"
          autoComplete="off"
        />
      </div>
      {loading ? <p className="muted">Ricerca clienti…</p> : null}
      {results.length ? (
        <div className="data-list" role="listbox" aria-label="Clienti trovati">
          {results.map((customer) => (
            <button className="data-row" type="button" key={customer.id} onClick={() => choose(customer)}>
              <span>
                <strong>{customer.name}</strong>
                <small>{customer.email || "Email non presente"} · {customer.phone || "Telefono non presente"}</small>
              </span>
              <span className="status-pill">Seleziona</span>
            </button>
          ))}
        </div>
      ) : null}
      {message ? <p className="muted" aria-live="polite">{message}</p> : null}
    </fieldset>
  );
}
