export type DailyShift = { startMinutes: number; endMinutes: number };

export function validateDailyShifts(shifts: DailyShift[]) {
  if (!shifts.length) throw new Error("Inserisci almeno un turno.");
  if (shifts.length > 2) throw new Error("Sono consentiti al massimo due turni per giorno.");
  const ordered = [...shifts].sort((a, b) => a.startMinutes - b.startMinutes);
  for (const shift of ordered) {
    if (shift.endMinutes <= shift.startMinutes) throw new Error("La fine del turno deve essere successiva all’inizio.");
  }
  if (ordered[1] && ordered[0].endMinutes > ordered[1].startMinutes) {
    throw new Error("I due turni non possono sovrapporsi.");
  }
  return ordered;
}
