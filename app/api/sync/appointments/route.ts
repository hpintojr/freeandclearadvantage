import { NextResponse } from "next/server";
import { syncAppointments } from "@/lib/integrations/appointment-sync";
import { syncSalesforceDnc } from "@/lib/integrations/dnc-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Appointment sync is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const fullBackfill = new URL(request.url).searchParams.get("dncBackfill") === "1";
    const [appointments, dnc] = await Promise.all([
      syncAppointments(),
      syncSalesforceDnc({ fullBackfill }),
    ]);
    const ok = appointments.errors.length === 0 && dnc.errors.length === 0;
    if (!ok) {
      // Without this the route just answers 207 and the underlying failure is
      // invisible: nothing reaches the log, so the error counter reads zero
      // while the sync has been silently failing every minute. The collected
      // messages already carry the upstream response body.
      console.error(
        "appointment sync completed with errors",
        JSON.stringify({ appointments: appointments.errors, dnc: dnc.errors }),
      );
    }
    return NextResponse.json({ ok, appointments, dnc }, { status: ok ? 200 : 207 });
  } catch (error) {
    console.error("appointment sync failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Appointment sync failed." },
      { status: 500 },
    );
  }
}
