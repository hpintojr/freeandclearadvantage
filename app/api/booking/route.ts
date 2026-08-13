import { NextResponse } from "next/server";
import { addMinutesIso, slotDurationMinutes } from "@/lib/booking";
import { siteConfig } from "@/lib/config";
import { createConfirmationToken, icsPathFor } from "@/lib/confirmation";
import {
  createAppointmentOpportunity,
  createGhlAppointment,
  updateGhlAppointment,
} from "@/lib/integrations/ghl";
import { createSalesforceAppointmentEvent } from "@/lib/integrations/salesforce";

export const runtime = "nodejs";

/**
 * Safe confirmation payload for the results page. Contains only appointment
 * facts the consumer already knows — never CRM IDs beyond the booking ID, and
 * never lead data.
 */
function confirmationFor(bookingId: string, startIso: string, endIso: string) {
  const token = createConfirmationToken({ bookingId, startTime: startIso, endTime: endIso });
  return {
    startTime: startIso,
    endTime: endIso,
    timezone: siteConfig.timezone,
    durationMinutes: slotDurationMinutes,
    appointmentType: "telephone" as const,
    // Absent when no signing secret is configured in production; the results
    // page simply hides the download rather than offering a broken link.
    icsUrl: token ? icsPathFor(bookingId, token) : null,
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { contactId?: string; salesforceLeadId?: string; startTime?: string; name?: string } | null;
  if (!body?.contactId || !body.startTime) return NextResponse.json({ error: "Missing booking information." }, { status: 400 });
  const start = new Date(body.startTime);
  if (!Number.isFinite(start.getTime())) return NextResponse.json({ error: "Invalid booking time." }, { status: 400 });

  const startIso = start.toISOString();
  const endIso = addMinutesIso(startIso, slotDurationMinutes);

  if (!process.env.GHL_ACCESS_TOKEN || !process.env.GHL_CALENDAR_ID || !process.env.GHL_LOCATION_ID) {
    const bookingId = `demo_${crypto.randomUUID()}`;
    return NextResponse.json({
      bookingId,
      demoMode: true,
      ...confirmationFor(bookingId, startIso, endIso),
    });
  }

  try {
    const appointment = (await createGhlAppointment({
      contactId: body.contactId,
      startTime: start.toISOString(),
      endTime: addMinutesIso(start.toISOString(), slotDurationMinutes),
      title: `${body.name || "Consumer"} — Free & Clear Advantage Consultation`,
      description: "One-hour telephone consultation. Initially assigned to Alex for manual agent distribution.",
    })) as { id?: string } | null;
    const bookingId = appointment?.id || crypto.randomUUID();
    // Give GHL time to persist the initial `new` event before transitioning it.
    // Without this pause, its workflow engine can collapse both writes and miss
    // the status-change trigger entirely.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await updateGhlAppointment(bookingId, { appointmentStatus: "confirmed" });
    let opportunityId: string | undefined;
    try {
      const opportunity = await createAppointmentOpportunity({
        appointmentId: bookingId,
        contactId: body.contactId,
        consumerName: body.name || "Consumer",
        assignedUserId: process.env.GHL_DEFAULT_ASSIGNED_USER_ID,
      });
      opportunityId = opportunity?.id;
    } catch (opportunityError) {
      console.error("GHL appointment opportunity sync error", opportunityError);
    }
    let salesforceEventId: string | undefined;
    let salesforceSynced = false;
    if (body.salesforceLeadId) {
      try {
        const event = await createSalesforceAppointmentEvent({
          leadId: body.salesforceLeadId,
          ghlAppointmentId: bookingId,
          startTime: start.toISOString(),
          endTime: addMinutesIso(start.toISOString(), slotDurationMinutes),
          consumerName: body.name || "Consumer",
        });
        salesforceEventId = event?.eventId;
        salesforceSynced = Boolean(salesforceEventId);
        for (const supersededId of event?.supersededAppointmentIds || []) {
          try {
            await updateGhlAppointment(supersededId, { appointmentStatus: "cancelled" });
          } catch (supersedeError) {
            console.error(`GHL superseded appointment ${supersededId} cancellation error`, supersedeError);
          }
        }
      } catch (salesforceError) {
        console.error("Salesforce appointment event sync error", salesforceError);
      }
    }
    return NextResponse.json({
      bookingId,
      opportunityId,
      salesforceEventId,
      salesforceSynced,
      demoMode: false,
      ...confirmationFor(bookingId, startIso, endIso),
    });
  } catch (error) {
    console.error("booking error", error);
    return NextResponse.json({ error: "That time is no longer available. Please choose another time." }, { status: 409 });
  }
}
