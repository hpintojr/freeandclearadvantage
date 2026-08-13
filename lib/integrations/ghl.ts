import type { LeadPayload } from "../types";

const baseUrl = "https://services.leadconnectorhq.com";
const websiteSource = "F&C-Website";
const appointmentPipelineName = "F&C Appointments";

export type GhlAppointment = {
  id: string;
  calendarId?: string;
  locationId?: string;
  contactId?: string;
  assignedUserId?: string;
  appointmentStatus?: string;
  startTime?: string;
  endTime?: string;
  title?: string;
  description?: string;
  dateAdded?: string;
  dateUpdated?: string;
  updatedAt?: string;
};

type GhlPipeline = {
  id?: string;
  name?: string;
  stages?: { id?: string; name?: string; position?: number }[];
};

export type GhlOpportunity = {
  id?: string;
  name?: string;
  contactId?: string;
  assignedTo?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  status?: string;
};

export type GhlUser = { id?: string; email?: string; name?: string };
export type GhlContact = {
  id?: string;
  email?: string;
  phone?: string;
  dnd?: boolean;
  tags?: string[];
};

function headers(version: string) {
  return {
    Authorization: `Bearer ${process.env.GHL_ACCESS_TOKEN}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    Version: version,
  };
}

function customFields(lead: LeadPayload, consentTimestamp: string, consentVersion: string) {
  const fields: { id: string; fieldValue: string | string[] }[] = [];
  const add = (id: string | undefined, value: string | string[] | number | boolean) => {
    if (id) fields.push({ id, fieldValue: Array.isArray(value) ? value : String(value) });
  };
  add(process.env.GHL_CF_DEBT_AMOUNT, lead.debtAmount);
  add(process.env.GHL_CF_DEBT_TYPES, lead.debtTypes);
  add(process.env.GHL_CF_EMPLOYMENT, lead.employment);
  add(process.env.GHL_CF_PAYMENT_STATUS, lead.paymentStatus);
  add(process.env.GHL_CF_CONSENT, lead.tcpaConsent);
  add(process.env.GHL_CF_CONSENT_TIMESTAMP, consentTimestamp);
  add(process.env.GHL_CF_CONSENT_VERSION, consentVersion);
  add(process.env.GHL_CF_DOB, lead.dob);
  add(process.env.GHL_CF_LEAD_SOURCE, "Free & Clear Advantage Website");
  add(process.env.GHL_CF_IP_ADDRESS, lead.ipAddress || "Not available");
  add(process.env.GHL_CF_IP_COUNTRY, lead.ipCountry || "Not available");
  add(process.env.GHL_CF_IP_REGION, lead.ipRegion || "Not available");
  return fields;
}

function submissionAuditNote(lead: LeadPayload, consentTimestamp: string) {
  return [
    "Free & Clear Advantage website submission audit",
    `Submitted: ${consentTimestamp}`,
    `IP address: ${lead.ipAddress || "Not available"}`,
    `IP country: ${lead.ipCountry || "Not available"}`,
    `IP region: ${lead.ipRegion || "Not available"}`,
    `Consumer timezone: ${lead.timezone || "Not available"}`,
  ].join("\n");
}

export async function sendLeadToGhl(lead: LeadPayload, consentTimestamp: string, consentVersion: string) {
  if (process.env.GHL_INBOUND_WEBHOOK_URL) {
    const response = await fetch(process.env.GHL_INBOUND_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...lead,
        consentTimestamp,
        consentVersion,
        source: lead.source || "Free & Clear Advantage Web Funnel",
      }),
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
      city: lead.city,
      state: lead.state,
      postalCode: lead.zip,
      country: "US",
      ...(lead.timezone ? { timezone: lead.timezone } : {}),
      dateOfBirth: lead.dob,
      ...(lead.tcpaConsent ? {} : { dnd: true }),
      source: websiteSource,
      customFields: customFields(lead, consentTimestamp, consentVersion),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GHL contact upsert failed: ${response.status}`);
  }

  const json = (await response.json()) as { contact?: { id?: string }; id?: string };
  const contactId = json.contact?.id || json.id;
  if (!contactId) throw new Error("GHL contact upsert did not return a contact ID.");

  const tagResponse = await fetch(`${baseUrl}/contacts/${contactId}/tags`, {
    method: "POST",
    headers: headers(contactsVersion),
    body: JSON.stringify({ tags: [websiteSource] }),
    cache: "no-store",
  });
  if (!tagResponse.ok) console.warn(`GHL contact tag failed: ${tagResponse.status}`);

  const noteResponse = await fetch(`${baseUrl}/contacts/${contactId}/notes`, {
    method: "POST",
    headers: headers(contactsVersion),
    body: JSON.stringify({ body: submissionAuditNote(lead, consentTimestamp) }),
    cache: "no-store",
  });
  if (!noteResponse.ok) console.warn(`GHL submission audit note failed: ${noteResponse.status}`);

  return { contactId };
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
  description?: string;
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
      description: args.description,
      appointmentStatus: "confirmed",
      assignedUserId: process.env.GHL_DEFAULT_ASSIGNED_USER_ID || "8tTyPhJCYmCqsCFvaiq6",
      meetingLocationType: "phone",
      overrideLocationConfig: true,
      toNotify: true,
      ignoreFreeSlotValidation: false,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GHL appointment failed: ${response.status}`);
  }
  return response.json();
}

async function ghlJson<T>(path: string, init: RequestInit = {}, version = "2021-07-28") {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...headers(version), ...(init.headers || {}) },
    cache: "no-store",
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`GHL ${init.method || "GET"} ${path} failed: ${response.status} ${body.slice(0, 300)}`);
  }
  return (body ? JSON.parse(body) : {}) as T;
}

function normalizeUsPhone(value: string | undefined) {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return value?.trim() || undefined;
}

export async function findGhlContactByEmailOrPhone(email?: string, phone?: string) {
  if (!process.env.GHL_LOCATION_ID) return null;
  const candidates: Record<string, string>[] = [];
  if (email?.trim()) candidates.push({ email: email.trim().toLowerCase() });
  const normalizedPhone = normalizeUsPhone(phone);
  if (normalizedPhone) candidates.push({ phone: normalizedPhone });

  for (const candidate of candidates) {
    const url = new URL(`${baseUrl}/contacts/search/duplicate`);
    url.searchParams.set("locationId", process.env.GHL_LOCATION_ID);
    for (const [key, value] of Object.entries(candidate)) url.searchParams.set(key, value);
    const response = await fetch(url, {
      headers: headers("v3"),
      cache: "no-store",
    });
    if (response.status === 404) continue;
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`GHL duplicate contact search failed: ${response.status} ${body.slice(0, 300)}`);
    }
    const json = (body ? JSON.parse(body) : {}) as { contact?: GhlContact } & GhlContact;
    const contact = json.contact || json;
    if (contact.id) return contact;
  }
  return null;
}

export async function applySalesforceDncToGhl(contactId: string) {
  const contactVersion = "v3";
  const updated = await ghlJson<{ contact?: GhlContact }>(
    `/contacts/${encodeURIComponent(contactId)}`,
    { method: "PUT", body: JSON.stringify({ dnd: true }) },
    contactVersion,
  );
  await ghlJson(
    `/contacts/${encodeURIComponent(contactId)}/tags`,
    { method: "POST", body: JSON.stringify({ tags: ["salesforce-dnc"] }) },
    contactVersion,
  );
  return updated.contact || null;
}

export async function getGhlAppointment(appointmentId: string) {
  const json = await ghlJson<{ event?: GhlAppointment; appointment?: GhlAppointment } & GhlAppointment>(
    `/calendars/events/appointments/${encodeURIComponent(appointmentId)}`,
    {},
    process.env.GHL_CALENDARS_API_VERSION || "v3",
  );
  return (json.event || json.appointment || json) as GhlAppointment;
}

export async function updateGhlAppointment(appointmentId: string, changes: Partial<GhlAppointment>) {
  return ghlJson<{ event?: GhlAppointment; appointment?: GhlAppointment }>(
    `/calendars/events/appointments/${encodeURIComponent(appointmentId)}`,
    { method: "PUT", body: JSON.stringify(changes) },
    process.env.GHL_CALENDARS_API_VERSION || "v3",
  );
}

export async function getGhlUsers() {
  if (!process.env.GHL_LOCATION_ID) return [];
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const json = await ghlJson<{ users?: GhlUser[] }>(
        `/users/?locationId=${encodeURIComponent(process.env.GHL_LOCATION_ID)}`,
      );
      return json.users || [];
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function getAppointmentPipeline() {
  if (!process.env.GHL_LOCATION_ID) return null;
  const json = await ghlJson<{ pipelines?: GhlPipeline[] }>(
    `/opportunities/pipelines?locationId=${encodeURIComponent(process.env.GHL_LOCATION_ID)}`,
  );
  return (
    json.pipelines?.find((pipeline) => pipeline.name?.trim().toLowerCase() === appointmentPipelineName.toLowerCase()) ||
    null
  );
}

function stageByName(pipeline: GhlPipeline, name: string) {
  return pipeline.stages?.find((stage) => stage.name?.trim().toLowerCase() === name.toLowerCase());
}

export async function findAppointmentOpportunity(appointmentId: string, contactId?: string) {
  if (!process.env.GHL_LOCATION_ID) return null;
  const pipeline = await getAppointmentPipeline();
  if (!pipeline?.id) return null;

  const url = new URL(`${baseUrl}/opportunities/search`);
  url.searchParams.set("locationId", process.env.GHL_LOCATION_ID);
  url.searchParams.set("pipelineId", pipeline.id);
  if (contactId) url.searchParams.set("contactId", contactId);
  url.searchParams.set("limit", "100");
  const response = await fetch(url, {
    headers: headers(process.env.GHL_OPPORTUNITIES_API_VERSION || "v3"),
    cache: "no-store",
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`GHL opportunity search failed: ${response.status} ${body.slice(0, 300)}`);
  const json = (body ? JSON.parse(body) : {}) as { opportunities?: GhlOpportunity[] };
  const marker = `[GHL:${appointmentId}]`;
  const opportunities = json.opportunities || [];
  return (
    opportunities.find((opportunity) => opportunity.name?.includes(marker)) ||
    (contactId ? opportunities.find((opportunity) => opportunity.contactId === contactId) : null) ||
    null
  );
}

export async function createAppointmentOpportunity(args: {
  appointmentId: string;
  contactId: string;
  consumerName: string;
  assignedUserId?: string;
}) {
  if (!process.env.GHL_LOCATION_ID) return null;
  const existing = await findAppointmentOpportunity(args.appointmentId, args.contactId);
  if (existing) return existing;

  const pipeline = await getAppointmentPipeline();
  const stage = pipeline && stageByName(pipeline, "New Appointment");
  if (!pipeline?.id || !stage?.id) {
    throw new Error(`GHL pipeline "${appointmentPipelineName}" or stage "New Appointment" was not found.`);
  }

  const json = await ghlJson<{ opportunity?: GhlOpportunity }>(
    "/opportunities/",
    {
      method: "POST",
      body: JSON.stringify({
        pipelineId: pipeline.id,
        pipelineStageId: stage.id,
        locationId: process.env.GHL_LOCATION_ID,
        name: `F&C Appointment - ${args.consumerName} [GHL:${args.appointmentId}]`,
        status: "open",
        contactId: args.contactId,
        assignedTo: args.assignedUserId || process.env.GHL_DEFAULT_ASSIGNED_USER_ID || "8tTyPhJCYmCqsCFvaiq6",
        source: websiteSource,
      }),
    },
    process.env.GHL_OPPORTUNITIES_API_VERSION || "v3",
  );
  return json.opportunity || null;
}

export async function updateAppointmentOpportunity(
  appointmentId: string,
  contactId: string | undefined,
  changes: { assignedTo?: string; stageName?: string },
) {
  const [opportunity, pipeline] = await Promise.all([
    findAppointmentOpportunity(appointmentId, contactId),
    getAppointmentPipeline(),
  ]);
  if (!opportunity?.id || !pipeline?.id) return null;

  const body: Record<string, string> = {};
  if (changes.assignedTo) body.assignedTo = changes.assignedTo;
  if (changes.stageName) {
    const stage = stageByName(pipeline, changes.stageName);
    if (!stage?.id) throw new Error(`GHL opportunity stage "${changes.stageName}" was not found.`);
    const currentStage = pipeline.stages?.find((candidate) => candidate.id === opportunity.pipelineStageId);
    const safeToAdvance =
      changes.stageName !== "Assigned" ||
      ["New Appointment", "Awaiting Agent Assignment"].includes(currentStage?.name || "");
    if (safeToAdvance) body.pipelineStageId = stage.id;
  }
  if (!Object.keys(body).length) return opportunity;
  return ghlJson<{ opportunity?: GhlOpportunity }>(
    `/opportunities/${encodeURIComponent(opportunity.id)}`,
    { method: "PUT", body: JSON.stringify(body) },
    process.env.GHL_OPPORTUNITIES_API_VERSION || "v3",
  );
}

