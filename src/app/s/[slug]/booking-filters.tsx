"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BookingFilters({ slug, serviceId, date, staffId, staff, minimumDate }: {
  slug: string;
  serviceId: string;
  date: string;
  staffId?: string;
  staff: Array<{ id: string; name: string }>;
  minimumDate: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function navigate(nextDate: string, nextStaffId: string) {
    setLoading(true);
    const query = new URLSearchParams({ service: serviceId, date: nextDate });
    if (nextStaffId) query.set("staff", nextStaffId);
    router.push(`/s/${slug}?${query}`);
  }

  return <div className="booking-filters">
    <label><span>Data di partenza</span><input type="date" min={minimumDate} value={date} onChange={(event) => navigate(event.target.value, staffId ?? "")} /></label>
    <label><span>Operatore</span><select value={staffId ?? ""} onChange={(event) => navigate(date, event.target.value)}>
      <option value="">Prima disponibilità del salone</option>
      {staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
    </select></label>
    {loading ? <p className="booking-filter-loading" role="status">Aggiornamento della prima disponibilità…</p> : null}
  </div>;
}
