import { NextResponse } from "next/server";
import { consentVersion } from "@/lib/config";
import { sendLeadToGhl } from "@/lib/integrations/ghl";
import { sendLeadToSalesforce } from "@/lib/integrations/salesforce";
import { validateLead } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = validateLead(payload);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const consentTimestamp = new Date().toISOString();
  const hasGhl = Boolean(process.env.GHL_INBOUND_WEBHOOK_URL || (process.env.GHL_ACCESS_TOKEN && process.env.GHL_LOCATION_ID));
  const hasSf = Boolean(process.env.SALESFORCE_WEBHOOK_URL || (process.env.SALESFORCE_INSTANCE_URL && process.env.SALESFORCE_ACCESS_TOKEN));

  if (!hasGhl && !hasSf) {
    return NextResponse.json({
      leadId: `demo_${crypto.randomUUID()}`,
      demoMode: true,
      consentVersion,
      consentTimestamp,
    });
  }

  const [ghl, salesforce] = await Promise.allSettled([
    sendLeadToGhl(parsed.data, consentTimestamp),
    sendLeadToSalesforce(parsed.data, consentTimestamp),
  ]);

  if (ghl.status === "rejected") console.error("GHL lead error", ghl.reason);
  if (salesforce.status === "rejected") console.error("Salesforce lead error", salesforce.reason);

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
