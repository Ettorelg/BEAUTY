export type AgendaView = "day" | "week" | "month" | "year";

export function addCalendarDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function startOfCalendarWeek(date: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addCalendarDays(date, -(weekday || 7) + 1);
}

export function startOfCalendarYear(date: string) {
  return `${date.slice(0, 4)}-01-01`;
}

export function startOfCalendarMonth(date: string) {
  return `${date.slice(0, 8)}01`;
}

export function addCalendarMonths(date: string, months: number) {
  const [year, month] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + months, 1)).toISOString().slice(0, 10);
}

export function addCalendarYears(date: string, years: number) {
  const year = Number(date.slice(0, 4));
  return `${year + years}-01-01`;
}

export function monthGridDates(date: string) {
  const first = startOfCalendarMonth(date);
  const next = addCalendarMonths(first, 1);
  const leading = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const days: Array<string | null> = Array.from({ length: leading }, () => null);
  for (let current = first; current < next; current = addCalendarDays(current, 1)) days.push(current);
  while (days.length % 7) days.push(null);
  return days;
}
