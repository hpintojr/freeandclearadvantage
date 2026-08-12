import { NextResponse } from "next/server";
import { getGhlFreeSlots } from "@/lib/integrations/ghl";
import { defaultSlotStarts } from "@/lib/booking";

export const runtime = "nodejs";

function demoSlots(startDate: string, days = 10) {
  const result: Record<string, string[]> = {};
  const cursor = new Date(`${startDate}T12:00:00`);
  for (let i = 0; i < days; i++) {
    const d = new Date(cursor);
    d.setDate(cursor.getDate() + i);
    const day = d.getDay();
    if (day === 0 || day === 6) continue;
    const dateKey = d.toISOString().slice(0, 10);
    result[dateKey] = defaultSlotStarts.map((time) => `${dateKey}T${time}:00`);
  }
  return result;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate") || new Date().toISOString().slice(0, 10);
  const end = new Date(`${startDate}T12:00:00`);
  end.setDate(end.getDate() + 14);
  const endDate = end.toISOString().slice(0, 10);
  const timezone = url.searchParams.get("timezone") || process.env.NEXT_PUBLIC_TIMEZONE || "America/Los_Angeles";

  try {
    const ghl = await getGhlFreeSlots(startDate, endDate, timezone);
    if (!ghl) return NextResponse.json({ slots: demoSlots(startDate), demoMode: true });

    const source = ghl as Record<string, unknown>;
    const slots: Record<string, string[]> = {};
    for (const [date, value] of Object.entries(source)) {
      if (Array.isArray(value)) slots[date] = value.filter((x): x is string => typeof x === "string");
      else if (value && typeof value === "object") {
        const obj = value as { slots?: unknown[] };
        if (Array.isArray(obj.slots)) slots[date] = obj.slots.filter((x): x is string => typeof x === "string");
      }
    }
    return NextResponse.json({ slots, demoMode: false });
  } catch (error) {
    console.error("availability error", error);
    return NextResponse.json({ error: "Unable to load live availability." }, { status: 502 });
  }
}
