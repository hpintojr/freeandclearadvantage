import type { LeadPayload } from "../types";

export async function sendLeadToSalesforce(lead: LeadPayload, consentTimestamp: string, consentVersion: string) {
  if (process.env.SALESFORCE_WEBHOOK_URL) {
    const response = await fetch(process.env.SALESFORCE_WEBHOOK_URL, {
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
    if (!response.ok) throw new Error(`Salesforce webhook failed: ${response.status}`);
    return { leadId: undefined };
  }

  if (!process.env.SALESFORCE_INSTANCE_URL || !process.env.SALESFORCE_ACCESS_TOKEN) return null;

  const body: Record<string, unknown> = {
    FirstName: lead.firstName,
    LastName: lead.lastName,
    Company: "Consumer Lead",
    Email: lead.email,
    Phone: lead.phone,
    Street: lead.address,
    State: lead.state,
    PostalCode: lead.zip,
    LeadSource: "Web",
    DoNotCall: !lead.tcpaConsent,
    Description: `Free & Clear Advantage web request. Automated/prerecorded contact consent: ${lead.tcpaConsent ? "YES" : "NO"}. Submission/consent-decision timestamp: ${consentTimestamp}. Disclosure version: ${consentVersion}.`,
  };

  const addCustom = (envName: string, value: unknown) => {
    const apiName = process.env[envName]?.trim();
    if (apiName) body[apiName] = value;
  };

  addCustom("SALESFORCE_FIELD_DOB", lead.dob);
  addCustom("SALESFORCE_FIELD_DEBT_AMOUNT", lead.debtAmount);
  addCustom("SALESFORCE_FIELD_DEBT_TYPES", lead.debtTypes.join(";"));
  addCustom("SALESFORCE_FIELD_EMPLOYMENT", lead.employment);
  addCustom("SALESFORCE_FIELD_PAYMENT_STATUS", lead.paymentStatus);
  addCustom("SALESFORCE_FIELD_CONSENT", lead.tcpaConsent);
  addCustom("SALESFORCE_FIELD_CONSENT_TIMESTAMP", consentTimestamp);
  addCustom("SALESFORCE_FIELD_CONSENT_VERSION", consentVersion);

  const instance = process.env.SALESFORCE_INSTANCE_URL.replace(/\/$/, "");
  const apiVersion = process.env.SALESFORCE_API_VERSION || "v67.0";
  const response = await fetch(`${instance}/services/data/${apiVersion}/sobjects/Lead`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SALESFORCE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Salesforce lead create failed: ${response.status} ${text.slice(0, 300)}`);
  }

  const json = (await response.json()) as { id?: string };
  return { leadId: json.id };
}
