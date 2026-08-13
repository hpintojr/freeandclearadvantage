import { NextResponse } from "next/server";
import { consentVersion } from "@/lib/config";
import { sendLeadToGhl } from "@/lib/integrations/ghl";
import { validateAddressWithGoogle } from "@/lib/integrations/google-address";
import { sendLeadToSalesforce } from "@/lib/integrations/salesforce";
import { validateLead } from "@/lib/validation";

export const runtime = "nodejs";

function validTimezone(value: string | null | undefined) {
  if (!value) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = validateLead(payload);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const ipCountry = request.headers.get("x-vercel-ip-country")?.toUpperCase();
  const ipRegion = request.headers.get("x-vercel-ip-country-region")?.toUpperCase();
  const ipTimezone = validTimezone(request.headers.get("x-vercel-ip-timezone"));
  const browserTimezone = validTimezone(parsed.data.browserTimezone);

  if (ipCountry && ipCountry !== "US") {
    console.warn("Blocked non-US lead submission", {
      country: ipCountry,
      region: ipRegion || "unknown",
      timezone: ipTimezone || browserTimezone || "unknown",
    });
    return NextResponse.json(
      { error: "This service is currently available only in the United States." },
      { status: 403 },
    );
  }

  if (ipTimezone && browserTimezone && ipTimezone !== browserTimezone) {
    console.warn("Lead timezone signals differ", {
      country: ipCountry || "unknown",
      region: ipRegion || "unknown",
      ipTimezone,
      browserTimezone,
    });
  }

  let lead = { ...parsed.data, timezone: ipTimezone || browserTimezone };
  try {
    const validatedAddress = await validateAddressWithGoogle({
      address: lead.address,
      city: lead.city,
      state: lead.state,
      zip: lead.zip,
    });
    if (validatedAddress) lead = { ...lead, ...validatedAddress };
  } catch (error) {
    console.warn(error instanceof Error ? error.message : "Google address validation failed.");
  }

  const consentTimestamp = new Date().toISOString();
  const hasGhl = Boolean(process.env.GHL_INBOUND_WEBHOOK_URL || (process.env.GHL_ACCESS_TOKEN && process.env.GHL_LOCATION_ID));
  const hasSf = Boolean(
    process.env.SALESFORCE_WEBHOOK_URL ||
      (process.env.SALESFORCE_CLIENT_ID && process.env.SALESFORCE_CLIENT_SECRET),
  );

  if (!hasGhl && !hasSf) {
    return NextResponse.json({
      leadId: `demo_${crypto.randomUUID()}`,
      demoMode: true,
      consentVersion,
      consentTimestamp,
    });
  }

  const [ghl, salesforce] = await Promise.allSettled([
    sendLeadToGhl(lead, consentTimestamp, consentVersion),
    sendLeadToSalesforce(lead, consentTimestamp, consentVersion),
  ]);

  if (ghl.status === "rejected") console.error(ghl.reason instanceof Error ? ghl.reason.message : "GHL lead submission failed.");
  if (salesforce.status === "rejected") console.error(salesforce.reason instanceof Error ? salesforce.reason.message : "Salesforce lead submission failed.");

  const ghlValue = ghl.status === "fulfilled" ? ghl.value : null;
  const sfValue = salesforce.status === "fulfilled" ? salesforce.value : null;
  if (!ghlValue && !sfValue) return NextResponse.json({ error: "We could not save your request. Please call us instead." }, { status: 502 });

  return NextResponse.json({
    leadId: ghlValue?.contactId || sfValue?.leadId || crypto.randomUUID(),
    ghlContactId: ghlValue?.contactId,
    salesforceLeadId: sfValue?.leadId,
    consentVersion,
    consentTimestamp,
  });
}
