export const defaultSlotStarts = ["09:30", "10:30", "11:30", "12:30", "13:30", "14:30", "16:00"];
export const slotDurationMinutes = 60;

export function addMinutesIso(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}
