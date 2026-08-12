import type { LeadPayload } from "../types";

const baseUrl = "https://services.leadconnectorhq.com";

function headers(version: string) {
  return {
    Authorization: `Bearer ${process.env.GHL_ACCESS_TOKEN}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    Version: version,
  };
}

function customFields(lead: LeadPayload, consentTimestamp: string) {
  const fields: { id: string; fieldValue: string }[] = [];
  const add = (id: string | undefined, value: string | number | boolean) => {
    if (id) fields.push({ id, fieldValue: String(value) });
  };
  add(process.env.GHL_CF_DEBT_AMOUNT, lead.debtAmount);
  add(process.env.GHL_CF_DEBT_TYPES, lead.debtTypes.join(", "));
  add(process.env.GHL_CF_EMPLOYMENT, lead.employment);
  add(process.env.GHL_CF_PAYMENT_STATUS, lead.paymentStatus);
  add(process.env.GHL_CF_CONSENT, lead.tcpaConsent);
  add(process.env.GHL_CF_CONSENT_TIMESTAMP, consentTimestamp);
  return fields;
}

export async function sendLeadToGhl(lead: LeadPayload, consentTimestamp: string) {
  if (process.env.GHL_INBOUND_WEBHOOK_URL) {
    const response = await fetch(process.env.GHL_INBOUND_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...lead, consentTimestamp, source: lead.source || "Free & Clear Advantage Web Funnel" }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`GHL webhook failed: ${response.status}`);
    return { contactId: undefined };
  }

  if (!process.env.GHL_ACCESS_TOKEN || !process.env.GHL_LOCATION_ID) return null;

  const contactsVersion = process.env.GHL_CONTACTS_API_VERSION || "2021-07-28";
  const response = await fetch(`${baseUrl}/contacts/upsert`, {
    method: "POST",
    headers: headers(contactsVersion),
    body: JSON.stringify({
      locationId: process.env.GHL_LOCATION_ID,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      address1: lead.address,
      state: lead.state,
      postalCode: lead.zip,
      dateOfBirth: lead.dob,
      source: lead.source || "Free & Clear Advantage Web Funnel",
      tags: ["free-clear-web-lead"],
      customFields: customFields(lead, consentTimestamp),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GHL contact upsert failed: ${response.status} ${text.slice(0, 300)}`);
  }

  const json = (await response.json()) as { contact?: { id?: string }; id?: string };
  return { contactId: json.contact?.id || json.id };
}

export async function getGhlFreeSlots(startDate: string, endDate: string, timezone: string) {
  if (!process.env.GHL_ACCESS_TOKEN || !process.env.GHL_CALENDAR_ID) return null;
  const url = new URL(`${baseUrl}/calendars/${process.env.GHL_CALENDAR_ID}/free-slots`);
  url.searchParams.set("startDate", String(new Date(`${startDate}T00:00:00`).getTime()));
  url.searchParams.set("endDate", String(new Date(`${endDate}T23:59:59`).getTime()));
  url.searchParams.set("timezone", timezone);

  const calendarVersion = process.env.GHL_CALENDARS_API_VERSION || "v3";
  const response = await fetch(url, { headers: headers(calendarVersion), cache: "no-store" });
  if (!response.ok) throw new Error(`GHL free slots failed: ${response.status}`);
  return response.json();
}

export async function createGhlAppointment(args: {
  contactId: string;
  startTime: string;
  endTime: string;
  title: string;
}) {
  if (!process.env.GHL_ACCESS_TOKEN || !process.env.GHL_CALENDAR_ID || !process.env.GHL_LOCATION_ID) return null;

  const calendarVersion = process.env.GHL_CALENDARS_API_VERSION || "v3";
  const response = await fetch(`${baseUrl}/calendars/events/appointments`, {
    method: "POST",
    headers: headers(calendarVersion),
    body: JSON.stringify({
      calendarId: process.env.GHL_CALENDAR_ID,
      locationId: process.env.GHL_LOCATION_ID,
      contactId: args.contactId,
      startTime: args.startTime,
      endTime: args.endTime,
      title: args.title,
      appointmentStatus: "confirmed",
      toNotify: true,
      ignoreFreeSlotValidation: false,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GHL appointment failed: ${response.status} ${text.slice(0, 300)}`);
  }
  return response.json();
}
