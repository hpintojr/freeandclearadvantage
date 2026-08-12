import { NextResponse } from "next/server";
import { addMinutesIso, slotDurationMinutes } from "@/lib/booking";
import { createGhlAppointment } from "@/lib/integrations/ghl";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { contactId?: string; startTime?: string; name?: string } | null;
  if (!body?.contactId || !body.startTime) return NextResponse.json({ error: "Missing booking information." }, { status: 400 });
  const start = new Date(body.startTime);
  if (!Number.isFinite(start.getTime())) return NextResponse.json({ error: "Invalid booking time." }, { status: 400 });

  if (!process.env.GHL_ACCESS_TOKEN || !process.env.GHL_CALENDAR_ID || !process.env.GHL_LOCATION_ID) {
    return NextResponse.json({ bookingId: `demo_${crypto.randomUUID()}`, demoMode: true });
  }

  try {
    const appointment = (await createGhlAppointment({
      contactId: body.contactId,
      startTime: start.toISOString(),
      endTime: addMinutesIso(start.toISOString(), slotDurationMinutes),
      title: `${body.name || "Consumer"} — Free & Clear Advantage Consultation`,
    })) as { id?: string } | null;
    return NextResponse.json({ bookingId: appointment?.id || crypto.randomUUID(), demoMode: false });
  } catch (error) {
    console.error("booking error", error);
    return NextResponse.json({ error: "That time is no longer available. Please choose another time." }, { status: 409 });
  }
}
