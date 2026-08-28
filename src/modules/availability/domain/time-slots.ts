export type MinuteInterval = Readonly<{ start: number; end: number }>;

export function subtractIntervals(base: MinuteInterval[], blocked: MinuteInterval[]): MinuteInterval[] {
  return blocked.reduce<MinuteInterval[]>((available, block) => available.flatMap((slot) => {
    if (block.end <= slot.start || block.start >= slot.end) return [slot];
    const result: MinuteInterval[] = [];
    if (block.start > slot.start) result.push({ start: slot.start, end: Math.min(block.start, slot.end) });
    if (block.end < slot.end) result.push({ start: Math.max(block.end, slot.start), end: slot.end });
    return result;
  }), base);
}

export function generateStartTimes(intervals: MinuteInterval[], durationMinutes: number, stepMinutes = 15): number[] {
  if (durationMinutes <= 0 || stepMinutes <= 0) throw new Error("Durata e passo devono essere positivi.");
  return intervals.flatMap(({ start, end }) => {
    const first = Math.ceil(start / stepMinutes) * stepMinutes;
    const times: number[] = [];
    for (let cursor = first; cursor + durationMinutes <= end; cursor += stepMinutes) times.push(cursor);
    return times;
  });
}

export function parseTimeToMinutes(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Orario non valido.");
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error("Orario non valido.");
  return hours * 60 + minutes;
}

export function formatMinutes(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
