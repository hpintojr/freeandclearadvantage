import { NextResponse } from "next/server";
import { addGhlContactTags, getGhlContact } from "@/lib/integrations/ghl";
import { setSalesforceDncByContact } from "@/lib/integrations/salesforce";

export const runtime = "nodejs";

type GhlDncPayload = {
  type?: string;
  reason?: string;
  reply?: string;
  dnd?: boolean;
  optedOut?: boolean;
  locationId?: string;
  location_id?: string;
  contactId?: string;
  contact_id?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  contact?: {
    id?: string;
    email?: string;
    phone?: string;
    dnd?: boolean;
    tags?: string[];
  };
};

function isDncNotification(body: GhlDncPayload) {
  const eventType = `${body.type || ""} ${body.reason || ""}`.toLowerCase();
  const tags = [...(body.tags || []), ...(body.contact?.tags || [])].map((tag) => tag.toLowerCase());
  return (
    body.dnd === true ||
    body.contact?.dnd === true ||
    body.optedOut === true ||
    body.reply?.trim() === "2" ||
    eventType.includes("dnd") ||
    eventType.includes("opt-out") ||
    eventType.includes("opt out") ||
    tags.some((tag) => tag.includes("dnc") || tag.includes("opt-out"))
  );
}

export async function POST(request: Request) {
  const secret = process.env.GHL_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "GHL DNC webhook is not configured." }, { status: 503 });
  const supplied =
    request.headers.get("x-fca-webhook-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (supplied !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as GhlDncPayload | null;
  if (!body || !isDncNotification(body)) {
    return NextResponse.json({ error: "Payload is not an opt-out/DNC notification." }, { status: 422 });
  }

  const payloadLocationId = body.locationId || body.location_id;
  if (payloadLocationId && payloadLocationId !== process.env.GHL_LOCATION_ID) {
    return NextResponse.json({ error: "Location mismatch." }, { status: 403 });
  }

  const contactId = body.contactId || body.contact_id || body.contact?.id;
  let email = body.email || body.contact?.email;
  let phone = body.phone || body.contact?.phone;
  if (contactId && (!email || !phone)) {
    const contact = await getGhlContact(contactId);
    email ||= contact.email;
    phone ||= contact.phone;
  }
  if (!email && !phone) {
    return NextResponse.json({ error: "No contact email or phone was supplied." }, { status: 422 });
  }

  const salesforce = await setSalesforceDncByContact({ email, phone });
  if (contactId) {
    await addGhlContactTags(contactId, ["F&C-Website", "ghl-dnc-synced-to-salesforce"]);
  }
  return NextResponse.json({ ok: true, salesforce });
}
