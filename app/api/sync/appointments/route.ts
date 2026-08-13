import { NextResponse } from "next/server";
import { syncAppointments } from "@/lib/integrations/appointment-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Appointment sync is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncAppointments();
    return NextResponse.json({ ok: result.errors.length === 0, ...result }, { status: result.errors.length ? 207 : 200 });
  } catch (error) {
    console.error("appointment sync failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Appointment sync failed." },
      { status: 500 },
    );
  }
}
